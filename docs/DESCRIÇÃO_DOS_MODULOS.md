# Descrição Arquitetural dos Módulos do Sistema

Este documento detalha os objetivos, as funcionalidades e a matriz de acessos (RBAC) dos três módulos fundamentais do sistema.

---

## 📋 Matriz de Controle de Acesso Baseado em Papéis (RBAC)

O sistema conta com 6 perfis administrativos bem delimitados. A tabela abaixo resume o nível de acesso a cada componente:

| Perfil | Cadastro de Membros | Histórico de Dízimos | Módulo Financeiro | Estoque (Consumo e Ativos) | Manutenção de Ativos |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | CRUD Total | Visualização Completa | CRUD Total | CRUD Total (Autoriza Retirada) | CRUD + Baixa por Perda |
| **PASTOR** | CRUD Total | Visualização Completa | CRUD Total | Apenas Visualização | Visualiza Alertas |
| **FINANCEIRO**| CRUD Total | Visualização Completa | CRUD Total (Bloqueia p/ Saldo)| Apenas Visualização | Visualiza Alertas |
| **SECRETÁRIO(A)**| CRUD Total| **BLOQUEADO** | CRUD Total (Bloqueia p/ Saldo)| CRUD Total (Autoriza Retirada) | CRUD + Registro de Envio |
| **DISCIPULADOR**| CRUD Total | **BLOQUEADO** | **BLOQUEADO** | Apenas Visualização | Visualiza Alertas |
| **LÍDER MIN.** | CRUD Total | **BLOQUEADO** | **BLOQUEADO** | Apenas Visualização | Visualiza Alertas |

---

## 1. Módulo de Membros

### 1.1 Objetivo Geral

Centralizar o controle de todas as pessoas que se relacionam com a instituição local, fornecendo aos líderes ferramentas para o acompanhamento pastoral e a gestão de equipes, respeitando a privacidade financeira.

### 1.2 Funcionalidades Principais

* **Ficha Cadastral Unificada:** Registro de dados pessoais (nome, data de nascimento, telefone, e-mail, estado civil, profissão e endereço) e dados eclesiásticos (data de conversão, batismo e tipo de membro).
* **Segmentação por Tipo:** Classificação clara entre *Membro Ativo*, *Congregado* e *Visitante*.
* **Gerenciador de Vínculo de Discipulado:** Interface para conectar membros a seus respectivos discipuladores, contendo validações rígidas de limite de lotação (máximo de 12 discípulos por líder).
* **Aba de Fidelidade Financeira:** Componente restrito acoplado ao perfil do membro que lista as contribuições históricas de dízimos de forma decrescente (exclusivo para Admin, Pastor e Financeiro).
* **Configuração de Destino de Visitantes:** Painel administrativo para apontar qual usuário ou ministério receberá o alerta imediato de acompanhamento assim que um novo visitante preencher o formulário de primeira visita.

---

## 2. Módulo Financeiro

### 2.1 Objetivo Geral

Prover uma gestão financeira transparente e simplificada baseada no fluxo de caixa real, garantindo a saúde financeira da instituição através de travas automatizadas de saldo.

### 2.2 Funcionalidades Principais

* **Gestão Multicaixas:** Interface para abertura, fechamento e controle de saldos de caixas independentes (Geral, Cantina, Jovens, Missões).
* **Mecanismo de Transferência:** Registro formal de movimentações de saldo entre caixas, carimbando o operador, data e hora.
* **Lançamento de Entradas:**
  * **Dízimos:** Entradas obrigatoriamente vinculadas a um membro cadastrado.
  * **Ofertas / Campanhas:** Entradas parametrizadas com suporte a anonimato (sem rastreamento de doador).
* **Lançamento de Saídas e Compras:** Registro de contas a pagar, despesas operacionais ordinárias e pagamentos.
* **Motor de Validação de Saldo:** Camada lógica que intercepta a aprovação de qualquer despesa e compara o valor nominal com o saldo líquido do caixa selecionado. Em caso de inconsistência, o sistema impede a gravação da aprovação e alerta o usuário.
* **Análise de Fluxo de Caixa:** Painel macro exibindo gráficos de entradas contra saídas e consolidação de saldos disponíveis por períodos.

---

## 3. Módulo de Estoque e Manutenção

### 3.1 Objetivo Geral

Controlar o ciclo de vida dos insumos de consumo diário da igreja e salvaguardar a integridade dos bens patrimoniais permanentes através de fluxos de manutenção rastreáveis.

### 3.2 Funcionalidades Principais

* **Catálogo de Insumos (Consumo):** Registro e controle de volumetria de materiais descartáveis.
  * **Retirada Controlada:** Tela para registro de consumo interno, limitando a operação de baixa ao Admin e Secretário(a), exigindo a identificação textual de quem retirou o produto (ex: "Zezinho do Ministério de Louvor levou 2 caixas de copos").
* **Inventário Patrimonial (Ativos):** Cadastro completo dos ativos permanentes da igreja, registrando número de série, localização física atual e estado de conservação.
* **Controle de Manutenção de Ativos:** Tela para envio de equipamentos defeituosos para assistência técnica externa. Armazena a O.S., endereço e prazos.
* **Motor de Agendamento de Alertas (Cron):** Monitor de manutenções em aberto que varre a tabela de ativos em reparo e injeta na central de alertas avisos periódicos de acompanhamento (de 6 em 6 dias, intensificando para de 3 em 3 dias caso o item passe de um mês sem retorno).
* **Módulo de Descarte e Sinistro:** Permite dar baixa por destruição ou obsolescência técnica de um bem patrimonial, vinculando de forma obrigatória o upload do laudo de condenação do equipamento para prestação de contas interna.
  