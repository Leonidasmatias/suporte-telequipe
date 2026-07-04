import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "suporte-telequipe.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: Database.Database | undefined;
}

function createConnection(): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export const db = globalThis.__db ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalThis.__db = db;
}

/**
 * Schema do SUPORTE TELEQUIPE.
 * Estrutura pensada para operação de campo em telecom e preparada
 * para o cálculo do IMT (Índice de Maturidade Técnica), derivado da
 * matriz de etapas Nokia (MOS, XML, TX, SWAP, FAM, REVERSA) por colaborador.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS lideres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cargo TEXT,
    regional TEXT,
    telefone TEXT,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS equipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    regional TEXT,
    lider_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (lider_id) REFERENCES lideres(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS colaboradores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    funcao TEXT,
    equipe_id INTEGER,
    telefone TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'ativo',
    data_admissao TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS treinamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    categoria TEXT,
    carga_horaria INTEGER,
    data_realizacao TEXT,
    instrutor TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS treinamento_colaboradores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    treinamento_id INTEGER NOT NULL,
    colaborador_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    FOREIGN KEY (treinamento_id) REFERENCES treinamentos(id) ON DELETE CASCADE,
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
  );
`);

/**
 * Migração V1 -> V2: a matriz Nokia passa a usar uma etapa fixa
 * (MOS, XML, TX, SWAP, FAM, REVERSA) em vez de texto livre, para
 * permitir o motor de gargalo operacional e o cálculo de tendência.
 * Bancos V1 existentes (coluna "competencia") são migrados automaticamente.
 */
function migrarMatrizNokia() {
  const colunas = db.prepare("PRAGMA table_info(matriz_nokia)").all() as { name: string }[];
  const existeTabela = colunas.length > 0;
  const temEtapa = colunas.some((c) => c.name === "etapa");
  const temCompetencia = colunas.some((c) => c.name === "competencia");

  if (existeTabela && temCompetencia && !temEtapa) {
    db.exec("ALTER TABLE matriz_nokia RENAME TO matriz_nokia_legacy_v1");

    db.exec(`
      CREATE TABLE matriz_nokia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        colaborador_id INTEGER NOT NULL,
        etapa TEXT NOT NULL CHECK (etapa IN ('MOS','XML','TX','SWAP','FAM','REVERSA')),
        nivel TEXT NOT NULL DEFAULT 'Não certificado',
        imt_score INTEGER NOT NULL DEFAULT 0,
        data_avaliacao TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
      );
    `);

    const guessEtapa = (texto: string): string => {
      const t = texto.toLowerCase();
      if (t.includes("swap")) return "SWAP";
      if (t.includes("xml")) return "XML";
      if (t.includes("revers")) return "REVERSA";
      if (t.includes("transmiss") || t.includes(" tx") || t.includes("rádio") || t.includes("radio")) return "TX";
      if (t.includes("famil") || t.includes("diagnóstic") || t.includes("diagnostic")) return "FAM";
      return "MOS";
    };

    const legado = db.prepare("SELECT * FROM matriz_nokia_legacy_v1").all() as Array<Record<string, unknown>>;
    const inserir = db.prepare(
      `INSERT INTO matriz_nokia (colaborador_id, etapa, nivel, imt_score, data_avaliacao, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const linha of legado) {
      inserir.run(
        linha.colaborador_id as number,
        guessEtapa(String(linha.competencia ?? "")),
        linha.nivel as string,
        linha.imt_score as number,
        linha.data_avaliacao as string | null,
        linha.created_at as string
      );
    }

    db.exec("DROP TABLE matriz_nokia_legacy_v1");
  }
}

migrarMatrizNokia();

db.exec(`
  CREATE TABLE IF NOT EXISTS matriz_nokia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    colaborador_id INTEGER NOT NULL,
    etapa TEXT NOT NULL CHECK (etapa IN ('MOS','XML','TX','SWAP','FAM','REVERSA')),
    nivel TEXT NOT NULL DEFAULT 'Não certificado',
    imt_score INTEGER NOT NULL DEFAULT 0,
    data_avaliacao TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_matriz_colaborador_etapa ON matriz_nokia(colaborador_id, etapa);
`);

export default db;
