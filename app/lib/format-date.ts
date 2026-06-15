/**
 * Helpers de formatação de data relativa (S04-T07 / S04-T10).
 *
 * Funções puras e testáveis (recebem `now` como parâmetro opcional)
 * para evitar `Date.now()` durante o render de componentes.
 *
 * @example
 *   formatRelative(new Date("2026-06-13T12:00:00"), new Date("2026-06-13T14:00:00"))
 *   // → "há 2 horas"
 */

/** Unidade de tempo em milissegundos. */
const MS = {
  minuto: 60_000,
  hora: 3_600_000,
  dia: 86_400_000,
} as const;

/**
 * Formata uma data relativa ao momento atual (ex: "há 5 minutos", "ontem").
 *
 * **Regras:**
 * - < 1 minuto → "agora"
 * - < 2 minutos → "há 1 minuto"
 * - < 1 hora → "há X minutos"
 * - < 2 horas → "há 1 hora"
 * - < 1 dia → "há X horas"
 * - < 2 dias → "ontem"
 * - ≤ 30 dias → "há X dias"
 * - > 30 dias → data no formato DD/MM/AAAA
 *
 * @param date - Data a ser formatada (passada).
 * @param now - Referência do "agora" (opcional, default = Date.now()).
 * @returns String formatada em PT-BR.
 */
export function formatRelative(date: Date, now?: Date): string {
  const referencia = now ?? new Date();
  const diffMs = referencia.getTime() - date.getTime();

  if (diffMs < 0) return "agora";

  const diffMinutos = Math.floor(diffMs / MS.minuto);
  const diffHoras = Math.floor(diffMs / MS.hora);
  const diffDias = Math.floor(diffMs / MS.dia);

  if (diffMinutos < 1) return "agora";
  if (diffMinutos < 2) return "há 1 minuto";
  if (diffHoras < 1) return `há ${diffMinutos} minutos`;
  if (diffHoras < 2) return "há 1 hora";
  if (diffDias < 1) return `há ${diffHoras} horas`;
  if (diffDias < 2) return "ontem";
  if (diffDias <= 30) return `há ${diffDias} dias`;

  // Mais de 30 dias: formato DD/MM/AAAA
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const ano = date.getFullYear();
  return `${dia}/${mes}/${ano}`;
}
