-- Tabela de leads da LP ÍRIS.
-- A aplicação cria esta tabela automaticamente no 1º POST (lib/db.ts → ensureSchema()).
-- Este arquivo é mantido para referência / execução manual (psql, DBeaver, TablePlus).

CREATE TABLE IF NOT EXISTS leads (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome            TEXT NOT NULL,
  empresa         TEXT NOT NULL,
  email           TEXT NOT NULL,
  telefone        TEXT NOT NULL,
  cargo           TEXT NOT NULL,
  optin           BOOLEAN NOT NULL DEFAULT FALSE,
  consent_text    TEXT,          -- texto do opt-in aceito (auditoria LGPD)
  consent_version TEXT,          -- versão do texto de consentimento
  origem          TEXT,          -- de qual página/campanha veio
  ip              TEXT,          -- IP de origem (x-forwarded-for)
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);

-- Consulta útil para acompanhar as inscrições:
--   SELECT created_at, nome, empresa, email, telefone, cargo FROM leads ORDER BY created_at DESC;
