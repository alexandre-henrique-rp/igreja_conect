# Formulário de Membro (Criar/Editar) — Design

## 1. Propósito

Formulário de **criação e edição de membros**. Acessível em:
- `/app/membros/novo` — criar novo membro (form vazio).
- `/app/membros/:id/editar` — editar membro existente (form preenchido).

A diferença entre os dois é só o **estado inicial** (vazio vs. preenchido) e o **endpoint do submit** (`POST /app/membros` vs. `PUT /app/membros/:id`).

**Persona-alvo:** qualquer perfil autenticado (RN-MEM-01: qualquer um escreve).

**Caso de uso primário (US-MEM-001 do PRD):** Secretário cadastra uma pessoa nova como VISITANTE. Sistema gera alerta automático (RN-MEM-05).

**Casos secundários:**
- Editar dados de membro existente.
- Validar campos em tempo real (onBlur) e no submit.
- Mostrar erros de validação inline.
- Cancelar e voltar (descartar alterações).
- Lidar com visitante recém-cadastrado que ainda não tem email/telefone (campos opcionais).

**Restrição crítica (RN-MEM-02):** **NÃO** existe campo CPF, RG, dados fiscais. Apenas identificação, contato, endereço, eclesiásticos, e opcionais profissão/estado civil.

---

## 2. Wireframe

### 2.1 Desktop (≥ 1024px) — `/app/membros/novo`

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Topbar + Sidebar                                                       │
├────────────┬─────────────────────────────────────────────────────────────┤
│ Sidebar    │  Membros > Cadastrar novo membro                            │ ← breadcrumb
│            │                                                             │
│            │  ┌─ Identificação ──────────────────────────────────────┐  │
│            │  │ Nome *                                                │  │
│            │  │ [_____________________________________________]        │  │
│            │  │                                                        │  │
│            │  │ Tipo *    [▼ Visitante]                              │  │
│            │  │                                                        │  │
│            │  │ ┌─ Contato ─────────────────────────────────────────┐  │ │
│            │  │ │ E-mail                                              │  │ │
│            │  │ │ [_____________________________________________]    │  │ │
│            │  │ │ Telefone                                            │  │ │
│            │  │ │ [(__) _____-____]                                  │  │ │
│            │  │ └────────────────────────────────────────────────────┘  │ │
│            │  │                                                        │  │
│            │  │ ┌─ Eclesiástico ────────────────────────────────────┐   │ │
│            │  │ │ Data de conversão      Data de batismo            │   │ │
│            │  │ │ [__/__/____]            [__/__/____]              │   │ │
│            │  │ │                                                        │  │
│            │  │ │ Profissão (opcional)   Estado civil (opcional)      │   │ │
│            │  │ │ [___________________]   [___________________]       │   │ │
│            │  │ └────────────────────────────────────────────────────┘  │ │
│            │  │                                                        │  │
│            │  │ ┌─ Endereço ────────────────────────────────────────┐   │ │
│            │  │ │ CEP *          [_____-___]  [Buscar]               │   │ │ ← integração futura (YAGNI MVP)
│            │  │ │ Logradouro     [_________________________________]   │   │ │
│            │  │ │ Número         [____________]                          │   │ │
│            │  │ │ Bairro         [_________________________________]   │   │ │
│            │  │ │ Cidade         [_________________________________]   │   │ │
│            │  │ │ Estado (UF)    [▼ SP]                               │   │ │
│            │  │ └────────────────────────────────────────────────────┘  │ │
│            │  │                                                        │  │
│            │  │  [Cancelar]    [Cadastrar membro]                      │  │
│            │  └────────────────────────────────────────────────────────┘  │
└────────────┴─────────────────────────────────────────────────────────────┘
```

### 2.2 Mobile

```
┌──────────────────────────────┐
│ ‹ Voltar   Cadastrar membro  │
├──────────────────────────────┤
│                              │
│ Identificação                │
│ Nome *                       │
│ [____________________]       │
│                              │
│ Tipo *                       │
│ [▼ Visitante]                │
│                              │
│ Contato                      │
│ E-mail                       │
│ [____________________]       │
│ Telefone                     │
│ [(__) _____-____]            │
│                              │
│ Eclesiástico                 │
│ Data conversão               │
│ [__/__/____]                 │
│ Data batismo                 │
│ [__/__/____]                 │
│ Profissão (opcional)         │
│ [____________________]       │
│ Estado civil (opcional)      │
│ [____________________]       │
│                              │
│ Endereço                     │
│ CEP                          │
│ [_____-___]                  │
│ Logradouro                   │
│ [____________________]       │
│ Número                       │
│ [____________]               │
│ Bairro                       │
│ [____________________]       │
│ Cidade                       │
│ [____________________]       │
│ Estado (UF)                  │
│ [▼ SP]                       │
│                              │
│ [Cancelar]                   │
│ [Cadastrar membro]           │
│                              │
└──────────────────────────────┘
```

---

## 3. Componentes

| Componente | Fonte | Props | Localização |
|---|---|---|---|
| `<ShellAutenticado>` | shared | — | (já existe) |
| `<Breadcrumb>` | shared | — | (já existe) |
| `<FormMembro>` | novo | `defaultValues?: Partial<Membro>`, `isEdit: boolean`, `formError?`, `fieldErrors?` | `app/components/FormMembro.tsx` |
| `<Section>` | shared | `title`, `children` (wrapper para grupos de campos) | `app/components/Section.tsx` |
| `<Field>` | novo | `label`, `name`, `type`, `error?`, `hint?`, `required?`, `autoComplete?`, `inputMode?`, mais props do `<Input>` | `app/components/Field.tsx` |
| `<Select>` | shared | `options: { value, label }[]`, `placeholder` | (já existe) |
| `<Button>` | shared | `variant`, `loading`, `type` | (já existe) |

> **Decisão de reuso:** `<Field>` é um wrapper em torno de `<Input>` (para inputs curtos) e `<Select>` (para dropdowns). Reduz duplicação. Se for só 1 uso, YAGNI — mas aqui o form tem 13+ campos, então vale.

**Hierarquia:**
- `app/routes/app/membros.novo.tsx` (rota `/app/membros/novo`).
- `app/routes/app/membros.$id.editar.tsx` (rota `/app/membros/:id/editar`).
- Ambos importam `<FormMembro>` com `isEdit={false}` ou `isEdit={true}`.

**Compartilhar form entre criar/editar:** o componente `<FormMembro>` é o mesmo. Loader de cada rota passa `defaultValues` diferente.

---

## 4. Estados

| Estado | Quando | Render |
|---|---|---|
| **Initial (novo)** | `GET /app/membros/novo` | Form vazio. Tipo default = "VISITANTE". |
| **Initial (editar)** | `GET /app/membros/:id/editar` | Form preenchido com valores atuais. |
| **Loading (loader)** | Carregando dados para editar | Skeleton dos campos. |
| **Submit em andamento** | Click "Cadastrar membro" | Botão vira loading, campos `disabled`, "Cancelar" também disabled. |
| **Validação client-side (onBlur)** | Email vazio + tab → campo | Mensagem inline "E-mail é obrigatório." (se for required). |
| **Validação server-side (erro de validação)** | Action retorna 422 | Campos com erro destacados, mensagens inline. |
| **Email duplicado (erro de negócio)** | `Membro.email` unique constraint falha | Mensagem "Este e-mail já está cadastrado." no campo email. |
| **Sucesso (criar)** | Action OK, redirect para `/app/membros/:id` | Toast "Membro cadastrado." + página de detalhe. |
| **Sucesso (editar)** | Action OK, redirect para `/app/membros/:id` | Toast "Dados atualizados." + página de detalhe. |
| **Cancelar** | Click "Cancelar" | Volta para `/app/membros/:id` (se edit) ou `/app/membros` (se novo). Sem confirmação — alert nativo se houver dados não salvos (registrar como melhoria futura, não no MVP). |
| **DISCIPULADOR tentando criar** | Carrega form normal | RN-MEM-01: PERMITIDO. DISCIPULADOR pode criar. Sem restrição. |
| **DISCIPULADOR tentando editar membro de outra célula** | Loader do form detecta | 403. Não vê o form. |

---

## 5. Interações

| Elemento | Evento | Comportamento |
|---|---|---|
| Input texto (nome, email, etc.) | `change` | Controlled state via react-hook-form. Validação onBlur. |
| Input email | `blur` | Validação formato + unique (verificar contra service `checkEmailUnique` se estiver editando). |
| Input telefone | `change` | Aplica máscara `(__) _____-____` enquanto digita. |
| Input CEP | `change` | Aplica máscara `_____-___`. **(No MVP, NÃO integra com ViaCEP — ver §6.3.)** |
| Input data (conversão, batismo) | `change` | `type="date"` nativo. Formato `YYYY-MM-DD`. |
| Select "Tipo" | `change` | Atualiza form. Para visitante, mostra nota informativa. |
| Select "Estado" | `change` | Dropdown com 27 UFs (26 + DF). |
| Botão "Cancelar" | Click | `navigate(-1)` ou URL hardcoded dependendo do contexto. |
| Botão "Cadastrar membro" / "Salvar alterações" | Click | Valida tudo, submete. |

**Navegação por teclado:**
- Tab: campo a campo, em ordem: Nome → Tipo → Email → Telefone → Data conv. → Data bat. → Profissão → Estado civil → CEP → Logradouro → Número → Bairro → Cidade → Estado → Cancelar → Submit.
- Enter em qualquer campo = submete (comportamento padrão de form).

**Máscaras:** implementadas com `useState` + regex simples. Sem lib (ex: `react-imask` é YAGNI para 1 input de telefone e 1 de CEP).

---

## 6. Validações e regras

### 6.1 Schema Zod (`app/lib/schemas/membros.ts`)

```ts
import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD).").optional().or(z.literal(""));

export const MembroCreateSchema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres.").max(120, "Nome muito longo (máx 120)."),
  tipo: z.enum(["MEMBRO_ATIVO", "CONGREGADO", "VISITANTE"]).default("VISITANTE"),
  email: z.string().email("E-mail inválido.").max(200).optional().or(z.literal("")),
  telefone: z.string().regex(/^\+?[\d\s()-]{8,20}$/, "Telefone inválido.").optional().or(z.literal("")),
  profissao: z.string().max(80).optional(),
  estadoCivil: z.string().max(40).optional(),
  dataConversao: dateString,
  dataBatismo: dateString,
  logradouro: z.string().max(120).optional(),
  numero: z.string().max(20).optional(),
  bairro: z.string().max(80).optional(),
  cidade: z.string().max(80).optional(),
  estado: z.string().length(2, "Use a sigla do estado (ex: SP).").optional().or(z.literal("")),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido.").optional().or(z.literal("")),
}).refine(
  (d) => !d.dataBatismo || !d.dataConversao || new Date(d.dataBatismo) >= new Date(d.dataConversao),
  { path: ["dataBatismo"], message: "Data de batismo deve ser igual ou posterior à data de conversão." }
);

export const MembroUpdateSchema = MembroCreateSchema.partial(); // mesmo schema, todos opcionais

export type MembroCreateInput = z.infer<typeof MembroCreateSchema>;
export type MembroUpdateInput = z.infer<typeof MembroUpdateSchema>;
```

### 6.2 Regras de negócio

- **RN-MEM-01:** qualquer perfil autenticado pode escrever. Sem restrição.
- **RN-MEM-02:** schema Prisma **não tem** campo `cpf`/`rg`/etc. Zod também não. Teste de grep no CI: `grep -E "(cpf|rg|cnpj)" app/lib/schemas/ prisma/` → 0.
- **RN-MEM-05:** se `tipo === "VISITANTE"` e `ConfiguracaoGeral.responsavelVisitante` está configurado, action cria `Alerta` em transação atômica.
- **RN-MEM-06:** este form NÃO muda `tipo` automaticamente. Transição de tipo é em tela separada (botão "Promover" no detalhe).

### 6.3 Integrações externas

- **ViaCEP** (busca de endereço por CEP): **NÃO** integrado no MVP. PRD §4 lista integração externa como fora de escopo. O usuário preenche manualmente.
- **Validação de telefone:** Zod regex. Sem lib externa.

### 6.4 Edge cases

- **Email vazio vs. ausente:** ambos são válidos (`z.string().optional().or(z.literal(""))`). Mas se preenchido, deve ser formato válido.
- **Email duplicado:** o schema Prisma tem `@unique` em `email`. Capturar `P2002` error code no service e retornar erro legível.
- **Datas no futuro:** Zod não bloqueia. **Decisão:** permitir (batismo pode ser agendado). PRD não veda.
- **dataBatismo < dataConversao:** bloqueado com `.refine()` do Zod.
- **Caracteres Unicode no nome:** permitido (Zod `.string()` aceita UTF-8).

---

## 7. RBAC

| Perfil | Pode criar | Pode editar (escopo) |
|---|:-:|:-:|
| ADMIN, PASTOR, SECRETARIO, FINANCEIRO | ✅ | ✅ qualquer |
| DISCIPULADOR | ✅ | ✅ apenas seus discípulos |
| LIDER_MINISTERIO | ✅ | ✅ qualquer (MVP) ou seu min. (sprint 2+) |

**Defesa em profundidade:**
- **UI:** form idêntico para todos (UX consistente).
- **Loader do `editar`:** `getMembroById(id, user)` já aplica escopo — DISCIPULADOR de outra célula recebe 404 (não vaza existência).
- **Action:** revalida escopo.

---

## 8. Acessibilidade

- **`<h1>`** = "Cadastrar novo membro" ou "Editar membro".
- **`<fieldset>`** para cada seção (Identificação, Contato, Eclesiástico, Endereço) com `<legend>` (algumas vezes visível, outras `sr-only`).
- **Labels associados** (`<label htmlFor>`).
- **Asterisco vermelho** em campos obrigatórios, com `<span aria-label="obrigatório">*</span>`.
- **Mensagens de erro** com `role="alert"`, `aria-describedby` apontando para a mensagem.
- **Tab order** natural (DOM order).
- **Foco visível** em todos os campos.
- **Submit desabilitado** (loading) tem `aria-busy="true"`.
- **Campos opcionais** claramente marcados como "(opcional)" no label.

---

## 9. Mobile

- **Layout vertical** (já é, naturalmente — campos empilhados).
- **Inputs full-width**, `min-h-[44px]`.
- **Botões** full-width, empilhados: "Cancelar" (ghost) em cima, "Cadastrar/Salvar" (primary) embaixo.
- **Teclado virtual:** `inputMode="email"` no email, `inputMode="tel"` no telefone, `inputMode="numeric"` no CEP e número.
- **`<input type="date">`** nativo — em mobile abre date picker do SO.

---

## 10. Critérios de aceite (testáveis)

### 10.1 Funcionais

- [ ] `GET /app/membros/novo` retorna 200 com form vazio, tipo default = "VISITANTE".
- [ ] `GET /app/membros/:id/editar` retorna 200 com form preenchido.
- [ ] `GET /app/membros/:id/editar` (ID inválido) retorna 404.
- [ ] Submit com dados válidos: 302 para `/app/membros/:id` (criar) ou `/app/membros/:id` (editar).
- [ ] Submit com `tipo=VISITANTE`: gera alerta atômico (RN-MEM-05).
- [ ] Submit com email inválido: 422, mensagem inline no campo.
- [ ] Submit com email duplicado: 422, mensagem "Este e-mail já está cadastrado.".
- [ ] Submit com `dataBatismo < dataConversao`: 422, mensagem no campo `dataBatismo`.
- [ ] Cancelar volta para a página anterior sem salvar.
- [ ] DISCIPULADOR editando membro de outra célula: 403.

### 10.2 LGPD / Segurança

- [ ] Payload de submit **nunca** inclui `cpf` ou outros campos sensíveis (grep no Zod schema).
- [ ] Form não tem campo `cpf`, `rg`, `cnpj` (verificação visual + grep).
- [ ] Senha não é setada via este form (apenas Admin em fluxo separado — fora do MVP).

### 10.3 UX

- [ ] Em viewport 375×667, todos os campos visíveis, scroll vertical.
- [ ] Tab navigation cobre todos os campos em ordem.
- [ ] Erros de validação aparecem abaixo do campo, não no topo.
- [ ] Submit desabilitado durante loading; "Cancelar" também.
- [ ] Máscara de telefone aplica `(__) _____-____` enquanto digita.
- [ ] Máscara de CEP aplica `_____-___`.
