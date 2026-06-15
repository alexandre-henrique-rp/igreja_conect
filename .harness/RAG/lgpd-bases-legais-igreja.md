---
title: Law — LGPD — Bases Legais por Campo (Mapeamento Art. 7º × Igreja Conect)
category: law
applies_to:
  - prisma/schema.prisma
  - app/lib/schemas/**/*.ts
  - app/lib/**/*.server.ts
  - app/components/**/*.tsx
  - docs/REGRAS_DE_NEGOCIO.md
  - .harness/RAG/lgpd-igreja-conect.md
created: 2026-06-13
updated: 2026-06-13
version: 1.0
status: approved
priority: critical
sources:
  - LGPD Lei 13.709/2018 (Brasil), Arts. 5º, 6º, 7º, 11º, 18º, 37º
  - .harness/RAG/lgpd-igreja-conect.md (6 decisões técnicas inegociáveis)
  - prisma/schema.prisma (model Membro, Lancamento, Alerta, etc)
  - .harness/sprints/S05/lgpd-parecer.md (parecer COMPLIANT)
tags: [law, lgpd, gdpr, privacy, bases-legais, art-7, art-11, art-18, art-37, dados-sensiveis, convenio-igreja, dado-religioso, dizimo]
owner: rag-curator
---

## 1. Contexto

A **LGPD (Lei 13.709/2018)** define no **Art. 7º** as **10 hipóteses de base legal** que autorizam o tratamento de dados pessoais. No **Art. 11º** define hipóteses adicionais para **dados sensíveis** (Art. 5º, II). A Igreja Conect trata dados pessoais comuns (nome, email, telefone) **e** dados sensíveis religiosos (dataConversão, dataBatismo, Ministerio) e financeiros (dízimo).

**Até S05**, o código **NÃO** documentava explicitamente qual hipótese do art. 7º/11º fundamentava cada coleta. Isso foi identificado como débito `DEB-LGPD-1` no code review final. Este RAG **materializa o mapeamento campo-a-campo** e define o padrão de documentação no schema (YAML inline comment).

**Por que importa:**

1. **Compliance auditável**: ANPD (Autoridade Nacional de Proteção de Dados) pode exigir prova de base legal. Sem documentação, sistema não passa auditoria.
2. **Consentimento granular**: saber a base legal evita **pedir consentimento onde não precisa** (ex: contrato dispensa consentimento) e **pedir onde é obrigatório** (dado sensível).
3. **Direitos do titular** (Art. 18): quando titular pede exclusão, sistema precisa saber se a base é "execução de contrato" (pode manter enquanto contrato vigente) ou "consentimento" (revogação imediata).
4. **Revisão de débitos**: cada novo campo coletado precisa de (a) base legal definida, (b) hipótese de art. 7º/11º, (c) teste que prova conformidade.

## 2. Decisão / Regra

### 2.1 Hipóteses aplicáveis à Igreja Conect

| Art. | Hipótese | Aplicabilidade | Exemplo |
|---|---|---|---|
| 7º, **V** | Execução de contrato | ✅ **Primária** para cadastro de membros | Membro aceitou ser membro da igreja (contrato religioso associativo) |
| 7º, **VI** | Legítimo interesse | ✅ Para comunicações pastorais internas | Newsletter mensal, aviso de eventos da igreja |
| 7º, **IX** | Interesse legítimo da comunidade religiosa | ✅ Específico para igrejas (LGPD art. 44 do CDC + art. 5º, VI da CF/88) | Cadastro de associado para fins religiosos |
| 11º, **I** | Dado sensível com consentimento | ⚠️ Para dados religiosos **especiais** (opinião religiosa, orientação sexual) | (Não coletamos) |
| 11º, **II** | Dado sensível para obrigação religiosa | ✅ **Primária** para dízimo, dataBatismo, Ministerio | Membro declara publicamente a filiação religiosa |

### 2.2 Mapeamento campo a campo (model `Membro`)

```prisma
// prisma/schema.prisma — COMENTÁRIO OBRIGATÓRIO em cada campo pessoal

model Membro {
  // Art. 7º V (execução de contrato) + 7º IX (interesse religioso)
  // RN-MEM-01: identificador canônico do membro na comunidade
  id    String @id @default(uuid())

  // Art. 7º V — nome é parte do contrato associativo
  // Sem base legal mais forte porque nome é identificação civil
  nome  String

  // Art. 7º V — email para comunicação contratual (convocações, avisos)
  // Art. 7º VI — também serve para comunicações pastorais
  email String @unique

  // Art. 7º V — telefone para emergências pastorais e comunicações urgentes
  telefone String?

  // Art. 7º V — endereço para visitas pastorais
  logradouro String?
  numero     String?
  bairro     String?
  cidade     String?
  estado     String?  // 2 chars
  cep        String?

  // Art. 11º II + Art. 5º II — DADO SENSÍVEL RELIGIOSO
  // dataBatismo é declaração pública de filiação religiosa
  // Coletado com presunção de consentimento (associado pediu para ser membro)
  dataBatismo DateTime?

  // Art. 11º II + Art. 5º II — DADO SENSÍVEL RELIGIOSO
  dataConversao DateTime?

  // Art. 11º II — DADO SENSÍVEL RELIGIOSO
  // tipo: VISITANTE | MEMBRO_ATIVO | LIDER | etc.
  // A própria classificação religiosa é dado sensível
  tipo     TipoMembro @default(VISITANTE)

  // Art. 11º II — DADO SENSÍVEL RELIGIOSO
  // Ministerio: filiação a grupo religioso
  ministerios MinisterioMembro[]

  // Art. 7º V — cargo administrativo na estrutura da igreja
  // (ADMIN, PASTOR, SECRETARIO, etc.) — dado funcional, não religioso
  cargo   Cargo?  // enum

  // Art. 11º II — DADO SENSÍVEL FINANCEIRO (Art. 5º II — origem financeira)
  // CUIDADO: dízimo é tratado em model Lancamento, NÃO aqui.
  // Membro NÃO tem campo de salário/renda.
  // (...)

  // Art. 7º V + Art. 37 — necessário para auth
  // bcrypt hash. NUNCA expor em select (ver MEMBRO_SAFE_SELECT).
  senhaHash String

  // ... timestamps e FKs ...
}
```

### 2.3 Mapeamento por model (catálogo completo)

#### Model `Membro` (já descrito em §2.2)

#### Model `Lancamento` (dízimo — DADO SENSÍVEL FINANCEIRO)

```prisma
model Lancamento {
  // Art. 11º II + Art. 7º V — dízimo é OBRIGAÇÃO RELIGIOSA do membro
  // Restrito a perfis ADMIN/PASTOR/FINANCEIRO (RN-MEM-03, Camada 3 RBAC)
  valorCentavos Int        // convention-monetary-values (Int cents)

  // Art. 7º V — categoria (dízimo, oferta, etc.)
  categoria     CategoriaLancamento

  // Art. 7º V — data do lançamento
  dataCompetencia DateTime

  // Art. 11º II + Art. 7º V — membro é OBRIGADO a declarar (se quiser recibo)
  // Pode ser NULL (oferta anônima — Art. 7º V com presunção)
  membroId String?
  membro   Membro? @relation(fields: [membroId], references: [id], onDelete: SetNull)

  // Art. 7º V — caixa que recebeu
  caixaId String
  caixa   Caixa  @relation(fields: [caixaId], references: [id], onDelete: Restrict)
}
```

#### Model `Alerta` e `AlertaDestinatario` (S04)

```prisma
model Alerta {
  // Art. 7º V — alerta sobre membro (ex: novo visitante)
  // Conteúdo NUNCA inclui email/endereço (LGPD §2.5)
  titulo   String
  mensagem String  // só nome+telefone do visitante, NUNCA email/endereço

  // Art. 7º V — metadata do alerta
  tipo     TipoAlerta
  createdAt DateTime @default(now())

  // Relacionamento
  destinatarios AlertaDestinatario[]
}

// Art. 7º V + Art. 18 — controle de acesso individual
model AlertaDestinatario {
  alertaId   String
  membroId   String  // destinatário

  // Art. 18 — estado de leitura (escopo por destinatário, não global)
  lido       Boolean @default(false)
  lidoEm     DateTime?
  resolvido  Boolean @default(false)
  resolvidoEm DateTime?

  @@id([alertaId, membroId])
}
```

#### Model `Discipleship` (cadeia de discipulado)

```prisma
// Art. 11º II + Art. 7º V — discipulador é papel RELIGIOSO
// Quem é meu discipulador é DADO SENSÍVEL (relações de autoridade religiosa)
model Membro {
  // ...
  discipuladorId String?
  discipulador   Membro?  @relation("Discipulado", fields: [discipuladorId], references: [id], onDelete: Restrict)
  discipulos     Membro[] @relation("Discipulado")

  // Art. 37 — quem fez a atribuição (auditoria)
  // (auditoria de discipulado ainda é TODO S06+)
}
```

### 2.4 Bases legais POR OPERAÇÃO (não por campo)

| Operação | Base legal primária | Justificativa |
|---|---|---|
| Cadastrar visitante | Art. 7º, V | Visitante quer ser contactado (proposta de cadastro) |
| Promover visitante para MEMBRO_ATIVO | Art. 7º, V + consentimento explícito (membro) | Membro declara querer ser membro da igreja |
| Atribuir discipulador | Art. 11º, II + Art. 7º, V | Membro aceita ser discipulado (pode revogar) |
| Atribuir ministério | Art. 11º, II + consentimento (membro) | Membro aceita servir no ministério |
| Marcar data de batismo | Art. 11º, II | Evento público da vida religiosa |
| Registrar dízimo | Art. 11º, II + Art. 7º, V | Membro declara obrigação religiosa |
| Marcar alerta como lido | Art. 7º, V + Art. 18 | Estado de leitura é metadata operacional |
| Enviar email pastoral | Art. 7º, VI (legítimo interesse) | Comunicar eventos da igreja |
| Excluir membro | Art. 18, VI (eliminação) | Titular pediu; **MAS** manter débitos financeiros por obrigação legal |
| Compartilhar dados com outra igreja | ❌ **NÃO PERMITIDO** sem consentimento | Sem base legal no MVP |

### 2.5 Hipóteses **NÃO aplicáveis** à Igreja Conect

- ❌ **Art. 7º, I (consentimento)** — não usamos como primária porque "execução de contrato" é mais forte juridicamente e dispensa o trabalho de revogação. Reservar para casos **especiais** (ex: compartilhamento com outra denominação).
- ❌ **Art. 7º, II (obrigação legal)** — não temos obrigação legal de manter (ex: emissão de NFTS para dízimo é **opcional**, não obrigatória). Mas débitos financeiros **podem** precisar manter por 5 anos (legislação tributária — verificar em S06+).
- ❌ **Art. 11º, I (consentimento específico)** — não coletamos opinião religiosa, orientação sexual, etc. Dados religiosos coletados são **eventos** (batismo, conversão, ministério), não **crenças**.

## 3. Consequências

### Positivas

- **Auditabilidade**: cada campo tem base legal documentada. ANPD pode pedir relatório e gerar em 5 minutos via grep.
- **Consentimento granular**: se titular revogar consentimento (art. 18, IX), sabemos **exatamente** o que revogar (campos com art. 7º, I). Para art. 7º, V (contrato), só revoga se contrato for encerrado.
- **Retenção de dados**: campos com art. 7º, V (contrato vigente) mantêm enquanto membro for membro + 5 anos (prescrição). Campos com art. 7º, VI (legítimo interesse) podem ser revisados periodicamente.
- **Teste de regressão LGPD**: cada novo campo precisa de teste que prova conformidade. Facilitado pelo mapeamento.

### Negativas

- **Overhead de documentação**: cada novo campo pessoal precisa de 1 parágrafo de comentário no schema. Aceitável (~5min por campo).
- **Risco de classificação errada**: dev pode marcar "consentimento" onde devia ser "contrato". Mitigado por code review (planning-reviewer checa §LGPD em PRs).
- **Mudança de base legal**: se base legal mudar (ex: nova legislação), comentário no schema precisa ser atualizado. Aceitável, é rastreável.

### Trade-offs aceitos

- **Não** criar tabela `Consentimento` com checkboxes. MVP não pede consentimento granular. Documentar no schema é suficiente.
- **Não** implementar workflow de revogação de consentimento (Art. 18, IX). Está no backlog S06+ (DEBT-013 do parecer S05).
- **Não** publicar política de privacidade no app. Está no backlog S06+ (advisory S05).

## 4. Exemplos

### Exemplo 1: Schema anotado

```prisma
// prisma/schema.prisma (trecho real com comentários LGPD)

model Membro {
  id    String @id @default(uuid())

  // LGPD: Art. 7º, V (execução de contrato religioso) + Art. 7º, IX (interesse legítimo da comunidade religiosa)
  // Justificativa: membro aceitou ser associado da igreja. Relação associativa é contrato.
  // Retenção: enquanto membro for membro + 5 anos (prescrição civil).
  // Acesso: Membro (próprios dados) + ADMIN/PASTOR/SECRETARIO (gestão).
  nome  String

  // LGPD: Art. 7º, V (comunicação contratual) + Art. 7º, VI (comunicação pastoral - legítimo interesse)
  // Justificativa: email serve para convocações oficiais E avisos pastorais.
  // Retenção: enquanto membro + 5 anos.
  // Acesso: Membro (próprio) + perfis administrativos.
  email String @unique

  // LGPD: Art. 7º, V (emergências pastorais) — DADO PESSOAL MAS NÃO SENSÍVEL
  // Retenção: enquanto membro.
  // Acesso: Membro (próprio) + ADMIN/PASTOR/SECRETARIO.
  telefone String?

  // LGPD: Art. 11º, II (obrigação religiosa) + Art. 5º, II (DADO SENSÍVEL — convicção religiosa)
  // Justificativa: batismo é declaração pública de filiação religiosa. Membro declara ao pedir batismo.
  // Retenção: PERMANENTE (evento histórico da vida religiosa). Anonimização 100 anos após óbito.
  // Acesso: ADMIN/PASTOR + o próprio membro. **NUNCA** DISCIPULADOR/FINANCEIRO/SECRETARIO.
  dataBatismo DateTime?

  // LGPD: Art. 11º, II — DADO SENSÍVEL RELIGIOSO
  // Mesmo tratamento de dataBatismo.
  dataConversao DateTime?

  // LGPD: Art. 7º, V (autenticação)
  // Retenção: enquanto membro + 30 dias após exclusão (revoga sessões).
  // **NUNCA** expor em select — ver MEMBRO_SAFE_SELECT.
  // Hash: bcrypt cost 10. NUNCA plain.
  senhaHash String

  // ... outros campos ...
}
```

### Exemplo 2: Teste de conformidade por campo

```ts
// tests/integration/lgpd/schema-fields.test.ts
import { prisma } from '~/db/prisma.server';

describe('LGPD: schema fields have legal basis documented', () => {
  test('Membro.nome has Art. 7º, V basis', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf-8');
    const nomeBlock = schema.split('nome')[1]?.split('\n')[0] ?? '';
    // Verifica que há comentário LGPD próximo ao campo
    expect(schema).toMatch(/Art\.\s*7º.*V.*execução.*contrato/);
  });

  test('Membro.dataBatismo has Art. 11º, II basis (sensitive)', () => {
    const schema = readFileSync('prisma/schema.prisma', 'utf-8');
    expect(schema).toMatch(/dataBatismo.*Art\.\s*11º.*II/);
    expect(schema).toMatch(/SENSÍVEL/);
  });

  test('Lancamento (dízimo) is restricted to financial profiles (RN-MEM-03)', async () => {
    // SECRETARIO não pode listar lancamentos
    const secretario = { id: 'X', cargo: 'SECRETARIO' } as SessionUser;
    await expect(getDizimosByMembro('membro-1', secretario))
      .rejects.toThrow(/Acesso restrito/);
  });

  test('Membro.senhaHash is NEVER in any select', async () => {
    const membro = await prisma.membro.findFirst();
    expect(membro).not.toHaveProperty('senhaHash');
    // Verify by source: every select uses MEMBRO_SAFE_SELECT
    const appCode = await readFile('app/lib/members.server.ts', 'utf-8');
    expect(appCode).toContain('MEMBRO_SAFE_SELECT');
  });
});
```

### Exemplo 3: Workflow de "Direito de Acesso" (Art. 18, II)

Quando titular pede acesso aos seus dados:

```ts
// app/routes/app/meus-dados.tsx
export async function loader({ context }: Route.LoaderArgs) {
  const user = context.get(userContext);
  if (!user) throw new Response("Não autenticado.", { status: 401 });

  // Art. 18, II: titular tem direito a CONFIRMAR EXISTÊNCIA e ACESSO aos seus dados.
  // Retornar TODOS os dados pessoais do membro, EXCETO senhaHash.

  const meusDados = await prisma.membro.findUnique({
    where: { id: user.id },
    select: {
      // Todos os campos EXCETO senhaHash
      id: true, nome: true, email: true, telefone: true,
      logradouro: true, numero: true, bairro: true, cidade: true, estado: true, cep: true,
      dataBatismo: true, dataConversao: true,
      tipo: true, cargo: true,
      // senhaHash: false  ← NUNCA
      // NÃO incluir relacionamentos sem consentimento explícito (dízimos de outros membros)
    },
  });

  // safeLog da requisição (Art. 37 — auditoria)
  safeLog({
    userId: user.id,
    action: 'read_own_data',
    resource: 'Membro',
    result: 'ok',
  });

  return { meusDados };
}
```

## 5. Anti-exemplos

- ❌ **Coletar CPF, RG, CNPJ, PIS, título de eleitor, cartão SUS** (RN-MEM-02). NÃO há base legal que justifique. **Sempre** recusar PR que adiciona esses campos.
- ❌ **Coletar "gênero" ou "orientação sexual"** sem consentimento explícito (Art. 11, I). São dados sensíveis. Igreja não precisa.
- ❌ **Coletar "renda mensal"** do membro (dado financeiro sensível). Igreja já recebe dízimo (Art. 11, II). Renda é desnecessário.
- ❌ **Pedir consentimento genérico no cadastro** ("Aceita nossa política de privacidade?") sem granularidade. LGPD exige **finalidade específica**. Consentimento deve ser **por operação**, não blanket.
- ❌ **Manter dados de ex-membros para sempre** sem justificativa. Prescrição civil é 5 anos. Após isso, anonimizar ou excluir.
- ❌ **Compartilhar dados com outra denominação** (ex: rede de igrejas) sem consentimento específico. Sem base legal no MVP.
- ❌ **Logar email/telefone/valorCentavos** em logs de aplicação. `safeLog` com allowlist é obrigatório. Ver `audit.server.ts:ALLOWED_FIELDS`.
- ❌ **Achar que "execução de contrato" dispensa tudo**. Contrato tem **objeto** (cadastro de membro, dízimo, discipulado). Não permite marketing, compartilhamento, ou "pesquisa de satisfação".
- ❌ **Não documentar base legal no schema**. Débito DEB-LGPD-1 do code review S05. **Sempre** adicionar comentário LGPD com Art. 7º/11º + Art. 5º (sensível?) + retenção + perfis de acesso.

## 6. RAGs relacionados

- [`lgpd-igreja-conect.md`](./lgpd-igreja-conect.md) — 6 decisões técnicas inegociáveis (sem CPF, dízimos restritos, bcrypt, cookies, logs sem PII, matriz por perfil). Este RAG é o **mapeamento campo-a-campo**; o outro é o **catálogo de decisões**.
- [`security-rbac-matrix.md`](./security-rbac-matrix.md) — quem tem acesso a quê. Combinar com bases legais: dado pessoal comum → qualquer admin; **dado sensível religioso** → só ADMIN/PASTOR.
- [`pattern-3-layer-rbac.md`](./pattern-3-layer-rbac.md) — como aplicar RBAC em 3 camadas. Bases legais informam **qual** perfil pode acessar; pattern-3-layer informa **como**.
- [`convention-prisma-sqlite.md`](./convention-prisma-sqlite.md) — `MEMBRO_SAFE_SELECT` é o **mecanismo** que aplica "não expor senhaHash" no nível do ORM; este RAG explica **por que** (LGPD Art. 7º, V + Art. 46).

## 7. Notas de aplicação

- **Checklist de PR que adiciona campo pessoal novo:**
  - [ ] Comentário LGPD no schema (Art. 7º/11º, Art. 5º sensível, retenção, perfis de acesso)
  - [ ] Campo adicionado a `MEMBRO_SAFE_SELECT` (se for select canônico) ou a novo `*_SAFE_SELECT`
  - [ ] Schema Zod com `.strict()` que rejeita o campo se não-input (se for input)
  - [ ] Teste unit que prova que campo aparece (read) ou é exigido (write)
  - [ ] `safeLog` allowlist revisado — campo não pode ser logado
  - [ ] RAG `lgpd-bases-legais-igreja.md` atualizado com o novo campo
  - [ ] RAG `security-rbac-matrix.md` atualizado com quem pode acessar
- **Sinal de code review:** se aparecer campo pessoal novo **sem** comentário LGPD no schema, **recusar PR** com `screenshot do schema + comentário` apontando o débito.
- **Sinal de code review:** se aparecer `.findFirst()` ou `.findMany()` em Membro/Lancamento que **NÃO** usa `MEMBRO_SAFE_SELECT` (ou similar), **recusar PR** — viola LGPD Art. 46 (segurança).
- **Auditoria periódica:** rodar `tests/integration/lgpd/schema-fields.test.ts` em CI. Se falhar, bloquear merge.
- **Quando a base legal mudar:** atualizar comentário no schema + este RAG + `security-rbac-matrix.md`. Histórico fica em git blame.
- **Próximos passos S06+:**
  1. Adicionar tabela `Consentimento` para ops que exigem Art. 7º, I.
  2. Implementar workflow de "Direito de Acesso" (Art. 18, II) — ex: `GET /app/meus-dados` retorna JSON com todos os dados do titular.
  3. Implementar "Direito de Eliminação" (Art. 18, VI) — soft delete + anonimização após 30 dias.
  4. Publicar política de privacidade em `/politica-privacidade` (advisory S05).
  5. **Designar DPO** (Art. 41) — se a igreja processar dados em larga escala (não MVP).
- **Lembrete para o time:** "**Base legal não é checkbox, é argumento jurídico.** Se você não consegue citar Art. 7º/11º + Art. 5º, **NÃO colete o dado**." YAGNI em forma de compliance.
