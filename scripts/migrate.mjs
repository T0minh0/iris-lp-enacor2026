// Migração idempotente do schema, executada NO DEPLOY antes do `next start`.
// Nixpacks não tem release phase, então o start command roda este script primeiro
// (package.json: "start": "npm run migrate && next start ...").
//
// - Lê o SQL canônico de db/schema.sql (CREATE TABLE/INDEX IF NOT EXISTS — idempotente).
// - Faz retry: o Postgres pode ainda estar subindo quando o app deploya.
// - Fail-fast: se o banco não ficar acessível, sai com código !=0 e o deploy falha
//   (o Coolify mantém a versão anterior no ar) — garante que o schema existe antes de servir.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrate] DATABASE_URL não definido — abortando o start.');
  process.exit(1);
}

const sql = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const ssl = process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined;

const MAX_ATTEMPTS = 10;
const DELAY_MS = 3000;

async function run() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const client = new pg.Client({ connectionString: url, ssl });
    try {
      await client.connect();
      await client.query(sql);
      await client.end();
      console.log('[migrate] schema aplicado com sucesso.');
      return;
    } catch (err) {
      await client.end().catch(() => {});
      console.error(`[migrate] tentativa ${attempt}/${MAX_ATTEMPTS} falhou: ${err.message}`);
      if (attempt === MAX_ATTEMPTS) {
        console.error('[migrate] esgotadas as tentativas — abortando o deploy.');
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
}

run();
