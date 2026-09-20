"use client";

// Formulário de nova solicitação — as mesmas 11 seções do documento de
// referência (doc/INF_SOLICITACAO_PECAS_GRAFICAS_REV00.docx), que já eram as
// 11 seções do modal anterior.
//
// Duas mudanças de fundo em relação à versão anterior:
//  1. Não há mais campo "Nome do Solicitante". Ele vem da conta logada, no
//     servidor — ninguém abre pedido no nome de outra pessoa.
//  2. A validação de obrigatoriedade existe aqui E no servidor
//     (app/api/solicitacoes/validacao.ts). Antes o único lugar que sabia o
//     que era obrigatório era o atributo `required` do HTML, que qualquer
//     requisição montada à mão contornava.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Btn,
  CFAlert,
  CFField,
  CFModal,
  CFPopover,
  CFSelect,
  CFSwitch,
  CFTextarea,
} from "@/app/components/ui-kit";
import { FORMATOS, SETORES, TIPOS_MATERIAL } from "@/lib/solicitacaoListas";
import type { ProjetoOpcao } from "@/lib/projetos";

interface Estado {
  solicitanteSetor: string;
  solicitanteCliente: string;
  prazoIdeal: string;
  prazoLimite: string;
  urgente: boolean;
  urgenciaJustificativa: string;
  tipoMaterial: string;
  tipoMaterialOutro: string;
  objetivo: string;
  conteudo: string;
  infoObrigatorias: string;
  formatos: string[];
  formatoOutros: string;
  dimensoes: string;
  paginas: string;
  identidadeVisual: boolean;
  identidadeDiretorio: string;
  referenciasDiretorio: string;
  materiaisDiretorio: string;
  observacoes: string;
}

function estadoInicial(setorPadrao: string): Estado {
  return {
    solicitanteSetor: setorPadrao,
    solicitanteCliente: "",
    prazoIdeal: "",
    prazoLimite: "",
    urgente: false,
    urgenciaJustificativa: "",
    tipoMaterial: "",
    tipoMaterialOutro: "",
    objetivo: "",
    conteudo: "",
    infoObrigatorias: "",
    formatos: [],
    formatoOutros: "",
    dimensoes: "",
    paginas: "",
    identidadeVisual: false,
    identidadeDiretorio: "",
    referenciasDiretorio: "",
    materiaisDiretorio: "",
    observacoes: "",
  };
}

export default function NovaSolicitacaoModal({
  aberto,
  onFechar,
  onCriada,
  setorPadrao,
  projetos,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriada: (protocolo: string) => void;
  setorPadrao: string;
  projetos: ProjetoOpcao[];
}) {
  const [f, setF] = useState<Estado>(() => estadoInicial(setorPadrao));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Cada abertura começa do zero. Sem isto, fechar o modal no meio de um
  // preenchimento e reabrir traria o rascunho antigo de volta — parecendo
  // que o pedido anterior não foi enviado.
  useEffect(() => {
    if (aberto) {
      setF(estadoInicial(setorPadrao));
      setErro(null);
    }
  }, [aberto, setorPadrao]);

  function set<K extends keyof Estado>(campo: K, valor: Estado[K]) {
    setF((atual) => ({ ...atual, [campo]: valor }));
  }

  function alternarFormato(valor: string) {
    setF((atual) => ({
      ...atual,
      formatos: atual.formatos.includes(valor)
        ? atual.formatos.filter((x) => x !== valor)
        : [...atual.formatos, valor],
    }));
  }

  /** Espelha a validação do servidor, na mesma ordem, para a mensagem apontar
   *  o primeiro campo que falta em vez de um erro genérico ao final. */
  function primeiroProblema(): string | null {
    if (!f.solicitanteSetor.trim()) return "Escolha o setor / área.";
    if (!f.prazoIdeal) return "Informe a data ideal de entrega.";
    if (!f.prazoLimite) return "Informe a data limite.";
    if (f.prazoLimite < f.prazoIdeal) return "A data limite não pode ser anterior à data ideal.";
    if (f.urgente && !f.urgenciaJustificativa.trim()) return "Explique o motivo da urgência.";
    if (!f.tipoMaterial) return "Selecione o tipo de material.";
    if (f.tipoMaterial === "outro" && !f.tipoMaterialOutro.trim()) {
      return "Descreva qual é o tipo de material.";
    }
    if (!f.objetivo.trim()) return "Informe o objetivo da peça.";
    if (!f.conteudo.trim()) return "Informe o texto / conteúdo da peça.";
    if (!f.infoObrigatorias.trim()) return "Informe os elementos obrigatórios.";
    if (f.formatos.length === 0) return "Escolha ao menos um canal de divulgação.";
    if (f.formatos.includes("outros") && !f.formatoOutros.trim()) {
      return "Especifique o formato em “Outros”.";
    }
    if (!f.dimensoes.trim()) return "Informe as dimensões.";
    const paginas = Number(f.paginas);
    if (!f.paginas.trim() || !Number.isInteger(paginas) || paginas < 1) {
      return "Informe a quantidade de páginas (número inteiro a partir de 1).";
    }
    if (f.identidadeVisual && !f.identidadeDiretorio.trim()) {
      return "Informe o diretório / link da identidade visual.";
    }
    if (!f.referenciasDiretorio.trim()) return "Informe o diretório das referências.";
    if (!f.materiaisDiretorio.trim()) return "Informe o diretório dos materiais.";
    return null;
  }

  async function enviar() {
    const problema = primeiroProblema();
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/solicitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          // O "#" é enfeite da planilha; o banco guarda só o código.
          solicitanteCliente: f.solicitanteCliente.trim().replace(/^#/, "") || null,
          paginas: Number(f.paginas),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error || "Não foi possível salvar a solicitação.");
        return;
      }
      onCriada(data.protocolo);
    } catch {
      setErro("Falha de rede ao enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const setorOptions = useMemo(() => {
    // O setor gravado na conta pode não estar na lista padrão; se não
    // estiver, entra como opção para o campo não abrir vazio.
    const lista: string[] = [...SETORES];
    if (setorPadrao && !lista.includes(setorPadrao)) lista.unshift(setorPadrao);
    return lista.map((s) => ({ value: s, label: s }));
  }, [setorPadrao]);

  return (
    <CFModal
      open={aberto}
      onClose={onFechar}
      title="Nova solicitação de peça gráfica"
      hint="Quanto mais completo o pedido, menos idas e vindas até a entrega."
      icon="bi-palette"
      width={760}
      footer={
        <>
          <Btn variant="secondary" onClick={onFechar} disabled={enviando}>
            Cancelar
          </Btn>
          <Btn icon="bi-send" onClick={enviar} disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar solicitação"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {erro && <CFAlert tone="danger" icon="bi-exclamation-circle-fill">{erro}</CFAlert>}

        <Secao numero={1} icone="bi-person" titulo="Informações do solicitante">
          <Grade>
            <CFSelect
              label="Setor / área"
              required
              value={f.solicitanteSetor}
              onChange={(v) => set("solicitanteSetor", v)}
              options={setorOptions}
              icon="bi-diagram-3"
              placeholder="Selecione..."
            />
            <SeletorProjeto
              valor={f.solicitanteCliente}
              onChange={(v) => set("solicitanteCliente", v)}
              projetos={projetos}
            />
          </Grade>
        </Secao>

        <Secao numero={2} icone="bi-calendar3" titulo="Prazo">
          <Grade>
            <CFField
              label="Data ideal de entrega"
              required
              type="date"
              value={f.prazoIdeal}
              onChange={(v) => set("prazoIdeal", v)}
            />
            <CFField
              label="Data limite"
              required
              type="date"
              value={f.prazoLimite}
              onChange={(v) => set("prazoLimite", v)}
            />
          </Grade>
          <div style={{ marginTop: 12 }}>
            <CFSwitch
              checked={f.urgente}
              onChange={(v) => set("urgente", v)}
              label="Este material é urgente"
            />
          </div>
          {f.urgente && (
            <div style={{ marginTop: 12 }}>
              <CFTextarea
                label="Justificativa da urgência"
                required
                rows={2}
                value={f.urgenciaJustificativa}
                onChange={(v) => set("urgenciaJustificativa", v)}
                placeholder="Explique o motivo da urgência..."
              />
            </div>
          )}
        </Secao>

        <Secao numero={3} icone="bi-bounding-box" titulo="Tipo de material">
          <CFSelect
            label="Selecione o tipo"
            required
            value={f.tipoMaterial}
            onChange={(v) => set("tipoMaterial", v)}
            options={TIPOS_MATERIAL}
            icon="bi-bounding-box"
            placeholder="Selecione..."
          />
          {f.tipoMaterial === "outro" && (
            <div style={{ marginTop: 12 }}>
              <CFField
                label="Qual tipo?"
                required
                value={f.tipoMaterialOutro}
                onChange={(v) => set("tipoMaterialOutro", v)}
                placeholder="Descreva o tipo de material..."
              />
            </div>
          )}
        </Secao>

        <Secao numero={4} icone="bi-bullseye" titulo="Objetivo">
          <CFTextarea
            label="Qual o objetivo da peça?"
            required
            rows={2}
            value={f.objetivo}
            onChange={(v) => set("objetivo", v)}
            placeholder="Ex.: divulgar evento interno, comunicar mudança de processo..."
          />
        </Secao>

        <Secao numero={5} icone="bi-file-text" titulo="Conteúdo">
          <CFTextarea
            label="Texto / conteúdo da peça"
            required
            rows={5}
            value={f.conteudo}
            onChange={(v) => set("conteudo", v)}
            placeholder="Cole o texto completo que será usado na peça..."
          />
        </Secao>

        <Secao numero={6} icone="bi-exclamation-circle" titulo="Informações obrigatórias">
          <CFTextarea
            label="Elementos obrigatórios"
            required
            rows={2}
            value={f.infoObrigatorias}
            onChange={(v) => set("infoObrigatorias", v)}
            placeholder="Logos, datas, hashtags, links obrigatórios..."
          />
        </Secao>

        <Secao numero={7} icone="bi-aspect-ratio" titulo="Formato">
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", letterSpacing: 0.2 }}>
            Canais de divulgação <span style={{ color: "var(--orange)" }}>*</span>
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0 4px" }}>
            {FORMATOS.map((opcao) => {
              const marcado = f.formatos.includes(opcao.value);
              return (
                <button
                  key={opcao.value}
                  type="button"
                  onClick={() => alternarFormato(opcao.value)}
                  aria-pressed={marcado}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    height: 34,
                    padding: "0 14px",
                    borderRadius: "var(--r-pill)",
                    border: `1.5px solid ${marcado ? "var(--orange)" : "var(--border)"}`,
                    background: marcado ? "var(--orange-15)" : "var(--surface)",
                    color: marcado ? "var(--orange)" : "var(--text-muted)",
                    fontFamily: "inherit",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <i className={`bi ${marcado ? "bi-check-lg" : opcao.icon}`} style={{ fontSize: 13 }} />
                  {opcao.label}
                </button>
              );
            })}
          </div>
          {f.formatos.includes("outros") && (
            <div style={{ marginTop: 10 }}>
              <CFField
                label="Especifique o formato"
                required
                value={f.formatoOutros}
                onChange={(v) => set("formatoOutros", v)}
                placeholder="Ex.: TikTok, LinkedIn, YouTube..."
              />
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Grade>
              <CFField
                label="Dimensões"
                required
                value={f.dimensoes}
                onChange={(v) => set("dimensoes", v)}
                placeholder="Ex.: A4, 1080x1080px"
                icon="bi-rulers"
              />
              <CFField
                label="Páginas"
                required
                type="number"
                min={1}
                value={f.paginas}
                onChange={(v) => set("paginas", v)}
                placeholder="Quantidade"
                icon="bi-files"
              />
            </Grade>
          </div>
        </Secao>

        <Secao numero={8} icone="bi-palette" titulo="Identidade visual">
          <CFSwitch
            checked={f.identidadeVisual}
            onChange={(v) => set("identidadeVisual", v)}
            label="A peça tem identidade visual própria (cliente, evento, campanha)"
          />
          {f.identidadeVisual && (
            <div style={{ marginTop: 12 }}>
              <CFField
                label="Diretório / link da identidade"
                required
                value={f.identidadeDiretorio}
                onChange={(v) => set("identidadeDiretorio", v)}
                placeholder="Caminho na rede ou link"
                icon="bi-link-45deg"
              />
            </div>
          )}
        </Secao>

        <Secao numero={9} icone="bi-images" titulo="Referências">
          <CFField
            label="Diretório das referências"
            required
            value={f.referenciasDiretorio}
            onChange={(v) => set("referenciasDiretorio", v)}
            placeholder="Caminho na rede ou link"
            icon="bi-link-45deg"
          />
        </Secao>

        <Secao numero={10} icone="bi-folder2-open" titulo="Materiais">
          <CFField
            label="Diretório dos materiais"
            required
            value={f.materiaisDiretorio}
            onChange={(v) => set("materiaisDiretorio", v)}
            placeholder="Link no drive onde a peça pronta deve ser salva"
            icon="bi-link-45deg"
          />
        </Secao>

        <Secao numero={11} icone="bi-sticky" titulo="Observações">
          <CFTextarea
            label="Observações finais"
            rows={3}
            value={f.observacoes}
            onChange={(v) => set("observacoes", v)}
            placeholder="Informações adicionais, instruções especiais..."
          />
        </Secao>
      </div>
    </CFModal>
  );
}

function Secao({
  numero,
  icone,
  titulo,
  children,
}: {
  numero: number;
  icone: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "var(--r-sm)",
            background: "var(--orange-15)",
            color: "var(--orange)",
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {numero}
        </span>
        <i className={`bi ${icone}`} style={{ fontSize: 13, color: "var(--text-faint)" }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{titulo}</span>
      </div>
      {children}
    </section>
  );
}

function Grade({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      {children}
    </div>
  );
}


/**
 * Campo "Código do Projeto | Cliente": input livre com sugestões vindas da
 * planilha CLIENTES_ATIVOS (tabela `projetos`).
 *
 * Continua sendo um input de texto, e não um seletor fechado, de propósito:
 * peça institucional sem projeto é caso comum, e projeto recém-aberto pode
 * ainda não ter entrado na planilha. As sugestões ajudam; não obrigam.
 *
 * A busca casa contra código, cliente E nome do projeto de uma vez — quem
 * pede a peça costuma lembrar "aquela do Ambev" muito antes de lembrar
 * "0189-3-2025". Com o Clockify isso não era possível: de lá vinha só o nome
 * do projeto, sem o cliente separado.
 */
function SeletorProjeto({
  valor,
  onChange,
  projetos,
}: {
  valor: string;
  onChange: (v: string) => void;
  projetos: ProjetoOpcao[];
}) {
  const [aberto, setAberto] = useState(false);
  const [tocado, setTocado] = useState(false);
  const campoRef = useRef<HTMLDivElement>(null);

  const sugestoes = useMemo(() => {
    const termo = normalizarBusca(valor);
    // Campo vazio mostra a lista inteira ao receber foco: com ~60 projetos,
    // rolar é mais rápido do que adivinhar o que digitar.
    const base = termo
      ? projetos.filter((p) => normalizarBusca(`${p.codigo} ${p.cliente} ${p.projeto ?? ""}`).includes(termo))
      : projetos;
    return base.slice(0, 50);
  }, [valor, projetos]);

  // Se o texto digitado bate exatamente com um projeto, mostra qual é — a
  // confirmação de que o código escolhido é o que a pessoa pensou que era.
  const escolhido = useMemo(
    () => projetos.find((p) => p.codigo === valor.trim().replace(/^#/, "")),
    [valor, projetos]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", letterSpacing: 0.2 }}>
        Código do projeto | cliente
      </span>
      <div
        ref={campoRef}
        style={{
          display: "flex",
          alignItems: "center",
          height: "var(--field-h)",
          padding: "0 14px",
          gap: 10,
          background: "var(--surface)",
          border: `1.5px solid ${aberto ? "var(--orange)" : "var(--border)"}`,
          boxShadow: aberto ? "0 0 0 3px var(--orange-15)" : "none",
          borderRadius: "var(--r-md)",
        }}
      >
        <i className="bi bi-briefcase" style={{ color: "var(--text-faint)", fontSize: 14, flexShrink: 0 }} />
        <input
          value={valor}
          onChange={(e) => {
            onChange(e.target.value);
            setTocado(true);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          placeholder={
            projetos.length ? "Busque por cliente, projeto ou código..." : "Código do projeto ou cliente"
          }
          autoComplete="off"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text)",
            fontSize: 13.5,
            fontWeight: 500,
            fontFamily: "inherit",
            minWidth: 0,
          }}
        />
        {valor && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setTocado(true);
            }}
            aria-label="Limpar projeto"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-faint)", display: "flex" }}
          >
            <i className="bi bi-x-lg" style={{ fontSize: 12 }} />
          </button>
        )}
      </div>

      {escolhido ? (
        <span style={{ fontSize: 11.5, color: "var(--green)", fontWeight: 600 }}>
          <i className="bi bi-check-circle-fill" style={{ fontSize: 10, marginRight: 4 }} />
          {escolhido.cliente}
          {escolhido.projeto ? ` — ${escolhido.projeto}` : ""}
        </span>
      ) : (
        <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
          {projetos.length === 0
            ? "Opcional — a lista de projetos não está carregada; digite o código à mão."
            : tocado && valor.trim() && sugestoes.length === 0
              ? "Nenhum projeto com esse texto. Pode seguir assim mesmo, se for peça sem projeto."
              : "Opcional — deixe em branco para peça institucional."}
        </span>
      )}

      <CFPopover
        open={aberto && sugestoes.length > 0}
        triggerRef={campoRef}
        onClose={() => setAberto(false)}
        width={420}
        maxHeight={300}
      >
        {sugestoes.map((p) => (
          <button
            key={p.codigo}
            type="button"
            onClick={() => {
              onChange(p.codigo);
              setAberto(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              textAlign: "left",
              padding: "8px 10px",
              background: p.codigo === escolhido?.codigo ? "var(--orange-08)" : "transparent",
              border: "none",
              borderRadius: "var(--r-sm)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunken)")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background =
                p.codigo === escolhido?.codigo ? "var(--orange-08)" : "transparent")
            }
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.cliente}
              </span>
              {p.projeto && (
                <span
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.projeto}
                </span>
              )}
            </span>
            <span
              style={{
                color: "var(--text-faint)",
                fontSize: 11.5,
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {p.codigo}
            </span>
          </button>
        ))}
      </CFPopover>
    </div>
  );
}

/** Minúsculas e sem acento, para "Inovacao" casar com "Inovação". */
function normalizarBusca(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
