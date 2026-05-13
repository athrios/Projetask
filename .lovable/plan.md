## Fase 2 — Plano de implementação

Vou implementar em ordem para evitar quebras. Cada bloco é autocontido e revisável.

### 1. Migrations (uma única migration consolidada)

**tasks** — adicionar colunas:
- `is_recurring boolean default false`
- `recurrence_type text` (validado: `daily|weekly|monthly`)
- `recurrence_interval integer default 1`
- `recurrence_end_date date`
- `parent_recurring_task_id uuid`
- `source_type text default 'manual'` (`manual|request|process`)
- `source_id uuid` (referência opcional ao processo/solicitação de origem)

**process_template_steps** — adicionar:
- `due_offset_days integer default 0`

**process_steps** — adicionar:
- `due_date date`

**activity_logs** (nova) — `id, user_id, entity_type, entity_id, action, description, metadata jsonb, created_at` + RLS `auth.uid() = user_id` (select/insert próprios; update/delete bloqueados).

Triggers:
- Atualizar `validate_task_priority` para aceitar novos campos sem quebrar (apenas validar `recurrence_type` quando não-nulo).
- Index em `activity_logs (user_id, created_at desc)` e `(entity_type, entity_id)`.

### 2. Recorrência de tarefas

- No `TasksPanel`, ao criar/editar uma tarefa, expandir o form com seção **"Repetir"** (toggle + tipo + intervalo + data fim).
- Ao marcar como `feita` uma tarefa com `is_recurring=true`, gerar a **próxima ocorrência** client-side: copiar tarefa, calcular nova `due_date`/`task_date` com base em `recurrence_type` + `recurrence_interval`, manter `parent_recurring_task_id` apontando para a primeira da série, e respeitar `recurrence_end_date`.
- A tarefa concluída permanece no histórico.

### 3. Prazos automáticos em processos

- `TemplateManager` (dentro de `ProcessesPanel`): adicionar input `due_offset_days` em cada step do template.
- Ao instanciar processo a partir do template, calcular `process_steps.due_date = process.due_date_or_created + offset` (usar `due_date` quando presente, senão `created_at::date`).
- No drawer/detail do processo: mostrar badge "vencida" / "vence em X dias" para cada step com data próxima.

### 4. Visões de Agenda

- Nova seção **"Agenda"** no sidebar (entre Hoje e Cronograma).
- Componente `AgendaPanel` com tabs **Hoje / Semana / Mês**.
- Cada visão lista tarefas (por `due_date` ou `task_date`) e processos (por `due_date`) do período.
- Seção sempre visível: **"Sem prazo"** (tarefas/processos sem due_date).
- Tarefas atrasadas em destaque (vermelho).
- Vista Mês = grid calendário com contadores por dia (clicar abre o dia).

### 5. Filtros avançados

- Componente reutilizável `AdvancedFilters` (popover com chips ativos).
- Critérios: status (multi), prioridade (multi), intervalo de due_date (preset + custom), origem (`manual|request|process`).
- Aplicar em `TasksPanel` (todas as views) e `ProcessesPanel` (status/data).

### 6. Busca global

- Componente `GlobalSearch` (Command palette via `cmdk` já presente em shadcn) acessível por botão na sidebar **e** atalho `Cmd/Ctrl+K`.
- Queries paralelas a `tasks`, `processes`, `form_responses`, `forms` filtrando por `ilike` em título/nome (limite 8 por tipo).
- Cada resultado mostra tipo, título, status pill e ao clicar muda para a seção correspondente.

### 7. Histórico de atividade

- Helper `logActivity(entityType, entityId, action, description, metadata?)` em `src/lib/activityLog.ts`.
- Disparar nos pontos pedidos: criar/concluir/mudar status de tarefa; criar/excluir processo; converter solicitação; publicar/despublicar formulário.
- Componente `ActivityLogList` exibido no drawer de tarefa (em `TasksPanel`) e processo (em `ProcessesPanel`).

### 8. Subtarefas — melhorias

- Botões ▲/▼ para reordenar (atualizar `position`).
- Calcular `progress = doneSubtasks / totalSubtasks`.
- Exibir `<Progress>` (já existe em `ui/progress.tsx`) nos cards de tarefa quando houver subtarefas.

### 9. Padronização

- Todos os toasts via `sonner` com mensagens consistentes (`toast.success` / `toast.error`).
- Reuso de `StatusPill`, `PriorityPill`, `EmptyState`, `ViewSwitcher`, `SectionHeader`.
- Preservar visual atual (sem mudanças de tema/tokens).

### Arquivos a criar/editar

**Criar:**
- `supabase/migrations/<ts>_phase2.sql`
- `src/components/agenda/AgendaPanel.tsx`
- `src/components/shared/AdvancedFilters.tsx`
- `src/components/shared/GlobalSearch.tsx`
- `src/components/shared/ActivityLogList.tsx`
- `src/lib/activityLog.ts`
- `src/lib/recurrence.ts`

**Editar:**
- `src/pages/Index.tsx` (sidebar + Agenda + GlobalSearch trigger)
- `src/components/TasksPanel.tsx` (recorrência, filtros, log, progresso de subtarefas, reorder)
- `src/components/processes/ProcessesPanel.tsx` (offsets de template, due_date em steps, filtros, log)
- `src/components/requests/RequestsPanel.tsx` (log de conversão + source_type/source_id)
- `src/components/forms/FormsPanel.tsx` (log publicação)
- `src/components/TodayPanel.tsx` (continuar consistente; pequeno ajuste no contador "Atrasadas" para usar nova lógica)
- `src/lib/taskTokens.ts` (tipos `RecurrenceType`, `SourceType`, `ActivityAction`)

### Fora do escopo (Fase 3)
- Notificações, anexos, comentários, drag-and-drop real, dashboards.

### Confirmação
Vou prosseguir já com a migration (consolidada) e em seguida os componentes. A migration **não remove** dados; só adiciona colunas/tabela.