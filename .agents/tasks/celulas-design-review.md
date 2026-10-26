# Review de design — Fase 1 de correções de `/app/celulas`

## Escopo e evidências consultadas

Revisei o design em `.agents/tasks/celulas-design.md` sem assumir que suas afirmações sobre o código eram verdadeiras. Conferi o schema Prisma, a RN-CEL-01, a matriz documental, `rbac.server.ts`, `celulas.server.ts`, os loaders/actions de criação, edição e detalhe, o formulário, `errors.ts`, `app/routes/app.tsx`, `Sidebar.tsx`, `MobileNavigation.tsx`, `TopbarAutenticada.tsx`, `app.css`, os tipos Prisma gerados, os testes de erros existentes e os chamadores encontrados no workspace.

## Findings

1. **[MEDIUM] A matriz de exclusão é declarada como centralizada, mas o design não define o helper que a aplica.**
   - **Onde:** seção 4, bloco `CELULAS_DELETE_CARGOS`/helpers exportados; implementação atual em `app/lib/celulas.server.ts:279-286`.
   - **Problema:** o design declara `CELULAS_DELETE_CARGOS = ADMIN, PASTOR` como parte da matriz canônica, mas só especifica `assertCanSeeCelulas`, `assertCanManageCelulas` e `canManageCelulas`. Também diz que a exclusão “continua” com o conjunto restrito, sem dizer para substituir o `if (user.cargo !== "ADMIN" && user.cargo !== "PASTOR")` atual. Isso deixa uma segunda fonte de verdade de autorização no service e permite que a matriz exportada e a defesa efetiva divirjam.
   - **Correção concreta:** especificar e usar um helper também para exclusão, por exemplo:
     ```ts
     export const CELULAS_DELETE_CARGOS = ["ADMIN", "PASTOR"] as const;
     export function canDeleteCelulas(user: SessionUser): boolean {
       return !!user.cargo && CELULAS_DELETE_CARGOS.includes(user.cargo as (typeof CELULAS_DELETE_CARGOS)[number]);
     }
     export function assertCanDeleteCelulas(user: SessionUser): void {
       if (!canDeleteCelulas(user)) {
         throw new Response("Apenas ADMIN ou PASTOR podem excluir células.", { status: 403 });
       }
     }
     ```
     `excluirCelula` deve chamar o assert; se o CTA de exclusão permanecer no detalhe, seu booleano deve derivar do mesmo helper. Alternativamente, retirar `CELULAS_DELETE_CARGOS` do plano e declarar explicitamente que exclusão fica fora da centralização, sem chamá-la de matriz canônica.

2. **[MEDIUM] O contrato de `liderId` no service não está fechado para criação, edição parcial e valores nulos.**
   - **Onde:** seção 2 (“Política de `liderId`”), seção 2 (“Arquivos e linhas atuais afetados”) e tabela “Tratamento de entradas”; código atual em `app/lib/celulas.server.ts:37-54`.
   - **Problema:** o design torna `liderId` obrigatório apenas no `CelulaFormSchema`, mas não define a alteração de `CriarCelulaInput`/`EditarCelulaInput`. Hoje o tipo de criação permite `liderId?: string` e o tipo de edição é `Partial<CriarCelulaInput>`. A política, porém, exige que a criação rejeite `undefined`, `null` e vazio, que a edição trate `undefined` como “manter”, e que vazio/null não remova a liderança. Sem uma assinatura e normalização explícitas, uma chamada direta ao service pode continuar compilando sem líder, e `null` não tem semântica definida no tipo embora apareça na política.
   - **Correção concreta:** escolher e documentar o contrato de domínio, por exemplo:
     ```ts
     type CriarCelulaInput = {
       nome: string;
       liderId: string; // não opcional; runtime ainda valida UUID e elegibilidade
       // demais campos...
     };

     type EditarCelulaInput = Omit<Partial<CriarCelulaInput>, "liderId"> & {
       /** undefined = mantém; string = substitui; ""/null = rejeita, nunca limpa */
       liderId?: string | null;
     };
     ```
     Definir também a guarda server-side (`undefined`/`null`/`""`/whitespace) e o erro/status para cada forma. A action pode continuar convertendo campos opcionais de texto para `""`, mas não deve usar essa conversão para `liderId` sem deixar claro que ela produz uma violação 409/422, não uma limpeza.

3. **[MEDIUM] O fallback de foco no resize pode ser executado enquanto `#main-content` ainda está `inert`.**
   - **Onde:** seção 5, subseção “Foco, Escape e resize”; `app/routes/app.tsx:49-60` aplica `inert` em `backgroundRef`, que contém `main`; `MobileNavigation.tsx:17-44` restaura foco no cleanup.
   - **Problema:** o design manda focar `fallbackFocusRef` quando o trigger cruza `1023 → 1024px`, mas também mantém o fundo inert enquanto `isMobileMenuOpen` é verdadeiro. O cleanup do efeito do drawer pode chamar `.focus()` antes do efeito de `AppShell` remover `backgroundRef.current.inert`. Nesse caso o navegador pode recusar o foco e o usuário fica sem restauração de foco, exatamente no caso de acessibilidade que a mudança pretende corrigir. A condição de visibilidade do trigger não resolve a ordem entre os dois efeitos.
   - **Correção concreta:** especificar a ordem, não apenas a intenção. Uma opção é o cleanup restaurar imediatamente listener/overflow e agendar a restauração de foco com `requestAnimationFrame` (ou um callback do `AppShell`) depois de `inert = false`; nesse callback revalidar `isConnected`, `getClientRects()` e `getComputedStyle`. Outra opção é mover a remoção do `inert` para `useLayoutEffect` e focar em um efeito posterior do `AppShell`. O teste E2E deve afirmar `document.activeElement === document.querySelector("#main-content")` após o resize, e que `#main-content` não está inert naquele momento.

4. **[MEDIUM] `take: 500` não garante a inclusão do líder atual na edição.**
   - **Onde:** seção 3 e tabela de entradas, que mantêm `take: 500` e afirmam que a edição incluirá o líder atual se elegível; `celulas.novo.tsx` e `celulas.$id.editar.tsx` atuais já usam esse limite.
   - **Problema:** com mais de 500 candidatos elegíveis, o `where` da edição pode incluir o líder atual, mas `orderBy: nome` + `take: 500` ainda pode cortá-lo quando ele estiver depois dos primeiros 500. O formulário então recebe `defaultValue` sem uma `<option>` correspondente, contradizendo a garantia do design e podendo forçar uma troca involuntária de liderança ou uma submissão inválida.
   - **Correção concreta:** definir uma política para o limite. A implementação pode buscar o líder atual elegível em uma segunda query `select: { id, nome }` e mesclá-lo/deduplicá-lo na lista (reservando uma posição para ele), ou remover o limite no fluxo de edição e manter o limite somente no novo cadastro com busca/paginação explícita. O design deve dizer qual opção vale e testar um líder atual ordenado após a posição 500.

5. **[MEDIUM] O mapeamento de `P2002` depende de um formato de `meta.target` ainda não verificado no adapter real.**
   - **Onde:** seção 2, subseção “Implementação do service e concorrência”; seção “Testabilidade e validação”, item de `P2002`.
   - **Problema:** o contrato exige distinguir conflito de `liderId`, conflito de `nome` e alvo desconhecido, mas a implementação atual só verifica `code === "P2002"` e não há no código evidência do formato produzido por Prisma 7 com `@prisma/adapter-better-sqlite3`. A aceitação de string/array no design é defensiva, mas os testes descritos podem ser apenas mocks com formatos escolhidos pelo teste; isso não confirma que uma corrida real no SQLite fornece esses campos. Sem essa confirmação, um conflito de nome pode virar erro fatal ou um conflito de liderança pode receber mensagem errada.
   - **Correção concreta:** exigir teste de integração contra o Prisma/adapter efetivamente usado, provocando duplicidade real de `Celula.nome` e de `Celula.liderId` e registrando a forma de `meta.target`. Manter um type guard para string/array e o relançamento de alvo desconhecido. Se o adapter não fornecer o alvo de modo confiável, substituir a dependência por uma estratégia determinística documentada (por exemplo, reconsulta específica após o P2002, sempre sem mascarar erro desconhecido) antes de prometer as mensagens diferenciadas.

## Verified Assumptions

- `prisma/schema.prisma` confirma `Cargo` como `ADMIN`, `PASTOR`, `SECRETARIO`, `FINANCEIRO` e `LIDER_MINISTERIO`; não existe `DISCIPULADOR` no enum real.
- `TipoMembro` real contém `MEMBRO_ATIVO`, `CONGREGADO` e `VISITANTE`.
- `Membro.ministerios` é uma lista `MinisterioMembro[]`; `MinisterioMembro` tem `membroId`, `ministerioId` e `lider`.
- `Membro.celulaLiderada` é relação opcional 1:1 e `Celula.liderId` é `String? @unique` com `onDelete: SetNull`. A nullable e a unicidade alegadas pelo design são reais.
- `Celula.status` é `String` com default `"ATIVA"`, não enum. `CelulaFormSchema` atualmente limita o formulário a `ATIVA`, `EM_FORMACAO` e `INATIVA`, portanto a derivação `status === "ATIVA"` é coerente e não conta status legado desconhecido.
- `ministerios: { some: {} }`, `celulaLiderada: null` e uma relação 1:1 com `is: { id: ... }` são formas representáveis pelos tipos Prisma gerados para o schema real. A exigência de ministério da RN-CEL-01 não foi inventada.
- A RN-CEL-01 em `docs/REGRAS_DE_NEGOCIO.md` exige um líder por célula, liderança única e vínculo com ao menos um ministério, com validação no service; ela não menciona `tipo != VISITANTE`.
- Os loaders atuais de criação e edição consultam `prisma.membro.findMany` diretamente sem assert de gestão. O loader de edição chama `buscarCelula` antes da consulta de candidatos; como `buscarCelula` retorna o nome do líder, a ordem proposta pelo design — assert de gestão antes dessa chamada — é necessária para cumprir a não exposição a leitores.
- O service atual mantém três listas locais (`CARGO_LEITURA`, `CARGO_ESCRITA`, `CARGO_VINCULAR`); `rbac.server.ts` não possui helpers de Células hoje. Logo, a centralização proposta exige uma adição real, não apenas a reutilização de um helper de Células já existente.
- `app/routes/app.tsx` usa `matchMedia("(min-width: 781px)")` e classes `min-[781px]`; `Sidebar.tsx` e `MobileNavigation.tsx` também usam 781px, enquanto o trigger de `TopbarAutenticada` já usa `lg:hidden` (1024px). `app.css` possui uma margem concorrente em `@media (min-width: 1024px)`. A existência do estado local separado da Sidebar e do estado em `AppShell` também foi confirmada.
- O fundo inert atual é o `div.main-area`, e `#main-content` está dentro dele sem `tabIndex={-1}`. O design identificou corretamente ambos os pontos que precisam mudar para o fallback.
- `NotFoundError` atualmente aceita apenas `message`; adicionar um discriminador opcional é compatível com os usos existentes e com o teste atual que omite esse discriminador.
- O arquivo `.harness/RAG/security-rbac-matrix.md` citado por `rbac.server.ts` e pela matriz documental não existe no workspace. Portanto ele não serve como evidência para decidir `DISCIPULADOR` ou o escopo de `LIDER_MINISTERIO`.

## Unverified/Wrong Assumptions

- **Errada/incompleta:** a afirmação de que toda a matriz de Células ficará centralizada não se sustenta enquanto a autorização de exclusão continuar inline e sem helper correspondente.
- **Não verificada:** o formato de `error.meta.target` para os conflitos reais no Prisma 7 + `better-sqlite3`; o design precisa do teste de integração descrito no finding 5 antes de tratar essa parte como resolvida.
- **Não verificada:** a ordem efetiva entre a remoção de `inert` no efeito de `AppShell` e o foco no cleanup de `MobileNavigation`; sem uma ordem explícita, a garantia de foco no resize não está demonstrada.
- **Não verificada:** a inclusão do líder atual quando a consulta de edição atinge o limite de 500; o `where` correto, sozinho, não garante que o registro sobreviva ao `take`.
- **Pendente por decisão de produto, não por palpite técnico:** `DISCIPULADOR` continua fora porque não existe no enum real; `LIDER_MINISTERIO` continua com a leitura global efetiva apenas como compatibilidade desta fase, sem alegar que isso implementa o escopo documental futuro. O design não deve transformar essa pendência em filtro ou cargo inventado.

## Veredito mecânico

Há **5 achados MEDIUM** e nenhum achado HIGH. Como a regra do review bloqueia com qualquer HIGH ou MEDIUM, o veredito é **CHANGES_REQUESTED**.
