import { Pool } from 'pg';

// Singleton do Pool em globalThis: evita esgotar conexões no hot-reload do dev
// e reaproveita o pool entre invocações das route handlers em produção.
const globalForPg = globalThis as unknown as {
  pgPool?: Pool;
  schemaReady?: Promise<void>;
};

const useSsl = process.env.PGSSL === 'true';

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });

if (!globalForPg.pgPool) globalForPg.pgPool = pool;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome            TEXT NOT NULL,
  empresa         TEXT NOT NULL,
  email           TEXT NOT NULL,
  telefone        TEXT NOT NULL,
  cargo           TEXT NOT NULL,
  optin           BOOLEAN NOT NULL DEFAULT FALSE,
  consent_text    TEXT,
  consent_version TEXT,
  origem          TEXT,
  ip              TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
`;

/**
 * Garante o schema uma única vez por processo (idempotente).
 * Substitui a necessidade de migrations — adequado para uma única tabela
 * e simplifica o deploy no Nixpacks/Coolify (sem release phase).
 */
export function ensureSchema(): Promise<void> {
  if (!globalForPg.schemaReady) {
    globalForPg.schemaReady = pool.query(SCHEMA).then(() => undefined);
  }
  return globalForPg.schemaReady;
}
