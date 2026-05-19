# Camada de segurança completa

A maior parte do isolamento por `workspace_id` e RLS já está implementada nas rodadas anteriores. Este plano cobre apenas as **lacunas reais** ainda existentes, sem refazer o que já funciona.

---

## 1. Banco / RLS (uma migração única)

**1.1 Endurecer leitura pública de `form_fields`**
Hoje a policy `public published fields read` expõe **todas** as colunas (`workspace_id`, `user_id`) para qualquer um que abra um formulário publicado. Vou:
- Criar a view `public.form_fields_public` (`security_invoker=on`) expondo só `id, form_id, label, field_type, required, options, position`.
- Trocar a policy de SELECT pública para `USING (false)` *apenas para anon* mantendo SELECT autenticado restrito a membros do workspace. Frontend público passa a ler da view.

**1.2 Endurecer leitura pública de `forms`**
Mesma ideia: criar view `forms_public` expondo apenas `id, title, description, is_published, public_slug, user_id, workspace_id` (user_id e workspace_id são necessários para o INSERT de resposta validar). Limitar a policy pública a `is_published = true` continua, mas via a view.

**1.3 Policy faltando em `workspace_invitations`**
Adicionar policy de UPDATE (`accepted_at`) para o convidado pelo email do JWT (`auth.jwt() ->> 'email' = email`).

**1.4 Confirmar trigger `autofill_workspace_id`**
Garantir trigger BEFORE INSERT ativo em todas as tabelas com `workspace_id` (tasks, subtasks, schedule_items, processes, process_steps, process_templates, process_template_steps, forms, form_fields). Já existem as funções; vou só anexar onde faltar.

**1.5 `activity_logs`**
Já tem RLS por membership. Sem mudança.

**1.6 Soft delete em `workspaces`**
Já existe `archived_at`. Adicionar policy de UPDATE de `archived_at` restrita ao owner (já coberta pela policy genérica de owner). Sem nova migração.

---

## 2. Frontend — guards de rota e UI

**2.1 `<RequireModule module="...">`** — novo wrapper em `src/components/auth/RequireModule.tsx`.
Se `canViewModule(m) === false`, redireciona para `today` e mostra toast "Sem permissão". Aplicado em `Index.tsx` antes de renderizar cada Panel.

**2.2 Settings/Ambientes só para master**
`Index.tsx` já filtra via `isOwnerOfAny`. Adicionar dupla checagem dentro de `WorkspacesPanel` (redirect se não-owner).

**2.3 Esconder ações conforme permissão**
Revisar `TasksPanel`, `ProcessesPanel`, `FormsPanel`, `RequestsPanel`: botões de criar/editar/excluir só renderizam quando `can(module, 'create'|'edit'|'delete')`. RLS já é o backstop; isto é só UX.

---

## 3. PublicForm — endurecer

- Ler de `forms_public` e `form_fields_public` (sem expor colunas internas).
- Validar com zod no submit: `submitter_name` 1–120 chars, cada campo texto ≤ 5000 chars, multi_select array ≤ 50 itens.
- Sanitizar strings com trim e remover caracteres de controle.
- Texto de descrição e label já são renderizados como texto (React escapa). Manter.
- Nome do arquivo já é sanitizado; manter limite 20MB.
- Sem leitura de `localStorage` aqui (já está OK).

---

## 4. Validação centralizada (zod)

Novo `src/lib/validation.ts` com schemas reutilizáveis:
- `workspaceNameSchema` (1–80)
- `taskTitleSchema` (1–200), `notesSchema` (≤ 5000)
- `processNameSchema`, `stepTitleSchema`
- `formTitleSchema`, `fieldLabelSchema`, `optionSchema`
- `memberEmailSchema`

Aplicar nos diálogos de criação/edição (CreateWorkspaceDialog, TasksPanel inputs, ProcessesPanel, FormsPanel, WorkspacesPanel invites). Erros via `toast.error`.

---

## 5. XSS / renderização

Auditoria do código: o único `dangerouslySetInnerHTML` está em `ui/chart.tsx` (CSS interno, sem input de usuário). Nenhuma ação. Confirmar que `notes`, `description`, `submitter_name` são sempre renderizados como `{value}` ou via `whitespace-pre-wrap` (texto, não HTML). Já está.

---

## 6. Busca global

`GlobalSearch` já filtra por `workspace_id`. Adicionar filtro extra por permissão: se `!canViewModule('processos')`, pular query de `processes`; idem para `solicitacoes` e `formularios`. Pequeno ajuste em `GlobalSearch.tsx` (receber `can` do hook).

---

## 7. Logs de auditoria

`activityLog.ts` já registra eventos. Adicionar chamadas em pontos faltantes:
- `WorkspacesPanel`: criar/arquivar workspace, adicionar/remover membro, alterar permissões.
- `FormsPanel`: publicar/despublicar.
- `RequestsPanel`: conversão de resposta em tarefa/processo (verificar — pode já existir).
- `ProcessesPanel`: mudança de status do processo.

---

## 8. Exclusões com confirmação

Garantir `AlertDialog` antes de excluir em: workspace, formulário, processo, modelo, tarefa com subtarefas, resposta. Maioria já tem; cobrir os que faltarem após varredura rápida nos painéis.

---

## 9. LocalStorage

Auditado:
- `activeWorkspaceId` — preferência, OK.
- `tasksHiddenStatuses`, `tasksView` — UI, OK.
- Sessão Supabase — normal.
Nenhum dado sensível. Sem ação.

---

## Arquivos a criar/editar

**Criar**
- `supabase/migrations/<ts>_security_hardening.sql`
- `src/components/auth/RequireModule.tsx`
- `src/lib/validation.ts`

**Editar**
- `src/pages/Index.tsx` (aplicar `RequireModule`)
- `src/pages/PublicForm.tsx` (usar views, zod)
- `src/components/shared/GlobalSearch.tsx` (filtro por permissão)
- `src/components/workspace/CreateWorkspaceDialog.tsx`, `WorkspacesPanel.tsx`
- `src/components/TasksPanel.tsx`, `processes/ProcessesPanel.tsx`, `forms/FormsPanel.tsx`, `requests/RequestsPanel.tsx` (zod + audit logs + guards de botão)
- `src/lib/activityLog.ts` (helpers extras se faltarem)

---

## Detalhes técnicos da migração

```sql
-- 1. Views públicas
CREATE OR REPLACE VIEW public.forms_public WITH (security_invoker=on) AS
  SELECT id, user_id, workspace_id, title, description, is_published, public_slug
  FROM public.forms WHERE is_published = true;

CREATE OR REPLACE VIEW public.form_fields_public WITH (security_invoker=on) AS
  SELECT ff.id, ff.form_id, ff.label, ff.field_type, ff.required, ff.options, ff.position
  FROM public.form_fields ff
  JOIN public.forms f ON f.id = ff.form_id AND f.is_published = true;

GRANT SELECT ON public.forms_public, public.form_fields_public TO anon, authenticated;

-- 2. Restringir SELECT direto público a usuários autenticados membros
DROP POLICY "public published forms read" ON public.forms;
DROP POLICY "public published fields read" ON public.form_fields;
-- (views acima cobrem o caso público; tabelas-base ficam só com policies de workspace)

-- 3. Convite — aceitar
CREATE POLICY "invitee accepts" ON public.workspace_invitations
FOR UPDATE TO authenticated
USING (lower(email) = lower(auth.jwt() ->> 'email'))
WITH CHECK (lower(email) = lower(auth.jwt() ->> 'email'));
```

---

## Critério de aceite (validação após aplicação)

Rodar `supabase--linter`, criar 2 workspaces de teste com usuários distintos via console, e verificar manualmente os 13 cenários listados pelo usuário.
