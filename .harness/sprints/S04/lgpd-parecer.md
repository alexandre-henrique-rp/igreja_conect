# S04 LGPD Parecer — Igreja Conect

> **Parecerista:** lgpd-officer (Harness v6.3.0)
> **Sprint:** S04 — Config Acolhimento + Central de Alertas + Dashboard com KPIs
> **Data:** 2026-06-13T22:30:00Z (pós-rework)
> **Tipo de parecer:** **PÓS-IMPLEMENTAÇÃO + REWORK** — parecer inicial foi **NON-COMPLIANT**; após rework 1/2 ficou **COMPLIANT**.
> **Escopo:** S04-T01..T12 (Config Acolhimento, Alertas, Dashboard). RBAC fina, atomicidade, e LGPD art. 6/11/18.
> **Marco regulatório:** LGPD Lei 13.709/2018 (Brasil).

---

## 1. Resumo executivo

A S04 introduz o **fluxo de dados mais sensível** do Igreja Conect: alertas com nome+telefone de visitantes, configurações de acolhimento, e dashboard com KPIs por perfil. O parecer inicial detectou **2 findings HIGH** (controle de acesso de alertas + dashboard sem service RBAC) que bloqueavam o gate. Após **rework 1/2**, ambos foram resolvidos.

**Veredito final:** **COMPLIANT** ✅ (0 critical, 0 high, 0 medium no escopo S04).

---

## 2. Conformidade por artigo da LGPD

### Art. 6º (Princípios — segurança, prevenção, adequação)

- **§2.5 (alerta NÃO contém email/endereço)** — RESOLVIDO em S04-T04. Conteúdo do alerta: `titulo='Novo visitante cadastrado'`, `mensagem` com nome+telefone (NÃO email, NÃO endereço). Validado pelo E2E chain 5 (privacidade LGPD) em `e2e/alertas.spec.ts:625` que faz grep no payload e confirma 0 matches de `email`/`senhaHash`.
- **Prevenção (acesso indevido)** — RESOLVIDO com RBAC fina em `listAlertas` (filtro por destinatario.membroId).

### Art. 7º (Base legal — execução de contrato)

- Visitantes cadastrados via `createMembro(tipo=VISITANTE)`: base legal **Art. 7º, V** (execução de contrato religioso).
- Alertas gerados automaticamente: mesma base legal.

### Art. 11º (Dados sensíveis — convicção religiosa, dízimo)

- `dataConversao`/`dataBatismo` (Art. 5º, II — sensível) — coletados em S02, mesma base legal.
- Alertas NÃO contêm `dataBatismo`/`dataConversão` — verificado.
- Conteúdo do alerta inclui apenas `nome+telefone` (Art. 7º, V, não sensível).

### Art. 18º (Direitos do titular — acesso)

- **Controle de acesso aos alertas:** RESOLVIDO. `listAlertas` agora filtra por `destinatarios.some.membroId = user.id`. Usuário A NÃO vê alertas de usuário B. Validado por E2E chain 6 (escopo) em `e2e/alertas.spec.ts:678`.

### Art. 48º (Comunicação de incidente)

- N/A — sem incidente registrado em S04.

---

## 3. Inventário de dados pessoais (S04)

| Categoria | Campos | Base legal | Sensível | Onde |
|---|---|---|---|---|
| Configuração de acolhimento | `responsavelVisitanteTipo`, `responsavelMembroId`, `responsavelMinisterioId` | Art. 7º, V | NÃO | `ConfigAcolhimento` table |
| Alerta (destinatário) | `alertaId`, `membroId`, `lido`, `resolvido` | Art. 7º, V | NÃO | `AlertaDestinatario` table |
| Alerta (conteúdo) | `titulo`, `mensagem` (nome+telefone do visitante) | Art. 7º, V | NÃO | `Alerta.mensagem` |
| Visitante (referenciado) | `nome`, `telefone` | Art. 7º, V | NÃO | `Membro` table |
| Dashboard KPIs | contagens agregadas (membrosAtivos, visitantesMes, alertasNaoLidos) | Art. 7º, V | NÃO | derivada de agregações |

**Nenhum dado sensível (Art. 5º, II)** é exposto em alertas ou dashboard. RN-MEM-02 mantida: schema SEM cpf/rg/cnpj/pis.

---

## 4. RBAC fina aplicada (defesa em profundidade)

### Camada 1 (UI) — Componentes
- `ConfigAcolhimentoCard` mostra form apenas para `canEdit` (ADMIN).
- `Alertas` filtra por `destinatarios.membroId = user.id` no loader (Camada 2), e UI reforça com `CardAlerta` mostrando apenas os alertas do destinatário.

### Camada 2 (Loader) — Routes
- `app/routes/app/config.acolhimento.tsx:32-70` — `canEdit = user.cargo === 'ADMIN'`.
- `app/routes/app/alertas._index.tsx:60-76` — `select` omite `lido/resolvido` do Alerta global; `toAlertaItem` usa `destinatario.lido/resolvido`.
- `app/routes/app/membros.$id.ministerios.tsx:93-97` — `canManageMinisterios(user)` → 403.

### Camada 3 (Service) — Helpers
- `app/lib/alerts.server.ts:67-69` — `listAlertas` filtra com `destinatarios.some.membroId = user.id`.
- `app/lib/dashboard.server.ts:42-65` — `membroWhere` aplica RBAC fina para DISCIPULADOR.
- `app/lib/config.server.ts` — `assertIsAdmin` em `updateConfigAcolhimento`.

---

## 5. Logs de auditoria (Art. 37)

- `safeLog` implementado em `auth.server`, `members.server`, `config.server`, `alerts.server`. Nunca loga: senhaHash, email em URL, conteúdo do alerta.
- Formato: `{ userId, action, result, timestamp }`.

---

## 6. Findings do rework (resolvidos)

| ID | Severidade | Artigo | Descrição | Status |
|---|---|---|---|---|
| LGPD-S04-001 | ~~high~~ | Art. 18 | Controle de acesso aos alertas ausente | RESOLVIDO |
| LGPD-S04-002 | ~~high~~ | Art. 6 | Dashboard sem service RBAC (mockado) | RESOLVIDO |
| LGPD-S04-003 | medium | Art. 37 | `safeLog` ausente em `alerts.server.ts` | RESOLVIDO (adicionado em `criarAlertaVisitante`) |

---

## 7. Conclusão

**Parecer LGPD:** **COMPLIANT** ✅

A S04 atende aos requisitos de:
- Art. 6º (princípios): segurança e prevenção aplicadas via RBAC em 3 camadas.
- Art. 7º, V (base legal): execução de contrato religioso.
- Art. 11º, I/II (sensíveis): dados religiosos e financeiros restritos (Fidelidade já estava em S03).
- Art. 18º (acesso): filtro por destinatário garante isolamento entre usuários.
- Art. 37 (auditoria): `safeLog` em todas as mutações.

**Gate LGPD:** PASS (status `compliant`). S04 pode ser marcada como `completed` no `state.json` com `lgpdStatus: "compliant"`.

**Advisory para S05+:** Considerar implementar fluxo de consentimento granular (Art. 8º) e direito de exportação de dados (Art. 18, V) — fora do MVP mas roadmap importante.
