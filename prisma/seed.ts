/**
 * Popula o banco PostgreSQL com dados de exemplo, incluindo histórico de
 * avaliações da Matriz Nokia ao longo do tempo.
 *
 * V6: adaptado para o Cadastro Mestre de Colaboradores — não existem mais
 * líderes/equipes; todo profissional é um Colaborador, com TipoPessoa,
 * Regional, Operadoras/Clientes, EmpresaNome, Cargo e Telefone (mesmos
 * campos trazidos pela Importação Massiva/Smart Sync).
 *
 * V6.1: `cadastro` foi renomeado para `operadoras` (não é mais um
 * identificador único — ver nota no topo de lib/colaboradores.ts) e a
 * identidade de cada colaborador passou a ser `nomeNormalizado`.
 *
 * Rodar com: npm run seed
 * (ou: npx prisma db seed)
 */
import { PrismaClient } from "@prisma/client";
import { hashSenha } from "../lib/senha";

const prisma = new PrismaClient();

const ETAPAS = ["MOS", "XML", "TX", "SWAP", "FAM", "REVERSA"] as const;

/**
 * V7 — Etapa 1/2 (Autenticação/Gestão de Usuários): garante que sempre
 * exista pelo menos uma conta ADMIN, mesmo em bancos já populados com dados
 * de exemplo — sem isso, um banco existente jamais teria como fazer login
 * depois que o sistema de autenticação por usuário substituiu o antigo
 * "modo de edição" por senha compartilhada.
 *
 * Idempotente (upsert por e-mail) e roda ANTES do early-return do seed de
 * exemplo abaixo, de propósito: mesmo em um banco de produção que já tem
 * colaboradores/atendimentos e por isso pula o restante do seed, a conta
 * admin inicial ainda precisa ser criada.
 *
 * Credenciais vêm de variáveis de ambiente (nunca hardcoded). Se
 * ADMIN_SEED_EMAIL/ADMIN_SEED_SENHA não estiverem definidas, usa valores de
 * desenvolvimento padrão e avisa no console — apenas para não travar o
 * ambiente local; em produção essas variáveis devem ser configuradas.
 */
async function seedUsuarioAdmin() {
  const email = process.env.ADMIN_SEED_EMAIL || "leonidas.matias@telequipeprojetos.com.br";
  const nome = process.env.ADMIN_SEED_NOME || "Administrador";
  const senha = process.env.ADMIN_SEED_SENHA || "Tlqp@1234";

  if (!process.env.ADMIN_SEED_EMAIL || !process.env.ADMIN_SEED_SENHA) {
    console.warn(
      "ADMIN_SEED_EMAIL/ADMIN_SEED_SENHA não definidas — usando credenciais " +
        "padrão de desenvolvimento. Configure-as em produção e troque a " +
        "senha após o primeiro login."
    );
  }

  const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
  if (usuarioExistente) {
    console.log(`Usuário admin "${email}" já existe. Seed de usuário ignorado.`);
    return;
  }

  await prisma.usuario.create({
    data: {
      nome,
      email,
      senhaHash: hashSenha(senha),
      perfil: "ADMIN",
      ativo: true,
    },
  });
  console.log(`Usuário ADMIN inicial criado: ${email}`);
}

async function main() {
  await seedUsuarioAdmin();

  const existentes = await prisma.colaborador.count();
  if (existentes > 0) {
    console.log("Banco já contém dados de colaboradores. Seed de exemplo ignorado.");
    return;
  }

  const competenciaIdPorEtapa = new Map<string, number>();
  for (const nome of ETAPAS) {
    const competencia = await prisma.competenciaNokia.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
    competenciaIdPorEtapa.set(nome, competencia.id);
  }

  const agora = new Date();

  const c1 = await prisma.colaborador.create({
    data: {
      nome: "João Pedro Lima",
      nomeNormalizado: "JOAO PEDRO LIMA",
      tipoPessoa: "CLT",
      regional: "Regional Sul",
      operadoras: "NOKIA",
      empresaNome: "Telequipe",
      cargo: "Instalador Senior I",
      telefone: "51 99123-0001",
      status: "ativo",
      dataImportacao: agora,
      ultimaAtualizacao: agora,
    },
  });
  const c2 = await prisma.colaborador.create({
    data: {
      nome: "Marcos Vinícius",
      nomeNormalizado: "MARCOS VINICIUS",
      tipoPessoa: "PJ - EXTERNO",
      regional: "Regional Sul",
      operadoras: "ERICSSON/NOKIA",
      empresaNome: "Telequipe",
      cargo: "Instalador",
      telefone: "51 99123-0002",
      status: "ativo",
      dataImportacao: agora,
      ultimaAtualizacao: agora,
    },
  });
  const c3 = await prisma.colaborador.create({
    data: {
      nome: "Fernanda Rocha",
      nomeNormalizado: "FERNANDA ROCHA",
      tipoPessoa: "CLT",
      regional: "Regional Sudeste",
      operadoras: "TELEFONICA",
      empresaNome: "Telequipe",
      cargo: "Técnica de Manutenção",
      telefone: "11 99123-0003",
      status: "ativo",
      dataImportacao: agora,
      ultimaAtualizacao: agora,
    },
  });
  const c4 = await prisma.colaborador.create({
    data: {
      nome: "Rafael Torres",
      nomeNormalizado: "RAFAEL TORRES",
      tipoPessoa: "PJ - INTERNO",
      regional: "Regional Sudeste",
      operadoras: "HUAWEI/NOKIA",
      empresaNome: "Telequipe",
      cargo: "Supervisor",
      telefone: "11 99123-0004",
      status: "ativo",
      dataImportacao: agora,
      ultimaAtualizacao: agora,
    },
  });

  async function avaliar(colaboradorId: number, etapa: string, nivel: string, nota: number, avaliadoEm: string) {
    await prisma.avaliacaoCompetencia.create({
      data: {
        colaboradorId,
        competenciaId: competenciaIdPorEtapa.get(etapa)!,
        nivel,
        nota,
        avaliadoEm: new Date(avaliadoEm),
      },
    });
  }

  // João Pedro Lima — bom desempenho, tendência de alta
  await avaliar(c1.id, "MOS", "Intermediário", 75, "2026-02-01");
  await avaliar(c1.id, "MOS", "Avançado", 90, "2026-05-10");
  await avaliar(c1.id, "XML", "Intermediário", 80, "2026-02-01");
  await avaliar(c1.id, "XML", "Avançado", 88, "2026-05-10");
  await avaliar(c1.id, "TX", "Avançado", 85, "2026-05-10");
  await avaliar(c1.id, "SWAP", "Intermediário", 82, "2026-05-10");

  // Marcos Vinícius — gargalo em SWAP, tendência de queda
  await avaliar(c2.id, "MOS", "Intermediário", 80, "2026-02-15");
  await avaliar(c2.id, "MOS", "Básico", 65, "2026-05-20");
  await avaliar(c2.id, "SWAP", "Básico", 72, "2026-02-15");
  await avaliar(c2.id, "SWAP", "Não certificado", 58, "2026-05-20");
  await avaliar(c2.id, "XML", "Básico", 70, "2026-05-20");

  // Fernanda Rocha — gargalo em FAM
  await avaliar(c3.id, "FAM", "Básico", 60, "2026-03-01");
  await avaliar(c3.id, "FAM", "Não certificado", 45, "2026-06-01");
  await avaliar(c3.id, "TX", "Intermediário", 75, "2026-03-01");
  await avaliar(c3.id, "TX", "Avançado", 80, "2026-06-01");
  await avaliar(c3.id, "REVERSA", "Avançado", 88, "2026-06-01");

  // Rafael Torres — bom desempenho geral
  await avaliar(c4.id, "MOS", "Avançado", 90, "2026-04-01");
  await avaliar(c4.id, "XML", "Avançado", 85, "2026-04-01");
  await avaliar(c4.id, "REVERSA", "Avançado", 92, "2026-04-01");
  await avaliar(c4.id, "SWAP", "Avançado", 89, "2026-06-10");

  const t1 = await prisma.treinamento.create({
    data: {
      titulo: "Certificação Nokia AirScale Básico",
      categoria: "Certificação Nokia",
      cargaHoraria: 16,
      data: new Date("2026-05-05"),
      instrutor: "Instrutor Nokia - EAD",
    },
  });
  const t2 = await prisma.treinamento.create({
    data: {
      titulo: "NR-10 Segurança em Instalações Elétricas",
      categoria: "Segurança do Trabalho",
      cargaHoraria: 8,
      data: new Date("2026-06-15"),
      instrutor: "SESI",
    },
  });

  await prisma.treinamentoColaborador.create({
    data: { treinamentoId: t1.id, colaboradorId: c1.id, status: "concluído" },
  });
  await prisma.treinamentoColaborador.create({
    data: { treinamentoId: t1.id, colaboradorId: c2.id, status: "pendente" },
  });
  await prisma.treinamentoColaborador.create({
    data: { treinamentoId: t2.id, colaboradorId: c1.id, status: "concluído" },
  });
  await prisma.treinamentoColaborador.create({
    data: { treinamentoId: t2.id, colaboradorId: c3.id, status: "concluído" },
  });

  console.log("Seed concluído com sucesso (PostgreSQL via Prisma, Cadastro Mestre de Colaboradores).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
