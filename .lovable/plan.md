# Plano: Indicador de mês, navegação por dia e alertas de tarefas

Escopo dividido em 3 frentes independentes que serão entregues juntas.

## 1) Indicador de mês (visual)

- Adicionar header com o mês de referência (ex.: "Maio de 2026") nas áreas:
  - `AgendaPanel` (já tem navegação, falta o rótulo formal do mês).
  - `TasksPanel` quando a visualização é agrupada por data.
- Atualiza automaticamente conforme a âncora de navegação ou a primeira data visível das tarefas.
- Estilo discreto, consistente com a toolbar atual (mesma tipografia/cor `text-muted-foreground`).

## 2) Cabeçalho de dia clicável em Tarefas

- Em `TasksPanel`, transformar o cabeçalho do agrupamento (`06 de maio de 2026`) em botão.
- Ao clicar, aplica filtro de data única (`dateFilter = iso`).
- Quando filtrado, mostrar barra "Filtrando: 06 de maio de 2026" com botão "Limpar filtro".
- Edição de tarefa continua via clique no item (não no cabeçalho).
- Filtro vive apenas no estado local da página (não persiste).

## 3) Alertas de tarefa

### Banco (migração)

Novas tabelas com RLS por `workspace_id`:

- `task_reminders`
  - `task_id`, `user_id`, `workspace_id`
  - `offset_value int`, `offset_unit text` (`minutes|hours|days`)
  - `reminder_at timestamptz` (calculado a partir do `due_date` + hora opcional)
  - `notify_in_app bool`, `notify_email bool`
  - `status text` (`pending|sent|cancelled`), `email_sent_at`, `in_app_created_at`
- `notifications`
  - `user_id`, `workspace_id`, `task_id`
  - `title`, `message`, `read_at`

Trigger de validação para `offset_unit` e `status`. Política RLS:
- Reminders: visíveis/editáveis por membros do workspace com permissão `tarefas`.
- Notifications: visíveis somente para `user_id = auth.uid()`; service role insere.

Adicionar coluna `due_time time` em `tasks` (opcional, default null) — para alertas mais precisos. Se ausente, considerar 09:00.

### UI na criação/edição de tarefa

Nova seção "Alertas" no editor de tarefa:
- Toggle "Ativar alerta".
- Preset: Na hora / 5min / 15min / 30min / 1h / 1 dia / Personalizado.
- Personalizado: input numérico + unidade (min/h/dias).
- Canal: In-app / E-mail / Ambos.
- Múltiplos alertas por tarefa (lista + botão "Adicionar alerta").

Ao salvar a tarefa, recalcular `reminder_at = (due_date + due_time) - offset` e fazer upsert. Se a tarefa muda de prazo, recálculo. Se concluída/cancelada/excluída → marcar reminders como `cancelled`.

### Sino de notificações (in-app)

- Componente `NotificationsBell` na topbar do app (`Index.tsx`).
- Conta não lidas (`read_at IS NULL`) do workspace ativo + user atual.
- Popover com lista das últimas 20.
- Realtime via Supabase channel em `notifications`.
- Clique marca como lida e navega para a tarefa (`/?tab=tasks&task=<id>`).

### Disparo (backend)

- Nova edge function `process-task-reminders` agendada via pg_cron a cada minuto.
- Lógica:
  1. `SELECT * FROM task_reminders WHERE status='pending' AND reminder_at <= now()`.
  2. Para cada: pular se task concluída/cancelada/deletada.
  3. Se `notify_in_app` → insert em `notifications`.
  4. Se `notify_email` → enfileirar via `enqueue_email('transactional_emails', ...)` usando infra de e-mail já existente, template inline simples.
  5. Atualizar `status='sent'`, `email_sent_at`, `in_app_created_at`.
- Idempotência: status garante não duplicar.

### Permissões

- RLS já cobre por workspace. Edge function usa service_role.
- Notificações filtram por `user_id = auth.uid()` no client.

## Arquivos

**Migração:** uma migração com tabelas + RLS + triggers + coluna `due_time` + cron job.

**Edge function:** `supabase/functions/process-task-reminders/index.ts` + entrada no `supabase/config.toml`.

**Frontend:**
- `src/components/agenda/AgendaPanel.tsx` — indicador de mês.
- `src/components/TasksPanel.tsx` — indicador de mês, cabeçalho clicável, filtro por dia, seção de alertas no editor, integração reminders.
- `src/components/notifications/NotificationsBell.tsx` (novo).
- `src/components/notifications/TaskReminderEditor.tsx` (novo) — usado dentro de TasksPanel.
- `src/pages/Index.tsx` — montar o sino na topbar.
- `src/lib/reminders.ts` (novo) — helpers de cálculo `reminder_at`.

## Critérios de aceite

Conforme os 5 testes descritos no pedido.

## Notas

- A infra de e-mail (`process-email-queue`, `email_send_log`) já está deployada — o reminder apenas enfileira.
- O domínio `task.athrioscontabil.com.br` está em verificação; e-mails só sairão após DNS ok, mas o fluxo fica completo.
- Não altero o template Tabela nem outras áreas.
