"use client";

// Gestão de Acessos — quem entra no SGA, com que perfil, e o botão para
// trocar a senha de alguém.
//
// Esta tela é o que substitui o "mexa no banco à mão" que a versão anterior
// exigia: trocar um código de acesso era um UPDATE com `crypt()` escrito no
// SQL Editor do Supabase. Agora é um campo e um botão, e fica auditado em
// system_logs.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Papel } from "@prisma/client";
import {
  Btn,
  CFAlert,
  CFEmptyState,
  CFField,
  CFModal,
  CFPageHeader,
  CFSelect,
  CFSwitch,
  Toast,
  ToastTone,
} from "@/app/components/ui-kit";
import { initialsFromName } from "@/app/components/ui-helpers";
import Paginacao, { ITENS_POR_PAGINA_PADRAO } from "@/app/components/Paginacao";
import { SETORES } from "@/lib/solicitacaoListas";

export interface UsuarioLinha {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  setor: string | null;
  /** Permissão de mexer em contas — separada do papel. Só quem a tem enxerga
   *  esta tela. */
  gerenciaAcessos: boolean;
  /** ISO completo, ou null para quem nunca entrou. */
  ultimoAcessoEm: string | null;
  solicitacoes: number;
}

const PAPEL_OPTIONS = [
  { value: Papel.colaborador, label: "Colaborador — abre e acompanha os próprios pedidos" },
  { value: Papel.admin, label: "Admin — vê todas as solicitações e move a fila" },
];

const SETOR_OPTIONS = [
  { value: "", label: "Sem setor definido" },
  ...SETORES.map((s) => ({ value: s as string, label: s as string })),
];

// Cabecalho e conteudo centralizados, por pedido da Seteg.
const TH: React.CSSProperties = {
  textAlign: "center",
  padding: "12px 18px",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "var(--text-faint)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "var(--row-py, 12px) 18px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text)",
  fontSize: 13.5,
  textAlign: "center",
};

function formatarUltimoAcesso(iso: string | null): string {
  if (!iso) return "Nunca entrou";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function UsuariosClient({
  usuarios,
  usuarioAtualId,
}: {
  usuarios: UsuarioLinha[];
  usuarioAtualId: string;
}) {
  const router = useRouter();

  // Padrão "todos", de propósito.
  //
  // Já foi "ativos", e estava errado: desativar alguém fazia o cadastro sumir
  // da tela, indistinguível de ter sido apagado — e não havia como reativar
  // sem antes descobrir que existia um filtro escondendo a pessoa. Desativar
  // é uma operação reversível, então o cadastro tem de continuar à vista.
  // Os filtros seguem aí para quem quiser recortar a lista.
  const [situacao, setSituacao] = useState<"ativos" | "inativos" | "todos">("todos");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(ITENS_POR_PAGINA_PADRAO);

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<UsuarioLinha | null>(null);
  const [trocandoSenha, setTrocandoSenha] = useState<UsuarioLinha | null>(null);

  const [ocupado, setOcupado] = useState(false);
  const [erroModal, setErroModal] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);

  // Campos dos modais
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>(Papel.colaborador);
  const [setor, setSetor] = useState("");
  const [gerenciaAcessos, setGerenciaAcessos] = useState(false);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (situacao === "ativos" && !u.ativo) return false;
      if (situacao === "inativos" && u.ativo) return false;
      if (!termo) return true;
      return `${u.nome} ${u.email} ${u.setor ?? ""}`.toLowerCase().includes(termo);
    });
  }, [usuarios, situacao, busca]);

  const totalInativos = usuarios.filter((u) => !u.ativo).length;

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const visiveis = filtrados.slice(inicio, inicio + porPagina);

  function abrirCriacao() {
    setNome("");
    setEmail("");
    setSenha("");
    setPapel(Papel.colaborador);
    setSetor("");
    setErroModal(null);
    setCriando(true);
  }

  function abrirEdicao(u: UsuarioLinha) {
    setNome(u.nome);
    setPapel(u.papel);
    setSetor(u.setor ?? "");
    setGerenciaAcessos(u.gerenciaAcessos);
    setErroModal(null);
    setEditando(u);
  }

  function abrirTrocaSenha(u: UsuarioLinha) {
    setSenha("");
    setErroModal(null);
    setTrocandoSenha(u);
  }

  async function chamar(url: string, metodo: "POST" | "PATCH", corpo: object): Promise<boolean> {
    setOcupado(true);
    setErroModal(null);
    try {
      const res = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErroModal(data.error || "Não foi possível concluir a operação.");
        return false;
      }
      return true;
    } catch {
      setErroModal("Falha de rede. Tente de novo.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function criar() {
    const ok = await chamar("/api/usuarios", "POST", {
      nome,
      email,
      senha,
      papel,
      setor: setor || null,
    });
    if (!ok) return;
    setCriando(false);
    setToast({ message: `Conta de ${nome} criada.`, tone: "success" });
    router.refresh();
  }

  async function salvarEdicao() {
    if (!editando) return;
    const ok = await chamar(`/api/usuarios/${editando.id}`, "PATCH", {
      nome,
      papel,
      setor: setor || null,
      gerenciaAcessos,
    });
    if (!ok) return;
    setEditando(null);
    setToast({ message: "Conta atualizada.", tone: "success" });
    router.refresh();
  }

  async function salvarSenha() {
    if (!trocandoSenha) return;
    const ok = await chamar(`/api/usuarios/${trocandoSenha.id}`, "PATCH", { senha });
    if (!ok) return;
    const nomeAlvo = trocandoSenha.nome;
    setTrocandoSenha(null);
    setSenha("");
    setToast({ message: `Senha de ${nomeAlvo} redefinida.`, tone: "success" });
    router.refresh();
  }

  async function alternarAtivo(u: UsuarioLinha) {
    setOcupado(true);
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ message: data.error || "Não foi possível alterar a situação.", tone: "error" });
        return;
      }
      setToast({
        message: u.ativo ? `Acesso de ${u.nome} desativado.` : `Acesso de ${u.nome} reativado.`,
        tone: "success",
      });
      router.refresh();
    } catch {
      setToast({ message: "Falha de rede.", tone: "error" });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 56px)" }}>
      <CFPageHeader
        title="Gestão de Acessos"
        subtitle="Quem entra no SGA, com qual perfil e com qual senha. Desativar bloqueia o acesso sem apagar nada: o cadastro continua na lista e pode ser reativado a qualquer momento. O e-mail é a identidade da conta e não muda."
        actions={<Btn icon="bi-person-plus" onClick={abrirCriacao}>Nova conta</Btn>}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(
            [
              ["ativos", `Ativos (${usuarios.length - totalInativos})`],
              ["inativos", `Inativos (${totalInativos})`],
              ["todos", `Todos (${usuarios.length})`],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                setSituacao(valor);
                setPagina(1);
              }}
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: "var(--r-pill)",
                border: `1px solid ${situacao === valor ? "var(--orange)" : "var(--border)"}`,
                background: situacao === valor ? "var(--orange-15)" : "var(--surface)",
                color: situacao === valor ? "var(--orange)" : "var(--text-muted)",
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: "var(--field-h, 40px)",
            padding: "0 12px",
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--r-md)",
            minWidth: 260,
          }}
        >
          <i className="bi bi-search" style={{ fontSize: 12.5, color: "var(--text-faint)" }} />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por nome, e-mail ou setor..."
            aria-label="Buscar contas"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: 13,
              color: "var(--text)",
              minWidth: 0,
            }}
          />
        </div>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card)",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
          // Cresce para ocupar a altura que sobra, com o rodapé de paginação
          // ancorado na base — ver o mesmo padrão em SolicitacoesClient.
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 260,
        }}
      >
        {filtrados.length === 0 ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CFEmptyState icon="bi-people" title="Nenhuma conta com esses filtros" />
          </div>
        ) : (
          <div style={{ flex: 1, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={TH}>Colaborador</th>
                  <th style={TH}>Setor</th>
                  <th style={TH}>Perfil</th>
                  <th style={TH}>Pedidos</th>
                  <th style={TH}>Último acesso</th>
                  <th style={TH}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((u) => (
                  <tr key={u.id} style={{ opacity: u.ativo ? 1 : 0.72 }}>
                    {/* A única coluna alinhada à esquerda. Nome, e-mail e
                        avatar são de larguras muito diferentes, e centrados
                        deixavam a coluna com a borda esquerda serrilhada —
                        o olho perde a linha ao descer a lista. O cabeçalho
                        "Colaborador" continua centralizado, como os demais. */}
                    <td style={{ ...TD, textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: u.ativo
                              ? "linear-gradient(135deg, var(--orange), rgba(255,130,0,0.75))"
                              : "var(--surface-sunken)",
                            color: u.ativo ? "#fff" : "var(--text-faint)",
                            fontSize: 12,
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {initialsFromName(u.nome)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {u.nome}
                            {u.id === usuarioAtualId && (
                              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--orange)", fontWeight: 700 }}>
                                você
                              </span>
                            )}
                            {/* Selo explícito, e não só a linha esmaecida: uma
                                linha mais clara pode passar por detalhe de
                                estilo, um selo escrito não. */}
                            {!u.ativo && (
                              <span
                                title="Esta pessoa não consegue entrar no sistema. O cadastro continua aqui e pode ser reativado."
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  marginLeft: 8,
                                  padding: "2px 8px",
                                  borderRadius: "var(--r-pill)",
                                  background: "var(--red-15)",
                                  color: "var(--red)",
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  verticalAlign: "middle",
                                }}
                              >
                                <i className="bi bi-slash-circle" style={{ fontSize: 9.5 }} />
                                Inativo
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={TD}>
                      {u.setor ?? <span style={{ color: "var(--text-faint)" }}>—</span>}
                    </td>
                    <td style={TD}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "3px 9px",
                          borderRadius: "var(--r-pill)",
                          background: u.papel === Papel.admin ? "var(--orange-15)" : "var(--surface-sunken)",
                          color: u.papel === Papel.admin ? "var(--orange)" : "var(--text-muted)",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        <i className={`bi ${u.papel === Papel.admin ? "bi-shield-lock-fill" : "bi-person"}`} style={{ fontSize: 10 }} />
                        {u.papel === Papel.admin ? "Admin" : "Colaborador"}
                      </span>
                      {u.gerenciaAcessos && (
                        <span
                          title="Pode criar contas, trocar senhas e desativar acessos"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            marginLeft: 6,
                            padding: "3px 8px",
                            borderRadius: "var(--r-pill)",
                            background: "var(--blue-15)",
                            color: "var(--blue)",
                            fontSize: 10.5,
                            fontWeight: 700,
                          }}
                        >
                          <i className="bi bi-key-fill" style={{ fontSize: 9.5 }} />
                          Acessos
                        </span>
                      )}
                    </td>
                    <td style={{ ...TD, fontVariantNumeric: "tabular-nums" }}>{u.solicitacoes}</td>
                    <td style={{ ...TD, fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {formatarUltimoAcesso(u.ultimoAcessoEm)}
                    </td>
                    <td style={{ ...TD, whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <Btn size="sm" variant="secondary" icon="bi-pencil" onClick={() => abrirEdicao(u)}>
                          Editar
                        </Btn>
                        <Btn size="sm" variant="secondary" icon="bi-key" onClick={() => abrirTrocaSenha(u)}>
                          Senha
                        </Btn>
                        <Btn
                          size="sm"
                          variant={u.ativo ? "danger-ghost" : "ghost"}
                          icon={u.ativo ? "bi-person-slash" : "bi-person-check"}
                          disabled={ocupado || u.id === usuarioAtualId}
                          title={
                            u.id === usuarioAtualId
                              ? "Você não pode desativar a própria conta"
                              : u.ativo
                                ? "Desativar acesso"
                                : "Reativar acesso"
                          }
                          onClick={() => alternarAtivo(u)}
                        >
                          {u.ativo ? "Desativar" : "Reativar"}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fora do condicional: o rodapé aparece sempre, mesmo com a lista
            filtrada vazia ou com uma única conta. */}
        <Paginacao
          total={filtrados.length}
          inicio={inicio}
          quantidade={visiveis.length}
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          porPagina={porPagina}
          onPagina={setPagina}
          onPorPagina={(n) => {
            setPorPagina(n);
            setPagina(1);
          }}
        />
      </div>

      {/* ─── Nova conta ─── */}
      <CFModal
        open={criando}
        onClose={() => setCriando(false)}
        title="Nova conta"
        hint="A senha é definida aqui e entregue à pessoa por fora do sistema."
        icon="bi-person-plus"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setCriando(false)} disabled={ocupado}>
              Cancelar
            </Btn>
            <Btn icon="bi-check-lg" onClick={criar} disabled={ocupado}>
              {ocupado ? "Criando..." : "Criar conta"}
            </Btn>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {erroModal && <CFAlert tone="danger" icon="bi-exclamation-circle-fill">{erroModal}</CFAlert>}
          <CFField label="Nome completo" required value={nome} onChange={setNome} icon="bi-person" autoFocus />
          <CFField
            label="E-mail corporativo"
            required
            type="email"
            value={email}
            onChange={setEmail}
            icon="bi-envelope"
            placeholder="nome@setegce.com"
            hint="Vira o login e não pode ser alterado depois."
          />
          <CFField
            label="Senha inicial"
            required
            type="password"
            value={senha}
            onChange={setSenha}
            icon="bi-key"
            hint="Mínimo de 12 caracteres — prefira uma frase curta a símbolos."
          />
          <CFSelect label="Perfil" required value={papel} onChange={setPapel} options={PAPEL_OPTIONS} icon="bi-shield" />
          <CFSelect
            label="Setor / área"
            value={setor}
            onChange={setSetor}
            options={SETOR_OPTIONS}
            icon="bi-diagram-3"
            hint="Preenchido, o formulário de solicitação já abre com este setor."
          />
        </div>
      </CFModal>

      {/* ─── Editar conta ─── */}
      <CFModal
        open={editando !== null}
        onClose={() => setEditando(null)}
        title={editando ? `Editar ${editando.nome}` : ""}
        hint={editando?.email}
        icon="bi-pencil"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setEditando(null)} disabled={ocupado}>
              Cancelar
            </Btn>
            <Btn icon="bi-check-lg" onClick={salvarEdicao} disabled={ocupado}>
              {ocupado ? "Salvando..." : "Salvar"}
            </Btn>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {erroModal && <CFAlert tone="danger" icon="bi-exclamation-circle-fill">{erroModal}</CFAlert>}
          <CFField label="Nome completo" required value={nome} onChange={setNome} icon="bi-person" />
          <CFSelect
            label="Perfil"
            required
            value={papel}
            onChange={setPapel}
            options={PAPEL_OPTIONS}
            icon="bi-shield"
            disabled={editando?.id === usuarioAtualId}
            hint={
              editando?.id === usuarioAtualId
                ? "Você não pode remover o próprio perfil de administrador."
                : undefined
            }
          />
          <CFSelect label="Setor / área" value={setor} onChange={setSetor} options={SETOR_OPTIONS} icon="bi-diagram-3" />

          <div
            style={{
              padding: 14,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
            }}
          >
            <CFSwitch
              checked={gerenciaAcessos}
              onChange={setGerenciaAcessos}
              label="Pode gerenciar acessos"
              // Só admin pode receber a permissão, e ninguém tira a própria:
              // as duas regras são validadas de novo no servidor.
              disabled={papel !== Papel.admin || editando?.id === usuarioAtualId}
            />
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
              {editando?.id === usuarioAtualId
                ? "Você não pode remover a própria permissão — se fosse a última, ninguém conseguiria devolvê-la sem mexer no banco."
                : papel !== Papel.admin
                  ? "Disponível apenas para contas com perfil Admin."
                  : "Dá acesso a esta tela: criar contas, trocar senhas e desativar pessoas. É separado do perfil Admin, que já permite ver todas as solicitações e mover a fila."}
            </p>
          </div>
        </div>
      </CFModal>

      {/* ─── Trocar senha ─── */}
      <CFModal
        open={trocandoSenha !== null}
        onClose={() => setTrocandoSenha(null)}
        title="Redefinir senha"
        hint={trocandoSenha ? `${trocandoSenha.nome} · ${trocandoSenha.email}` : undefined}
        icon="bi-key"
        width={460}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setTrocandoSenha(null)} disabled={ocupado}>
              Cancelar
            </Btn>
            <Btn icon="bi-check-lg" onClick={salvarSenha} disabled={ocupado}>
              {ocupado ? "Salvando..." : "Redefinir"}
            </Btn>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {erroModal && <CFAlert tone="danger" icon="bi-exclamation-circle-fill">{erroModal}</CFAlert>}
          <CFAlert tone="info" icon="bi-info-circle-fill">
            A senha antiga deixa de valer na hora. Anote a nova antes de salvar — ela não é
            recuperável depois (o banco guarda só o hash).
          </CFAlert>
          <CFField
            label="Nova senha"
            required
            type="password"
            value={senha}
            onChange={setSenha}
            icon="bi-key"
            hint="Mínimo de 12 caracteres — prefira uma frase curta a símbolos."
            autoFocus
          />
        </div>
      </CFModal>

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  );
}
