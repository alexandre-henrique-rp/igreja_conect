# Assessment B — detector determinístico + evidência de browser

**Escopo:** somente leitura. Nenhum arquivo do app foi editado, nenhum commit foi criado e nenhum servidor do app foi iniciado por esta etapa. O único artefato escrito é este arquivo.

## 1. Detector determinístico

Comando executado **exatamente uma vez**, a partir da raiz `/home/kingdev/Documentos/igreja_conect`:

```text
.kiro/skills/impeccable/scripts/impeccable detect --json /home/kingdev/Documentos/igreja_conect/app
```

- Exit code: **2** (há achados).
- Total: **137 achados**.
- Árvore: **401 arquivos rastreados em `app`**, sendo **274 arquivos markup-like** (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.astro`, `.html`, `.md`); abaixo do limiar de 500, portanto não foi necessário estreitar o alvo.
- O alvo passado foi o diretório `app`, não um arquivo CSS-only. Os achados de `app/app.css` aparecem porque o detector percorreu o diretório/import graph.

### Contagem por regra

| Regra (`antipattern`) | Nome | Contagem | Severidade observada |
|---|---|---:|---|
| `design-system-font-size` | Font size outside DESIGN.md | 96 | advisory |
| `design-system-radius` | Radius outside DESIGN.md | 19 | advisory |
| `design-system-color` | Color outside DESIGN.md | 16 | advisory |
| `side-tab` | Side-tab accent border | 4 | warning |
| `overused-font` | Overused font | 1 | warning |
| `border-accent-on-rounded` | Border accent on rounded element | 1 | warning |
| **Total** |  | **137** | **131 advisory + 6 warning** |

### Arquivos envolvidos e contagens

A contagem abaixo é por ocorrência total do detector no arquivo; as localizações exatas (linha, snippet, regra, severidade, `importedBy` e `ignoreValue`) estão no JSON bruto capturado, referenciado na seção seguinte.

```text
77  /home/kingdev/Documentos/igreja_conect/app/app.css
10  /home/kingdev/Documentos/igreja_conect/app/routes/app/financeiro.relatorios.fluxo-caixa.tsx
6   /home/kingdev/Documentos/igreja_conect/app/routes/app/escalas._index.tsx
5   /home/kingdev/Documentos/igreja_conect/app/routes/app/financeiro.relatorios.customizado.tsx
5   /home/kingdev/Documentos/igreja_conect/app/routes/app/financeiro.relatorios.dre.tsx
3   /home/kingdev/Documentos/igreja_conect/app/components/Sidebar.tsx
3   /home/kingdev/Documentos/igreja_conect/app/components/TopbarAutenticada.tsx
3   /home/kingdev/Documentos/igreja_conect/app/routes/app/financeiro.relatorios.balancete.tsx
3   /home/kingdev/Documentos/igreja_conect/app/routes/app/financeiro.transferencias.$id.tsx
3   /home/kingdev/Documentos/igreja_conect/app/routes/app/ministerios._index.tsx
2   /home/kingdev/Documentos/igreja_conect/app/components/CalendarioDisponibilidade.tsx
2   /home/kingdev/Documentos/igreja_conect/app/components/GerenciarFuncoes.tsx
2   /home/kingdev/Documentos/igreja_conect/app/routes/app/escalas.novo.tsx
1   /home/kingdev/Documentos/igreja_conect/app/components/CardAlerta.tsx
1   /home/kingdev/Documentos/igreja_conect/app/components/ComprovanteUpload.tsx
1   /home/kingdev/Documentos/igreja_conect/app/components/ConfigAcolhimentoCard.tsx
1   /home/kingdev/Documentos/igreja_conect/app/components/MobileNavigation.tsx
1   /home/kingdev/Documentos/igreja_conect/app/components/_old/CardAlerta.tsx
1   /home/kingdev/Documentos/igreja_conect/app/components/ds/Badge.tsx
1   /home/kingdev/Documentos/igreja_conect/app/components/ds/DateTile.tsx
1   /home/kingdev/Documentos/igreja_conect/app/components/ds/RadioCard.tsx
1   /home/kingdev/Documentos/igreja_conect/app/components/ds/Table.tsx
1   /home/kingdev/Documentos/igreja_conect/app/root.tsx
1   /home/kingdev/Documentos/igreja_conect/app/routes/app/membros.$id.tsx
1   /home/kingdev/Documentos/igreja_conect/app/routes/public/convite.$token.tsx
1   /home/kingdev/Documentos/igreja_conect/app/routes/public/recuperar-senha.tsx
```

Localizações representativas dos 6 warnings principais:

- `app/app.css:2274` — `side-tab`, `border-left: 3px solid var(--color-success)`; `app/app.css:2275` também tem `design-system-radius`.
- `app/components/CardAlerta.tsx:100` — `side-tab`, `border-l-4`.
- `app/components/_old/CardAlerta.tsx:88` — `side-tab`, `border-l-4` em componente legado.
- `app/routes/app/financeiro.relatorios.balancete.tsx:295` — `side-tab`, `border-l-4`.
- `app/root.tsx:24` — `overused-font`, Google Fonts `inter`.
- `app/routes/app/financeiro.relatorios.fluxo-caixa.tsx:220` — `border-accent-on-rounded`, `border-b-2`.

## JSON bruto preservado

O stdout bruto do detector foi capturado sem rerodar o detector pelo harness em:

```text
/home/kingdev/.kiro/sessions/d2c0e6c20eb53765/sess_90072235-f14d-470f-a320-4697b5923f8a/tool-outputs/execute_bash-e15bb81f.txt
```

O JSON bruto é o trecho entre o primeiro `[` e o último `]` desse arquivo. Fingerprint do trecho JSON, para a síntese verificar que a captura não foi reformatada:

```json
{
  "source_file": "/home/kingdev/.kiro/sessions/d2c0e6c20eb53765/sess_90072235-f14d-470f-a320-4697b5923f8a/tool-outputs/execute_bash-e15bb81f.txt",
  "extraction": "bytes between first '[' and last ']'",
  "json_bytes": 79513,
  "sha256": "a77cc463a3fb2596e637911815ff4901b4b438e5273c77c5eb429e15fd63f561",
  "findings": 137
}
```

A captura acima é a preservação verbatim do array JSON produzido pelo único comando; o arquivo contém também os marcadores do executor (`Output:` e `Exit Code: 2`) fora do array. Não foi feita normalização, filtragem ou segunda execução.

## 2. Evidência de browser

### Disponibilidade e método

- Não havia ferramenta nativa de browser/canvas exposta nesta sessão.
- Havia Google Chrome `149.0.7827.155` em `/usr/local/bin/google-chrome-stable` e Playwright `1.60.0`.
- Foi usado o fallback manual headless Playwright, com contexto novo e página nova por superfície.
- Já havia servidor do app escutando em `[::1]:5174` (também `[::1]:5173`); o servidor do app não foi iniciado nem parado por esta etapa. Foi usado `[::1]:5174`, HTTP 200 em `/login`.
- Foi iniciado somente o servidor de assets do detector com `.kiro/skills/impeccable/scripts/impeccable live-server --background`: PID `677131`, porta `8400`. Método de parada registrado: `kill 677131`; confirmação: `stopped: pid 677131`, `port_8400: closed` antes deste relatório.

### Superfícies tentadas

Em cada página, o preflight mutável definiu `document.title = "[Assessment B]"` e anexou um `<script src="http://localhost:8400/detect.js">`; `scriptAdded: true` foi confirmado em todas. O detector emitiu mensagens no console em todas as superfícies.

| Superfície | URL final | HTTP | Evidência DOM | Achados no console do detector |
|---|---|---:|---|---:|
| Shell autenticado + dashboard | `/app` | 200 | `h1: Olá, Administrador`; 1 form; 54 elementos interativos | **28** |
| Membros | `/app/membros` | 200 | `h1: Membros`; 2 forms; 82 elementos interativos | **23** |
| Células | `/app/celulas` | 200 | `h1: Células`; 1 form; 46 elementos interativos | **17** |
| Formulário novo membro | `/app/membros/novo` | 200 | `h1: Cadastrar novo membro`, `h2: Dados Pessoais`; 2 forms; 76 elementos interativos | **30** |

A autenticação foi concluída e redirecionou para `/app`. Os logs das superfícies reportaram principalmente `low-contrast`, `undersized-ui-text`, `icon-tile-stack`, `overused-font` e `skipped-heading`; no dashboard também apareceram `kicker-above-heading`. Não houve erro de navegação nas quatro páginas autenticadas.

### Achados do console do browser

- Durante o login/primeiro dashboard, houve request abortado para `https://api.ipify.org/?format=json` com `net::ERR_ABORTED`.
- Também houve request abortado de hot-update do servidor de desenvolvimento para `http://[::1]:5174/__manifest?...`, seguido da mensagem `Failed to fetch manifest patches TypeError: Failed to fetch`.
- O dashboard em `/app` emitiu `Hydration failed because the server rendered HTML didn't match the client`; o diff reportado pelo React apontou um `<title>` de gráfico que recebeu `mai` no cliente. O mesmo erro foi observado na página usada após o login.
- A injeção do detector não falhou; portanto não há fallback de injeção a registrar. O script foi carregado e produziu console messages em todas as superfícies.
- A execução foi headless e não houve captura de screenshot nem apresentação de aba `[Human]`; portanto **não alego inspeção visual manual nem overlay visível**. A evidência de browser deste assessment é de navegação, DOM, console e resultado do script injetado.

## 3. Falsos positivos aparentes / contexto para a síntese

Estes itens são apenas qualificações da evidência, não exclusões automáticas:

1. `overused-font` em `app/root.tsx:24` parece falso positivo de intenção: `Inter` está explicitamente documentada como tipografia do produto em `DESIGN.md` e nos AGENTS.
2. Parte dos 96 `design-system-font-size` e dos 19 `design-system-radius` pode ser uso contextual deliberado: a documentação do design system prevê cabeçalhos de tabela em 10px, labels compactos e variações de densidade; o detector compara contra um ramp limitado. Cada local ainda deve ser avaliado antes de corrigir.
3. Os 16 `design-system-color` incluem valores OKLCH de rampas/estados no `app.css`; podem ser tonal steps intencionais do tema claro/escuro, embora estejam fora dos valores nomeados que o detector conhece.
4. `side-tab` em `app/components/_old/CardAlerta.tsx` é componente legado, explicitamente marcado como `_old` nas regras do workspace; o achado não deve ser tratado como prioridade de código novo.
5. `kicker-above-heading` no dashboard corresponde à data acima do título e pode ser uma composição intencional; o console registra o padrão, não um defeito confirmado.

## 4. Passos pulados ou falhos, com motivo concreto

- **Canvas/browser nativo:** pulado porque nenhuma ferramenta nativa foi exposta nesta sessão; fallback manual Playwright foi executado.
- **Servidor do app:** não iniciado, porque servidores existentes em `[::1]:5173` e `[::1]:5174` responderam; não foram parados para não interromper processos preexistentes.
- **Screenshot/overlay:** não produzido; a execução headless não ofereceu uma aba humana/canvas. Não há alegação de inspeção visual ou overlay.
- **Scan estreito:** não necessário; havia 274 arquivos markup-like, abaixo de 500.
- **Build/test:** não executados; este assessment é de evidência de detector/browser somente e a instrução proibiu alterar código. `git diff --check` foi executado e saiu 0.

## 5. Integridade da working tree

`git diff --check` saiu sem saída e exit 0. Um `git status --short -- app .agents/tasks/assessment-b.md` ao final mostrou modificações já existentes em arquivos do app (`app/app.css`, `FormLogin.tsx`, `TabelaMembros.tsx`, `session.server.ts`, rotas de membros/login); nenhum desses arquivos foi escrito por esta etapa. O único arquivo criado/escrito por este assessment é:

```text
/home/kingdev/Documentos/igreja_conect/.agents/tasks/assessment-b.md
```
