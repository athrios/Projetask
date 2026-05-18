# Plano — Ambientes de Trabalho (Workspaces) com Membros e Permissões

## Visão geral

Introduzir o conceito de **Workspace (Ambiente de Trabalho)** como unidade de isolamento de dados. Todos os módulos existentes (Tarefas, Cronograma, Processos, Modelos, Formulários, Respostas, Concluídas, Hoje, Agenda) passam a operar dentro de um workspace ativo. O usuário **master** (dono da conta) cria workspaces, convida membros e define permissões por módulo. **Configurações** continua exclusiva do master.

Implementação incremental, sem refatoração total e sem quebrar o fluxo público `/f/:slug`.

---

## 1. Modelo de dados (migração SQL)

### Novas tabelas

**`workspaces`**
- `id`, `owner_id` (auth.users), `name`, `color` (default `gray`), `archived_at`, `created_at`, `updated_at`

**`workspace_members`**
- `id`, `workspace_id`, `user_id`, `role` (`owner` | `member`), `created_at`
- unique (`workspace_id`, `user_id`)
- O owner é inserido automaticamente como membro com role `owner` via trigger `AFTER INSERT ON workspaces`.

**`workspace_permissions`**
- `id`, `workspace_id`, `user_id`, `module` (`hoje`|`cronograma`|`tarefas`|`processos`|`formularios`|`solicitacoes`|`concluidas`)
- `can_view`, `can_create`, `can_edit`, `can_delete` (boolean, default false)
- unique (`workspace_id`, `user_id`, `module`)
- Owner ignora esta tabela (sempre tem tudo).

### Funções SECURITY DEFINER (evitar recursão em RLS)

- `is_workspace_member(_ws uuid, _uid uuid) returns boolean`
- `is_workspace_owner(_ws uuid, _uid uuid) returns boolean`
- `has_workspace_permission(_ws uuid, _uid uuid, _module text, _action text) returns boolean` — owner sempre true; senão lê `workspace_permissions`.

### Alterações nas tabelas existentes

Adicionar `workspace_id uuid` (NOT NULL após backfill) nas tabelas:
- `tasks`, `subtasks`, `schedule_items`
- `processes`, `process_steps`, `process_templates`, `process_template_steps`
- `forms`, `form_fields`, `form_responses`
- `activity_logs`

Índices em `(workspace_id)` em todas elas.

### Backfill (ambiente padrão)

Para cada `user_id` distinto presente em qualquer tabela acima:
1. Criar 1 workspace `"Meu ambiente"` com `owner_id = user_id`.
2. UPDATE em cada tabela definindo `workspace_id = <workspace do owner>` onde `user_id = owner`.
3. Tornar `workspace_id` NOT NULL.

Nenhum dado é apagado.

### RLS — substituir policies "own X" por workspace-aware

Padrão para cada tabela de dados (ex.: `tasks`):
- SELECT: `is_workspace_member(workspace_id, auth.uid()) AND has_workspace_permission(workspace_id, auth.uid(), '<modulo>', 'view')`
- INSERT: `... 'create'` + `user_id = auth.uid()`
- UPDATE: `... 'edit'`
- DELETE: `... 'delete'`

Casos especiais:
- `forms` / `form_fields` mantêm policy adicional `public published … read` (slug público continua funcionando).
- `form_responses` INSERT público: passa a validar `forms.workspace_id` em vez de owner — mantém `owner_id = forms.user_id` para compatibilidade, mas adiciona `workspace_id` derivado.

### Configurações

Não é uma tabela; é só uma rota. Garantido no frontend: só master (owner de pelo menos um workspace, ou role-based) acessa.

---

## 2. Frontend

### Contexto global `WorkspaceProvider`

Novo hook `useWorkspace()` em `src/hooks/useWorkspace.tsx`:
- Carrega workspaces do usuário (via `workspace_members`).
- Mantém `activeWorkspaceId` em `localStorage`.
- Expõe `permissions` (mapa módulo→ações) do workspace ativo.
- Expõe `isOwner`, `canView(module)`, `canCreate(module)`, etc.

Montado em `App.tsx` dentro de `AuthProvider`.

### Seletor de ambiente (sidebar)

Novo componente `WorkspaceSwitcher` no topo da sidebar em `Index.tsx`:
- Dropdown com workspaces; pill colorida usando `templateColors`.
- Botão "Novo ambiente" se `isOwner` em qualquer workspace (ou sempre — qualquer um pode criar o seu).
- Item "Gerenciar ambientes" → abre nova seção/dialog.

### Filtros nos panels

Cada panel existente passa a:
- Receber `workspaceId` via contexto (não por prop).
- Adicionar `.eq("workspace_id", workspaceId)` em todos os `select`.
- Adicionar `workspace_id: workspaceId` em todos os `insert`.

Panels afetados: `TasksPanel`, `SchedulePanel`, `TodayPanel`, `AgendaPanel`, `ProcessesPanel`, `FormsPanel`, `RequestsPanel`, `GlobalSearch`.

### Sidebar dinâmica

`Index.tsx` filtra `order` por `canView(module)`. Item **Configurações** só aparece se `isOwner`.

### Nova seção "Ambientes" (visível só ao owner)

Tela `WorkspacesPanel`:
- Lista de workspaces que o usuário possui.
- CRUD de workspace (nome, cor).
- Para cada workspace: lista de membros + matriz de permissões (módulo × ação) com checkboxes.
- Adicionar membro: input de e-mail. Fluxo abaixo.

### Adicionar membro (sem senha em texto puro)

Opções (decidir conforme suporte do Cloud):
- **Preferida:** edge function `invite-member` que usa `service_role` → `supabase.auth.admin.inviteUserByEmail()`. Quando o convidado define a senha, é adicionado a `workspace_members` via tabela `workspace_invitations` (pending) consumida no primeiro login.
- Alternativa simples: master informa e-mail já cadastrado → busca em `auth.users` via edge function e insere em `workspace_members`.

Tabela auxiliar `workspace_invitations` (email, workspace_id, permissions jsonb, token, expires_at) resolve o caso "usuário ainda não tem conta".

### Formulário público

`PublicForm.tsx` continua lendo `forms` por `public_slug` (policy pública). Ao inserir `form_responses`, passa `workspace_id` derivado do form. Sem login do respondente — inalterado.

---

## 3. Ordem de execução

1. **Migração 1 — schema:** criar `workspaces`, `workspace_members`, `workspace_permissions`, `workspace_invitations`, funções `is_workspace_*` / `has_workspace_permission`, trigger de auto-add owner.
2. **Migração 2 — backfill:** adicionar `workspace_id` nas 11 tabelas (nullable), criar "Meu ambiente" por usuário, preencher, tornar NOT NULL, indexar.
3. **Migração 3 — RLS:** dropar policies "own X" e recriar workspace-aware; manter policies públicas de forms.
4. **Edge function** `invite-member` (deploy automático).
5. **Frontend:** `WorkspaceProvider`, `WorkspaceSwitcher`, filtros em todos os panels, sidebar dinâmica, `WorkspacesPanel`, guard de Configurações.
6. **Verificação:** rodar critérios de aceite (criar 2 workspaces, isolar tarefas, adicionar membro com permissão restrita).

---

## 4. Detalhes técnicos importantes

- **Sem recursão em RLS:** todas as checagens cross-table passam por funções `SECURITY DEFINER` com `search_path=public`.
- **Permissões padrão ao adicionar membro:** todos os módulos com `can_view=true`, demais `false`. Master ajusta na UI.
- **Owner** sempre tem todas as ações em todos os módulos (curto-circuito em `has_workspace_permission`).
- **Configurações:** rota frontend; ocultar no sidebar quando `!isOwner` e bloquear na rota.
- **GlobalSearch (`⌘K`):** filtrar todas as queries por `workspace_id` ativo.
- **Activity logs:** ganham `workspace_id` para auditoria por ambiente.
- **Migração de dados:** idempotente — usa `ON CONFLICT DO NOTHING` no insert de workspaces padrão se já existir um chamado "Meu ambiente" para o owner.
- **Senhas:** nunca armazenadas em tabelas — só Supabase Auth (`auth.users`).

---

## 5. Riscos / pontos de atenção

- `forms.user_id` é o owner do form e dirige a policy pública de upload. Mantemos `user_id` e adicionamos `workspace_id`; policies públicas continuam baseadas em `is_published` + `user_id` para não quebrar `/f/:slug`.
- Tipos do Supabase (`types.ts`) serão regenerados após migrações; código que faz `.from('tasks').insert({...})` precisa incluir `workspace_id` para compilar.
- A primeira renderização precisa esperar workspaces carregarem antes de chamar panels (loading state no `Index`).

---

## 6. Fora de escopo (não será feito agora)

- Notificações por e-mail customizadas além do convite padrão do Supabase Auth.
- Transferência de propriedade de workspace.
- Histórico de auditoria de permissões alteradas.
- Limites de membros / billing por workspace.
