// Cabeçalhos de segurança e CSP calibrados para o que o SGA realmente usa:
// - ícones via cdn.jsdelivr.net (bootstrap-icons);
// - fonte Satoshi servida pelo próprio site (public/assets/fonts), sem CDN;
// - estilos inline em toda parte (o ui-kit é `style={{...}}` do começo ao
//   fim, não CSS-in-JS gerado), por isso style-src precisa de
//   'unsafe-inline';
// - o Next injeta scripts inline em desenvolvimento (HMR) e também em
//   produção (bootstrap, __NEXT_DATA__) — 'unsafe-inline' em script-src é o
//   pragmático aqui, já que não há nonce configurado.
//
// 'unsafe-eval' só em desenvolvimento: é o webpack (HMR e source maps que
// usam eval) que precisa dele. O bundle de produção não.
const scriptSrc = ["'self'", "'unsafe-inline'"];
if (process.env.NODE_ENV !== "production") {
  scriptSrc.push("'unsafe-eval'");
}

const emProducao = process.env.NODE_ENV === "production";

// `frame-ancestors 'none'` impede que qualquer iframe exiba o app. Em
// desenvolvimento fica 'self': o painel de preview do editor embute a página
// num iframe e, bloqueado, lê isso como "não carregou" e entra em laço de
// reload.
const cspDirectives = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' https://cdn.jsdelivr.net data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  emProducao ? "frame-ancestors 'none'" : "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          ...(emProducao ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
          // HSTS só em produção: em http://localhost ele forçaria o navegador
          // a tentar HTTPS numa porta sem certificado, travando o acesso.
          //
          // Sem `preload` de propósito — entrar na lista de preload dos
          // navegadores é praticamente irreversível. Sem `includeSubDomains`
          // também, porque não há confirmação de que todo subdomínio de
          // setegce.com serve HTTPS. Seis meses de max-age já é um
          // endurecimento real sem esses riscos.
          ...(emProducao ? [{ key: "Strict-Transport-Security", value: "max-age=15552000" }] : []),
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
