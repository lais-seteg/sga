export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "80px 20px",
        color: "var(--text-muted)",
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      <i className="bi bi-arrow-repeat" style={{ fontSize: 16, animation: "stt-pulse 1s ease-in-out infinite" }} />
      Carregando...
    </div>
  );
}
