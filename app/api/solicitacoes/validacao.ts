// Validação do corpo de uma nova solicitação.
//
// Existe como módulo separado porque a regra precisa valer no SERVIDOR, e não
// só no formulário: na versão anterior o único lugar que sabia quais campos
// eram obrigatórios era o atributo `required` do HTML, e qualquer requisição
// montada à mão passava por cima de tudo.

import { isFormatoValido, isTipoMaterialValido, SETOR_MAX } from "@/lib/solicitacaoListas";

export interface SolicitacaoValidada {
  solicitanteSetor: string;
  solicitanteCliente: string | null;
  prazoIdeal: Date;
  prazoLimite: Date;
  urgente: boolean;
  urgenciaJustificativa: string | null;
  tipoMaterial: string;
  tipoMaterialOutro: string | null;
  objetivo: string;
  conteudo: string;
  infoObrigatorias: string;
  formatos: string[];
  formatoOutros: string | null;
  dimensoes: string | null;
  paginas: number | null;
  identidadeVisual: boolean;
  identidadeDiretorio: string | null;
  referenciasDiretorio: string | null;
  materiaisDiretorio: string | null;
  observacoes: string | null;
}

const TEXTO_CURTO_MAX = 300;
const TEXTO_LONGO_MAX = 5000;

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function textoOuNulo(valor: unknown): string | null {
  const t = texto(valor);
  return t === "" ? null : t;
}

/**
 * Aceita apenas AAAA-MM-DD e devolve a data em UTC.
 *
 * Deixar o `new Date()` interpretar string livre faria "12/03/2026" virar
 * março ou dezembro conforme o locale do servidor — e o servidor aqui é a
 * Vercel, não a máquina de quem preencheu.
 */
function dataIso(valor: unknown): Date | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const data = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) return null;
  // Confere o caminho de volta: "2026-02-31" passa no regex, mas o Date
  // normaliza para 03/03 silenciosamente.
  if (data.toISOString().slice(0, 10) !== valor) return null;
  return data;
}

/** Devolve a solicitação pronta para gravar, ou a mensagem do primeiro
 *  problema encontrado. */
export function validarSolicitacao(
  body: Record<string, unknown>
): { ok: true; dados: SolicitacaoValidada } | { ok: false; erro: string } {
  const erro = (msg: string) => ({ ok: false as const, erro: msg });

  const solicitanteSetor = texto(body.solicitanteSetor);
  if (!solicitanteSetor) return erro("Informe o setor / área.");
  if (solicitanteSetor.length > SETOR_MAX) {
    return erro(`O setor deve ter no máximo ${SETOR_MAX} caracteres.`);
  }

  const solicitanteCliente = textoOuNulo(body.solicitanteCliente);
  if (solicitanteCliente && solicitanteCliente.length > TEXTO_CURTO_MAX) {
    return erro("O código do projeto / cliente está longo demais.");
  }

  const prazoIdeal = dataIso(body.prazoIdeal);
  if (!prazoIdeal) return erro("Informe uma data ideal de entrega válida.");
  const prazoLimite = dataIso(body.prazoLimite);
  if (!prazoLimite) return erro("Informe uma data limite válida.");
  if (prazoLimite < prazoIdeal) {
    return erro("A data limite não pode ser anterior à data ideal de entrega.");
  }

  const urgente = body.urgente === true;
  // A justificativa só é exigida — e só é gravada — quando o pedido é
  // urgente. Guardar a justificativa de um pedido não urgente criaria texto
  // órfão que a tela nunca mostra.
  let urgenciaJustificativa: string | null = null;
  if (urgente) {
    urgenciaJustificativa = textoOuNulo(body.urgenciaJustificativa);
    if (!urgenciaJustificativa) return erro("Explique o motivo da urgência.");
    if (urgenciaJustificativa.length > TEXTO_LONGO_MAX) {
      return erro("A justificativa da urgência está longa demais.");
    }
  }

  const tipoMaterial = texto(body.tipoMaterial);
  if (!isTipoMaterialValido(tipoMaterial)) return erro("Selecione um tipo de material válido.");
  let tipoMaterialOutro: string | null = null;
  if (tipoMaterial === "outro") {
    tipoMaterialOutro = textoOuNulo(body.tipoMaterialOutro);
    if (!tipoMaterialOutro) return erro("Descreva qual é o tipo de material.");
    if (tipoMaterialOutro.length > TEXTO_CURTO_MAX) {
      return erro("A descrição do tipo de material está longa demais.");
    }
  }

  const objetivo = texto(body.objetivo);
  if (!objetivo) return erro("Informe o objetivo da peça.");
  const conteudo = texto(body.conteudo);
  if (!conteudo) return erro("Informe o texto / conteúdo da peça.");
  const infoObrigatorias = texto(body.infoObrigatorias);
  if (!infoObrigatorias) return erro("Informe os elementos obrigatórios.");
  for (const [rotulo, valor] of [
    ["objetivo", objetivo],
    ["conteúdo", conteudo],
    ["as informações obrigatórias", infoObrigatorias],
  ] as const) {
    if (valor.length > TEXTO_LONGO_MAX) return erro(`O campo ${rotulo} está longo demais.`);
  }

  const formatosBruto = Array.isArray(body.formatos) ? body.formatos : [];
  // `Set` porque nada impede o corpo de chegar com "email" duas vezes, e o
  // banco guardaria o array duplicado exatamente como veio.
  const formatos = Array.from(new Set(formatosBruto.filter(isFormatoValido)));
  if (formatos.length === 0) return erro("Escolha ao menos um canal de divulgação.");

  let formatoOutros: string | null = null;
  if (formatos.includes("outros")) {
    formatoOutros = textoOuNulo(body.formatoOutros);
    if (!formatoOutros) return erro("Especifique o formato em “Outros”.");
    if (formatoOutros.length > TEXTO_CURTO_MAX) return erro("O formato “Outros” está longo demais.");
  }

  const dimensoes = textoOuNulo(body.dimensoes);
  if (!dimensoes) return erro("Informe as dimensões.");
  if (dimensoes.length > TEXTO_CURTO_MAX) return erro("As dimensões estão longas demais.");

  let paginas: number | null = null;
  if (body.paginas !== undefined && body.paginas !== null && body.paginas !== "") {
    const n = typeof body.paginas === "number" ? body.paginas : Number(body.paginas);
    if (!Number.isInteger(n) || n < 1 || n > 9999) {
      return erro("A quantidade de páginas deve ser um número inteiro entre 1 e 9999.");
    }
    paginas = n;
  }
  if (paginas === null) return erro("Informe a quantidade de páginas.");

  const identidadeVisual = body.identidadeVisual === true;
  let identidadeDiretorio: string | null = null;
  if (identidadeVisual) {
    identidadeDiretorio = textoOuNulo(body.identidadeDiretorio);
    if (!identidadeDiretorio) return erro("Informe o diretório / link da identidade visual.");
    if (identidadeDiretorio.length > TEXTO_CURTO_MAX) {
      return erro("O diretório da identidade visual está longo demais.");
    }
  }

  const referenciasDiretorio = textoOuNulo(body.referenciasDiretorio);
  if (!referenciasDiretorio) return erro("Informe o diretório das referências.");
  const materiaisDiretorio = textoOuNulo(body.materiaisDiretorio);
  if (!materiaisDiretorio) return erro("Informe o diretório dos materiais.");
  for (const valor of [referenciasDiretorio, materiaisDiretorio]) {
    if (valor.length > TEXTO_CURTO_MAX) return erro("Um dos diretórios informados está longo demais.");
  }

  const observacoes = textoOuNulo(body.observacoes);
  if (observacoes && observacoes.length > TEXTO_LONGO_MAX) {
    return erro("As observações estão longas demais.");
  }

  return {
    ok: true,
    dados: {
      solicitanteSetor,
      solicitanteCliente,
      prazoIdeal,
      prazoLimite,
      urgente,
      urgenciaJustificativa,
      tipoMaterial,
      tipoMaterialOutro,
      objetivo,
      conteudo,
      infoObrigatorias,
      formatos,
      formatoOutros,
      dimensoes,
      paginas,
      identidadeVisual,
      identidadeDiretorio,
      referenciasDiretorio,
      materiaisDiretorio,
      observacoes,
    },
  };
}
