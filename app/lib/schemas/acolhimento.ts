/**
 * Constantes e rótulos do acolhimento de visitantes (seguros para o cliente).
 *
 * A regra de negócio fica em `app/lib/acolhimento.server.ts`; este arquivo só
 * guarda os enums e os textos, para poderem ser usados nos componentes.
 */

/** Origens possíveis da visita. */
export const ORIGENS_VISITA = [
  "CULTO",
  "EVENTO",
  "INDICACAO",
  "REDES_SOCIAIS",
  "PASSOU_EM_FRENTE",
  "OUTRO",
] as const;
export type OrigemVisita = (typeof ORIGENS_VISITA)[number];

/** Preferências de contato. */
export const PREFERENCIAS_CONTATO = ["WHATSAPP", "LIGACAO", "EMAIL"] as const;
export type PreferenciaContato = (typeof PREFERENCIAS_CONTATO)[number];

/** Tipos de registro da linha do tempo. `CONVERSAO` é criado pelo sistema. */
export const TIPOS_REGISTRO = [
  "PRIMEIRA_VISITA",
  "MENSAGEM",
  "LIGACAO",
  "RETORNO",
  "PROXIMA_ACAO",
  "OUTRO",
] as const;
export type TipoRegistro = (typeof TIPOS_REGISTRO)[number] | "CONVERSAO";

export const ORIGEM_LABEL: Record<OrigemVisita, string> = {
  CULTO: "Culto",
  EVENTO: "Evento",
  INDICACAO: "Indicação",
  REDES_SOCIAIS: "Redes sociais",
  PASSOU_EM_FRENTE: "Passou em frente",
  OUTRO: "Outro",
};

export const PREFERENCIA_LABEL: Record<PreferenciaContato, string> = {
  WHATSAPP: "WhatsApp",
  LIGACAO: "Ligação",
  EMAIL: "E-mail",
};

export const TIPO_REGISTRO_LABEL: Record<TipoRegistro, string> = {
  PRIMEIRA_VISITA: "Primeira visita registrada",
  MENSAGEM: "Mensagem enviada",
  LIGACAO: "Ligação realizada",
  RETORNO: "Retorno à igreja",
  PROXIMA_ACAO: "Próxima ação",
  OUTRO: "Registro",
  CONVERSAO: "Convertido",
};

/** Status derivado do acolhimento (visitante ainda não convertido). */
export type StatusAcolhimento = "NOVO" | "ACOMPANHAR" | "RETORNOU";
