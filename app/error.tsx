"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "80px 20px",
        textAlign: "center",
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--red-15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <i className="bi bi-exclamation-triangle-fill" style={{ fontSize: 22, color: "var(--red)" }} />
      </span>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>Algo deu errado</h1>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", maxWidth: 420, lineHeight: 1.6 }}>
        Nenhuma solicitação foi perdida — os dados continuam no banco. Tente de novo; se
        insistir, avise a TI (ti@setegce.com).
      </p>
      <button
        onClick={reset}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          height: 38,
          padding: "0 16px",
          borderRadius: "var(--r-btn)",
          border: "1px solid var(--orange)",
          background: "var(--orange)",
          color: "#fff",
          fontFamily: "inherit",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <i className="bi bi-arrow-clockwise" />
        Tentar de novo
      </button>
    </div>
  );
}
