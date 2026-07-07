/**
 * Importa dados reais de líderes/equipes/instaladores para o banco.
 * Idempotente: identifica registros já existentes pelo CPF antes de criar,
 * então pode ser rodado mais de uma vez sem duplicar.
 *
 * Para adicionar novos líderes/equipes, edite o array `dados` abaixo e rode
 * de novo:
 *   npx tsx scripts/importar-real.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type NovoInstalador = {
  nome: string;
  funcao: string;
  telefone?: string;
  email?: string;
  rg?: string;
  cpf?: string;
};

type NovaEquipe = {
  nomeEquipe: string;
  lider: {
    nome: string;
    cargo?: string;
    telefone?: string;
    email?: string;
    rg?: string;
    cpf?: string;
  };
  instaladores: NovoInstalador[];
};

const dados: NovaEquipe[] = [
  {
    nomeEquipe: "Equipe Darwin",
    lider: {
      nome: "Armando Javier Guardia Rodriguez",
      cargo: "Líder (Supervisor de Campo)",
      telefone: "11 99456-4475",
      email: "armandojgr05@gmail.com",
      rg: "G457461-2",
      cpf: "240.310.828-60",
    },
    instaladores: [
      {
        nome: "Darwin Antonio Valero Hernandes",
        funcao: "Instalador",
        telefone: "45 98806-0967",
        email: "darwinvalero@gmail.com",
        rg: "G4708287",
        cpf: "241.378.768-27",
      },
      {
        nome: "Erwin Eduardo Paez Villanueva",
        funcao: "Instalador",
        telefone: "11 94584-6069",
        email: "erwincosopaez55@gmail.com",
        rg: "F028544-A",
        cpf: "241.474.508-81",
      },
    ],
  },
  {
    nomeEquipe: "Equipe Cristiano",
    lider: {
      nome: "Cristiano Batista de Santana",
      cargo: "Líder (Supervisor de Campo)",
      telefone: "11 99200-9279",
      email: "junior.batista.1984@outlook.com",
      rg: "12073852",
      cpf: "020.526.315-18",
    },
    instaladores: [
      {
        nome: "Diogenes Alves Brito",
        funcao: "Instalador",
        telefone: "11 98557-5607",
        email: "diogenesalvesbrito30@gmail.com",
        rg: "481438129",
        cpf: "391.480.708-31",
      },
      {
        nome: "Jose Carlos Caitano",
        funcao: "Instalador",
        telefone: "11 98267-4586",
        email: "jcaitano@gmail.com",
        rg: "33.688.781-4",
        cpf: "354.748.198-89",
      },
    ],
  },
];

async function main() {
  for (const grupo of dados) {
    let lider = grupo.lider.cpf
      ? await prisma.leader.findFirst({ where: { cpf: grupo.lider.cpf } })
      : null;

    if (!lider) {
      lider = await prisma.leader.create({ data: grupo.lider });
      console.log(`Líder criado: ${lider.nome} (id ${lider.id})`);
    } else {
      console.log(`Líder já existia: ${lider.nome} (id ${lider.id})`);
    }

    let equipe = await prisma.equipe.findFirst({ where: { nome: grupo.nomeEquipe } });
    if (!equipe) {
      equipe = await prisma.equipe.create({
        data: { nome: grupo.nomeEquipe, leaderId: lider.id },
      });
      console.log(`Equipe criada: ${equipe.nome} (id ${equipe.id})`);
    } else {
      console.log(`Equipe já existia: ${equipe.nome} (id ${equipe.id})`);
    }

    for (const inst of grupo.instaladores) {
      const existente = inst.cpf
        ? await prisma.colaborador.findFirst({ where: { cpf: inst.cpf } })
        : null;

      if (!existente) {
        const criado = await prisma.colaborador.create({
          data: { ...inst, equipeId: equipe.id, status: "ativo" },
        });
        console.log(`Colaborador criado: ${criado.nome} (id ${criado.id})`);
      } else {
        console.log(`Colaborador já existia: ${existente.nome} (id ${existente.id})`);
      }
    }
  }

  console.log("Importação concluída.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
