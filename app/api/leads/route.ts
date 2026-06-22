import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Texto e versão do consentimento exibido na LP (trilha de auditoria LGPD).
const CONSENT_VERSION = '2026-06';
const CONSENT_TEXT =
  'Autorizo a ÍRIS a entrar em contato por telefone, WhatsApp e e-mail sobre o lançamento ' +
  'da plataforma, e declaro concordância com o tratamento dos meus dados nos termos da ' +
  'Política de Privacidade. Esta autorização pode ser revogada a qualquer momento.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rate limit best-effort em memória (suficiente em single instance).
const hits = new Map<string, { count: number; ts: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.ts > WINDOW_MS) {
    hits.set(ip, { count: 1, ts: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: NextRequest) {
  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ status: 'error', message: 'JSON inválido' }, { status: 400 });
  }

  // Honeypot: bots preenchem o campo escondido → finge sucesso e descarta.
  if (typeof data.website === 'string' && data.website.trim() !== '') {
    return NextResponse.json({ status: 'ok' }, { status: 201 });
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { status: 'error', message: 'Muitas tentativas. Aguarde um momento.' },
      { status: 429 },
    );
  }

  const nome = String(data.nome ?? '').trim();
  const empresa = String(data.empresa ?? '').trim();
  const email = String(data.email ?? '').trim().toLowerCase();
  const telefone = String(data.telefone ?? '').trim();
  const cargo = String(data.cargo ?? '').trim();
  const optin = data.optin === true;

  if (!nome || !empresa || !email || !telefone || !cargo || !optin || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { status: 'error', message: 'Dados inválidos ou incompletos.' },
      { status: 400 },
    );
  }

  try {
    await ensureSchema();
    await pool.query(
      `INSERT INTO leads
         (nome, empresa, email, telefone, cargo, optin, consent_text, consent_version, origem, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        nome,
        empresa,
        email,
        telefone,
        cargo,
        optin,
        CONSENT_TEXT,
        CONSENT_VERSION,
        'lp-enacor-2026',
        ip,
        req.headers.get('user-agent') ?? null,
      ],
    );
    return NextResponse.json({ status: 'ok' }, { status: 201 });
  } catch (err) {
    console.error('[leads] erro ao inserir:', err);
    return NextResponse.json({ status: 'error', message: 'Erro interno.' }, { status: 500 });
  }
}
