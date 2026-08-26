/**
 * STATUS VÁLIDOS DO SISTEMA
 * Estes são os únicos status permitidos no banco de dados — a coluna
 * `solicitacoes.status` tem um CHECK com exatamente estes quatro valores.
 *
 * Registros antigos ainda podem trazer 'finalizado' no lugar de
 * 'concluido'; por isso os mapas abaixo aceitam os dois e a contagem de
 * métricas soma ambos.
 */
export const STATUS = {
  NA_FILA: "na_fila",
  EM_ANDAMENTO: "em_andamento",
  AJUSTES: "ajustes",
  CONCLUIDO: "concluido",
};

/**
 * Mapeamento de status para exibição
 */
export const STATUS_LABELS = {
  [STATUS.NA_FILA]: "Na Fila",
  [STATUS.EM_ANDAMENTO]: "Em Andamento",
  [STATUS.AJUSTES]: "Ajuste Pendente",
  [STATUS.CONCLUIDO]: "Finalizado",
  finalizado: "Finalizado",
};

/**
 * Mapeamento de status para classes CSS
 */
export const STATUS_CLASSES = {
  [STATUS.NA_FILA]: "status-na_fila",
  [STATUS.EM_ANDAMENTO]: "status-em_andamento",
  [STATUS.AJUSTES]: "status-ajustes",
  [STATUS.CONCLUIDO]: "status-finalizado",
  finalizado: "status-finalizado",
};

/**
 * Validar se um status é válido
 */
export function isStatusValido(status) {
  return Object.values(STATUS).includes(status);
}

/**
 * Obter label de um status
 */
export function getStatusLabel(status) {
  return STATUS_LABELS[status] || "Na Fila";
}

/**
 * Obter classe CSS de um status
 */
export function getStatusClass(status) {
  return STATUS_CLASSES[status] || "status-na_fila";
}

/**
 * 'concluido' e 'finalizado' são o mesmo estado para quem olha a tela.
 */
export function isFinalizado(status) {
  return status === STATUS.CONCLUIDO || status === "finalizado";
}
