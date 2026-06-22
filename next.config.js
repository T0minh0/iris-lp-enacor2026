/** @type {import('next').NextConfig} */
const nextConfig = {
  // Servir a landing page estática (public/index.html) na raiz "/".
  // IMPORTANTE: NÃO usar output: 'export' — isso desativaria as API routes
  // (/api/leads), que é justamente onde gravamos os leads no Postgres.
  async rewrites() {
    return [{ source: '/', destination: '/index.html' }];
  },
};

module.exports = nextConfig;
