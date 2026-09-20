"use client";

// Tela de login no mesmo padrão visual do ClockRView, do 7Station e do
// Controle de Folgas (pacote 7station-design-system, Page_Login.tsx/css) —
// adaptada ao SGA. É a mudança mais visível desta versão: o sistema deixou
// de ser uma tela pública com um botão "Gestor" e passou a exigir conta.

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "./Page_Login.css";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessaoInvalida = searchParams.get("sessao") === "invalida";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(
    sessaoInvalida ? "Sua sessão expirou. Entre novamente." : null
  );
  const [carregando, setCarregando] = useState(false);

  // Chegar aqui com `?sessao=invalida` significa que o cookie tinha
  // assinatura válida mas apontava para uma conta que não vale mais
  // (desativada ou apagada) — ver middleware.ts e lib/session.ts. O
  // middleware não consegue limpar esse cookie (roda em Edge, sem tocar o
  // banco); só uma route handler pode, daí o fetch.
  useEffect(() => {
    if (sessaoInvalida) {
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!email.trim()) {
      setErro("Informe seu e-mail corporativo.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErro("Digite um e-mail válido.");
      return;
    }
    if (!senha) {
      setErro("Informe sua senha.");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || "E-mail ou senha incorretos.");
        return;
      }
      router.push("/solicitacoes");
      router.refresh();
    } catch {
      setErro("Falha de conexão. Verifique sua internet e tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-page">

      {/* ═══ ESQUERDA: MARCA ═══ */}
      <div className="lp-brand">
        <svg className="lp-bracket lp-bracket-tl" viewBox="0 0 14 14"><path d="M0 0 L14 0 M0 0 L0 14" stroke="#ff8200" strokeWidth="1.5" fill="none" /></svg>
        <svg className="lp-bracket lp-bracket-bl" viewBox="0 0 14 14"><path d="M0 0 L14 0 M0 0 L0 14" stroke="#ff8200" strokeWidth="1.5" fill="none" /></svg>
        <div className="lp-brand-line" />

        <div className="lp-brand-center">
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-bar" />
            Módulo corporativo
          </div>

          <div className="lp-logo-wrap">
            <div className="lp-logo-halo-orange" />
            <div className="lp-logo-halo-blue" />
            <img className="lp-logo-img" src="/seteg-negativo.png" alt="Seteg" />
          </div>

          <h1 className="lp-tagline">Solicitação de peças gráficas.</h1>
          <p className="lp-description">
            Comunicados, posts, banners, cartazes e apresentações —<br />
            do pedido à entrega, acompanhados num só lugar.
          </p>

          <div className="lp-module-tag" style={{ marginTop: 24 }}>
            <i className="bi bi-palette" />
            SGA — PEÇAS GRÁFICAS
          </div>
        </div>

        <div className="lp-brand-bottom">
          <div className="lp-contacts">
            <a href="tel:+5585213052063"><i className="bi bi-telephone" />+55 (85) 2130-5263</a>
            <span className="lp-contacts-divider" />
            <a href="mailto:contato@setegce.com"><i className="bi bi-envelope" />contato@setegce.com</a>
          </div>
        </div>
      </div>

      {/* ═══ DIREITA: FORMULÁRIO ═══ */}
      <div className="lp-form">
        <svg className="lp-bracket lp-bracket-tr" viewBox="0 0 14 14"><path d="M0 0 L14 0 M0 0 L0 14" stroke="#ff8200" strokeWidth="1.5" fill="none" /></svg>
        <svg className="lp-bracket lp-bracket-br" viewBox="0 0 14 14"><path d="M0 0 L14 0 M0 0 L0 14" stroke="#ff8200" strokeWidth="1.5" fill="none" /></svg>

        <div className="lp-form-center">
          <div className="lp-form-inner">
            <h1 className="lp-form-title">Acesse sua conta</h1>
            <p className="lp-form-subtitle">
              Entre com o e-mail e a senha fornecidos<br />
              pelo administrador do sistema.
            </p>

            <form className="lp-fields" onSubmit={handleSubmit} noValidate>
              <label className="lp-field">
                <span className="lp-field-label">E-mail corporativo</span>
                <div className="lp-field-control">
                  <i className="bi bi-envelope lp-field-icon" />
                  <input
                    type="email"
                    placeholder="seu.nome@setegce.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    disabled={carregando}
                  />
                </div>
              </label>

              <label className="lp-field">
                <span className="lp-field-label">Senha</span>
                <div className="lp-field-control">
                  <i className="bi bi-lock lp-field-icon" />
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    placeholder="Sua senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    disabled={carregando}
                  />
                  <button
                    type="button"
                    className="lp-toggle-eye"
                    onClick={() => setMostrarSenha((v) => !v)}
                    aria-label="Mostrar ou ocultar a senha"
                  >
                    <i className={`bi ${mostrarSenha ? "bi-eye-slash" : "bi-eye"}`} />
                  </button>
                </div>
              </label>

              {erro && (
                <div className="lp-error">
                  <i className="bi bi-exclamation-circle-fill" />
                  {erro}
                </div>
              )}

              <button type="submit" className="lp-btn-submit" disabled={carregando}>
                {carregando ? "Entrando..." : "Entrar"}
                {!carregando && <i className="bi bi-arrow-right" />}
              </button>
            </form>

            <div className="lp-trust">
              <span><i className="bi bi-shield-lock i-green" />Conexão criptografada</span>
              <span>© 2026 Seteg</span>
            </div>

            <div className="lp-first-access">
              <i className="bi bi-info-circle-fill" />
              <div>
                <div className="lp-first-access-title">Primeiro acesso?</div>
                <div className="lp-first-access-text">
                  Solicite suas credenciais ao{" "}
                  <a href="mailto:ti@setegce.com">administrador do sistema</a>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// `useSearchParams` obriga a um limite de Suspense para o Next.js conseguir
// pré-renderizar a rota; sem isso o build falha.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
