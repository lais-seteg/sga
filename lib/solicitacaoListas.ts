// Listas do formulário de solicitação — as mesmas opções do documento de
// referência (doc/INF_SOLICITACAO_PECAS_GRAFICAS_REV00.docx), agora num único
// lugar compartilhado pela tela e pela validação do servidor. Antes viviam
// duplicadas no index.html e no app.js, e só o HTML sabia o que era válido.

/**
 * Setores oferecidos no seletor.
 *
 * A lista não é a do formulário antigo (Financeiro, Administrativo, RH,
 * Projetos, Inovação, PMO): ela foi refeita a partir dos setores que de fato
 * aparecem nos 136 pedidos históricos. Metade do que as pessoas digitavam —
 * Biótico, Geoambiental, Regulatório, SST, Marketing — não estava no seletor,
 * o que só podia significar que escolhiam a opção errada ou a mais próxima.
 */
export const SETORES = [
  "Administrativo",
  "Biótico",
  "Comercial",
  "Financeiro",
  "Geoambiental",
  "Inovação",
  "Marketing",
  "PMO",
  "Projetos",
  "Regulatório",
  "RH",
  "SST",
  "TI",
] as const;

export const TIPOS_MATERIAL: { value: string; label: string }[] = [
  { value: "comunicado", label: "Comunicado interno" },
  { value: "post", label: "Post para redes sociais" },
  { value: "story", label: "Story" },
  { value: "banner", label: "Banner" },
  { value: "cartaz", label: "Cartaz" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "cartilha", label: "Cartilha" },
  { value: "convite", label: "Convite" },
  { value: "wallpaper", label: "Wallpaper" },
  { value: "outro", label: "Outro" },
];

export const FORMATOS: { value: string; label: string; icon: string }[] = [
  { value: "instagram", label: "Instagram", icon: "bi-instagram" },
  { value: "whatsapp", label: "WhatsApp", icon: "bi-whatsapp" },
  { value: "email", label: "E-mail", icon: "bi-envelope" },
  { value: "impressao", label: "Impressão", icon: "bi-printer" },
  { value: "site", label: "Site", icon: "bi-globe" },
  { value: "outros", label: "Outros", icon: "bi-three-dots" },
];

const TIPOS_VALIDOS = new Set(TIPOS_MATERIAL.map((t) => t.value));
const FORMATOS_VALIDOS = new Set(FORMATOS.map((f) => f.value));

export function rotuloTipoMaterial(valor: string | null | undefined, outro?: string | null): string {
  if (valor === "outro" && outro) return outro;
  return TIPOS_MATERIAL.find((t) => t.value === valor)?.label ?? valor ?? "—";
}

export function rotuloFormato(valor: string): string {
  return FORMATOS.find((f) => f.value === valor)?.label ?? valor;
}

export function iconeFormato(valor: string): string {
  return FORMATOS.find((f) => f.value === valor)?.icon ?? "bi-tag";
}

export function isTipoMaterialValido(valor: unknown): valor is string {
  return typeof valor === "string" && TIPOS_VALIDOS.has(valor);
}

export function isFormatoValido(valor: unknown): valor is string {
  return typeof valor === "string" && FORMATOS_VALIDOS.has(valor);
}

/**
 * O setor é texto livre no banco, não enum: os 136 pedidos históricos já
 * trazem valores fora de qualquer lista, e uma área nova não deveria exigir
 * deploy para poder pedir uma peça. Por isso a validação do servidor confere
 * só tamanho, e não pertencimento a SETORES — a lista existe para oferecer as
 * opções usuais, não para barrar o que está fora dela.
 */
export const SETOR_MAX = 60;
