/**
 * Popula o banco com dados de exemplo para facilitar a primeira execução.
 * Inclui histórico de avaliações da Matriz Nokia ao longo do tempo, para
 * já demonstrar tendência, gargalo operacional e sugestões automáticas.
 * Rode com: npm run seed
 */
import { db } from "./db";

const countRow = db.prepare("SELECT COUNT(*) as c FROM lideres").get() as { c: number };

if (countRow.c > 0) {
  console.log("Banco já contém dados. Seed ignorado.");
  process.exit(0);
}

const insertLider = db.prepare(
  `INSERT INTO lideres (nome, cargo, regional, telefone, email) VALUES (?, ?, ?, ?, ?)`
);
const l1 = insertLider.run("Carlos Menezes", "Coordenador de Campo", "Regional Sul", "(51) 99811-2233", "carlos.menezes@telequipe.com");
const l2 = insertLider.run("Ana Beatriz Souza", "Supervisora Técnica", "Regional Sudeste", "(11) 98212-4455", "ana.souza@telequipe.com");

const insertEquipe = db.prepare(
  `INSERT INTO equipes (nome, regional, lider_id) VALUES (?, ?, ?)`
);
const e1 = insertEquipe.run("Equipe Alfa - Instalações", "Regional Sul", l1.lastInsertRowid);
const e2 = insertEquipe.run("Equipe Bravo - Manutenção", "Regional Sudeste", l2.lastInsertRowid);

const insertColaborador = db.prepare(
  `INSERT INTO colaboradores (nome, funcao, equipe_id, telefone, email, status, data_admissao) VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const c1 = insertColaborador.run("João Pedro Lima", "Técnico de Campo", e1.lastInsertRowid, "(51) 99123-0001", "joao.lima@telequipe.com", "ativo", "2023-02-10");
const c2 = insertColaborador.run("Marcos Vinícius", "Técnico Instalador", e1.lastInsertRowid, "(51) 99123-0002", "marcos.vinicius@telequipe.com", "ativo", "2022-11-03");
const c3 = insertColaborador.run("Fernanda Rocha", "Técnica de Manutenção", e2.lastInsertRowid, "(11) 99123-0003", "fernanda.rocha@telequipe.com", "ativo", "2024-01-20");
const c4 = insertColaborador.run("Rafael Torres", "Técnico de Manutenção", e2.lastInsertRowid, "(11) 99123-0004", "rafael.torres@telequipe.com", "ativo", "2023-08-15");

const insertMatriz = db.prepare(
  `INSERT INTO matriz_nokia (colaborador_id, etapa, nivel, imt_score, data_avaliacao) VALUES (?, ?, ?, ?, ?)`
);

// João Pedro Lima — bom desempenho, tendência de alta
insertMatriz.run(c1.lastInsertRowid, "MOS", "Intermediário", 75, "2026-02-01");
insertMatriz.run(c1.lastInsertRowid, "MOS", "Avançado", 90, "2026-05-10");
insertMatriz.run(c1.lastInsertRowid, "XML", "Intermediário", 80, "2026-02-01");
insertMatriz.run(c1.lastInsertRowid, "XML", "Avançado", 88, "2026-05-10");
insertMatriz.run(c1.lastInsertRowid, "TX", "Avançado", 85, "2026-05-10");
insertMatriz.run(c1.lastInsertRowid, "SWAP", "Intermediário", 82, "2026-05-10");

// Marcos Vinícius — gargalo em SWAP, tendência de queda
insertMatriz.run(c2.lastInsertRowid, "MOS", "Intermediário", 80, "2026-02-15");
insertMatriz.run(c2.lastInsertRowid, "MOS", "Básico", 65, "2026-05-20");
insertMatriz.run(c2.lastInsertRowid, "SWAP", "Básico", 72, "2026-02-15");
insertMatriz.run(c2.lastInsertRowid, "SWAP", "Não certificado", 58, "2026-05-20");
insertMatriz.run(c2.lastInsertRowid, "XML", "Básico", 70, "2026-05-20");

// Fernanda Rocha — gargalo em FAM
insertMatriz.run(c3.lastInsertRowid, "FAM", "Básico", 60, "2026-03-01");
insertMatriz.run(c3.lastInsertRowid, "FAM", "Não certificado", 45, "2026-06-01");
insertMatriz.run(c3.lastInsertRowid, "TX", "Intermediário", 75, "2026-03-01");
insertMatriz.run(c3.lastInsertRowid, "TX", "Avançado", 80, "2026-06-01");
insertMatriz.run(c3.lastInsertRowid, "REVERSA", "Avançado", 88, "2026-06-01");

// Rafael Torres — bom desempenho geral
insertMatriz.run(c4.lastInsertRowid, "MOS", "Avançado", 90, "2026-04-01");
insertMatriz.run(c4.lastInsertRowid, "XML", "Avançado", 85, "2026-04-01");
insertMatriz.run(c4.lastInsertRowid, "REVERSA", "Avançado", 92, "2026-04-01");
insertMatriz.run(c4.lastInsertRowid, "SWAP", "Avançado", 89, "2026-06-10");

const insertTreinamento = db.prepare(
  `INSERT INTO treinamentos (nome, categoria, carga_horaria, data_realizacao, instrutor) VALUES (?, ?, ?, ?, ?)`
);
const t1 = insertTreinamento.run("Certificação Nokia AirScale Básico", "Certificação Nokia", 16, "2026-05-05", "Instrutor Nokia - EAD");
const t2 = insertTreinamento.run("NR-10 Segurança em Instalações Elétricas", "Segurança do Trabalho", 8, "2026-06-15", "SESI");

const insertVinculo = db.prepare(
  `INSERT INTO treinamento_colaboradores (treinamento_id, colaborador_id, status) VALUES (?, ?, ?)`
);
insertVinculo.run(t1.lastInsertRowid, c1.lastInsertRowid, "concluído");
insertVinculo.run(t1.lastInsertRowid, c2.lastInsertRowid, "pendente");
insertVinculo.run(t2.lastInsertRowid, c1.lastInsertRowid, "concluído");
insertVinculo.run(t2.lastInsertRowid, c3.lastInsertRowid, "concluído");

console.log("Seed concluído com sucesso (com histórico temporal de IMT).");
