/**
 * Schemas Zod para o domínio de Membros (S02-T01).
 *
 * **Diferença vs `app/lib/validators/auth.ts`:** aquele serve a API
 * `/api/auth/login` (JSON). Este serve formulários HTML (`<Form method=post>`)
 * — usa `z.coerce.date` para converter string de `<input type=date>` em
 * `Date`, e `.strict()` para impedir campos não documentados (gate LGPD).
 *
 * **RN-MEM-02 (LGPD):** NUNCA aceitar `cpf`, `rg`, `cnpj`, ou qualquer
 * outro dado fiscal. Bloqueio via `.strict()` garante que mesmo um POST
 * malicioso não consiga injetar esses campos.
 *
 * **Cross-field (S02):** `dataBatismo >= dataConversao` se ambos preenchidos.
 *
 * @see docs/REGRAS_DE_NEGOCIO.md (RN-MEM-01, RN-MEM-02, RN-MEM-04)
 */
import { z } from "zod";

/** Telefone BR: aceita com ou sem máscara; **salva apenas dígitos**.
 *  O form exibe com máscara via `mascaraTelefone` (estado controlado),
 *  mas o que vai pro banco é a forma crua para normalização e busca. */
const telefone = z
  .string()
  .max(20)
  .transform((v) => v.replace(/\D/g, ""))
  .refine(
    (v) => v.length >= 8 && v.length <= 20,
    { message: "Telefone inválido." }
  )
  .optional();

/** CEP: aceita com ou sem máscara; **salva apenas dígitos**. */
const cep = z
  .string()
  .max(9)
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 8, {
    message: "CEP inválido. Use o formato 00000-000.",
  })
  .optional();

/** Email: lowercase + trim, formato de e-mail, max 120. */
const email = z
  .string()
  .max(120)
  .transform((v) => v.toLowerCase().trim())
  .pipe(z.string().email("E-mail inválido. Verifique o formato."))
  .optional();

/**
 * Limpa strings vazias de um objeto, convertendo-as para undefined.
 * Apenas para campos que são validados com refine/regex e falham com "".
 * Campos obrigatórios (nome) NÃO devem ser limpos — eles precisam falhar
 * na validação quando vazios.
 */
export function stripEmptyStrings(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = v === "" ? undefined : v;
  }
  return result;
}

/**
 * Campos que devem ser restaurados para "" após stripEmptyStrings.
 * Estes são campos obrigatórios que precisam preservar o valor vazio
 * para que a validação Zod falhe corretamente.
 */
const REQUIRED_FIELDS = new Set(["nome"]);

/**
 * Limpa strings vazias de campos opcionais, preservando campos obrigatórios.
 */
export function cleanFormData(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REQUIRED_FIELDS.has(k)) {
      result[k] = v; // preserva vazio para falhar na validação
    } else {
      result[k] = v === "" ? undefined : v;
    }
  }
  return result;
}

/** Data: coerce de string (form HTML) para Date. Aceita vazio/undefined. */
const dataOpcional = z
  .preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.date({ message: "Data inválida." })
  )
  .optional();

/**
 * Schema de criação de Membro (S02-T01).
 *
 * - `nome`: obrigatório, 2-120 chars.
 * - `tipo`: enum (default VISITANTE).
 * - `cargo`: opcional, enum de cargos administrativos.
 * - Demais campos: opcionais.
 * - `.strict()`: bloqueia campos não declarados (gate LGPD: cpf/rg/cnpj).
 */
export const MembroCreateSchema = z
  .object({
    nome: z
      .string()
      .min(2, "Nome deve ter pelo menos 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
    tipo: z
      .enum(["VISITANTE", "CONGREGADO", "MEMBRO_ATIVO"], {
        message: "Tipo deve ser VISITANTE, CONGREGADO ou MEMBRO_ATIVO.",
      })
      .default("VISITANTE"),
    cargo: z
      .enum(["ADMIN", "PASTOR", "SECRETARIO", "FINANCEIRO", "LIDER_MINISTERIO"], {
        message: "Cargo inválido.",
      })
      .optional()
      .nullable(),
    email,
    telefone,
    profissao: z.string().max(80, "Profissão muito longa.").optional(),
    estadoCivil: z.string().max(40, "Estado civil muito longo.").optional(),
    dataConversao: dataOpcional,
    dataBatismo: dataOpcional,
    dataNascimento: dataOpcional,
    sexo: z
      .enum(["Masculino", "Feminino", "Outro"], {
        message: "Sexo deve ser Masculino, Feminino ou Outro.",
      })
      .optional(),
    status: z
      .enum(["Ativo", "Pendente", "Inativo"], {
        message: "Status deve ser Ativo, Pendente ou Inativo.",
      })
      .optional(),
    grupo: z.string().max(80, "Grupo muito longo.").optional(),
    discipuladorNome: z
      .string()
      .max(120, "Nome do discipulador/líder muito longo.")
      .optional(),
    complemento: z.string().max(60, "Complemento muito longo.").optional(),
    logradouro: z.string().max(120, "Logradouro muito longo.").optional(),
    numero: z.string().max(10, "Número muito longo.").optional(),
    bairro: z.string().max(80, "Bairro muito longo.").optional(),
    cidade: z.string().max(80, "Cidade muito longa.").optional(),
    estado: z
      .string()
      .max(2, "Use a sigla do estado (ex: SP).")
      .optional(),
    cep,
  })
  .strict()
  .refine(
    (data) => {
      if (data.dataBatismo && data.dataConversao) {
        return data.dataBatismo.getTime() >= data.dataConversao.getTime();
      }
      return true;
    },
    {
      message: "Data de batismo não pode ser anterior à data de conversão.",
      path: ["dataBatismo"],
    }
  );

/** Tipo inferido do MembroCreateSchema (OUTPUT — após parse, com defaults aplicados). */
export type MembroCreateInput = z.infer<typeof MembroCreateSchema>;

/**
 * Schema de atualização de Membro (S02-T01).
 *
 * - `partial()`: todos os campos opcionais.
 * - NUNCA inclui `senhaHash`, `cpf`, `rg`, `cnpj` (gates LGPD).
 * - Mesmo refine cross-field do Create.
 */
export const MembroUpdateSchema = z
  .object({
    nome: z
      .string()
      .min(2, "Nome deve ter pelo menos 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres.")
      .optional(),
    tipo: z
      .enum(["VISITANTE", "CONGREGADO", "MEMBRO_ATIVO"], {
        message: "Tipo deve ser VISITANTE, CONGREGADO ou MEMBRO_ATIVO.",
      })
      .optional(),
    cargo: z
      .enum(["ADMIN", "PASTOR", "SECRETARIO", "FINANCEIRO", "LIDER_MINISTERIO"], {
        message: "Cargo inválido.",
      })
      .optional()
      .nullable(),
    email,
    telefone,
    profissao: z.string().max(80).optional(),
    estadoCivil: z.string().max(40).optional(),
    dataConversao: dataOpcional,
    dataBatismo: dataOpcional,
    dataNascimento: dataOpcional,
    sexo: z
      .enum(["Masculino", "Feminino", "Outro"], {
        message: "Sexo deve ser Masculino, Feminino ou Outro.",
      })
      .optional(),
    status: z
      .enum(["Ativo", "Pendente", "Inativo"], {
        message: "Status deve ser Ativo, Pendente ou Inativo.",
      })
      .optional(),
    grupo: z.string().max(80).optional(),
    discipuladorNome: z.string().max(120).optional(),
    complemento: z.string().max(60).optional(),
    logradouro: z.string().max(120).optional(),
    numero: z.string().max(10).optional(),
    bairro: z.string().max(80).optional(),
    cidade: z.string().max(80).optional(),
    estado: z.string().max(2).optional(),
    cep,
  })
  .strict()
  .refine(
    (data) => {
      if (data.dataBatismo && data.dataConversao) {
        return data.dataBatismo.getTime() >= data.dataConversao.getTime();
      }
      return true;
    },
    {
      message: "Data de batismo não pode ser anterior à data de conversão.",
      path: ["dataBatismo"],
    }
  );

/** Tipo inferido do MembroUpdateSchema. */
export type MembroUpdateInput = z.infer<typeof MembroUpdateSchema>;
