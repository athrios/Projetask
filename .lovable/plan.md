
# Ambientes de Trabalho na Sidebar + Isolamento Ativo

Vou ajustar a sidebar atual **sem recriar** e ligar de fato o `workspace_id` ativo em todos os módulos. Mantém o visual leve, fundo claro, mesma tipografia e espaçamento.

## 1. Sidebar (src/pages/Index.tsx)

Inserir entre o bloco do e-mail e o campo de busca:

```
Ambiente atual
[● Athrios Contabilidade        ▾]
```

- Componente novo `WorkspaceSwitcher` em `src/components/workspace/WorkspaceSwitcher.tsx`.
- Usa `DropdownMenu` (shadcn). Trigger = pill com bolinha colorida (`templateColors` reaproveitado) + nome + chevron.
- Lista todos os workspaces do `useWorkspace()`. Item ativo recebe check + fundo `sidebar-accent`.
- Rodapé do dropdown:
  - `+ Novo ambiente` — só aparece para usuários que são **owner de pelo menos um workspace** (`isOwnerOfAny`) ou sempre (qualquer usuário autenticado pode criar o seu — alinhado à RLS `auth.uid()=owner_id`). Vou exibir sempre, pois qualquer usuário master do próprio ambiente deve poder criar mais.
  - `Gerenciar ambientes` (abre seção `settings` → aba Ambientes).
- Modal "Novo ambiente" (`CreateWorkspaceDialog`): nome, cor (paleta do `templateColors`), descrição opcional → INSERT em `workspaces`; trigger do banco já adiciona o owner como member. Pergunta "Entrar agora?" via toast action.

## 2. Filtro de menu por permissão

Em `Index.tsx`:

- Usar `useWorkspace()` → `canViewModule`, `isOwner`.
- Mapear seções para `ModuleKey`:
  `today→hoje, agenda→hoje, schedule→cronograma, tasks→tarefas, processes→processos, forms→formularios, requests→solicitacoes, done→tarefas`.
- `order` filtrado: oculta itens sem `canViewModule`.
- `settings` só aparece quando `isOwnerOfAny` (master). Conteúdo passa a renderizar `WorkspacesPanel`.
- Se `section` atual ficar indisponível ao trocar de workspace → redireciona para `today` (ou primeira permitida).

## 3. Isolamento por workspace ativo no frontend

Adicionar `.eq("workspace_id", workspaceId)` em todas as queries e `workspace_id: workspaceId` em todos os `insert`. Arquivos:

- `src/components/TasksPanel.tsx` — tasks + subtasks
- `src/components/SchedulePanel.tsx` — schedule_items
- `src/components/TodayPanel.tsx` — tasks, schedule_items, process_steps
- `src/components/agenda/AgendaPanel.tsx` — tasks, process_steps
- `src/components/processes/ProcessesPanel.tsx` — processes, process_steps, process_templates, process_template_steps
- `src/components/forms/FormsPanel.tsx` — forms, form_fields
- `src/components/requests/RequestsPanel.tsx` — form_responses (+ conversões: passar `workspace_id` ao criar tarefa/processo)
- `src/components/shared/GlobalSearch.tsx` — todas as buscas
- `src/lib/activityLog.ts` — `activity_logs` insert recebe `workspace_id`
- `src/pages/Index.tsx` — preload de tasks (linha 75)
- `src/pages/PublicForm.tsx` — INSERT em `form_responses` passa `workspace_id` derivado do form carregado (mantém policy pública intacta)

Padrão de hook nos panels:
```ts
const { workspaceId } = useWorkspace();
useEffect(() => { if (!workspaceId) return; load(); }, [workspaceId, ...]);
```

Reload automático ao trocar de ambiente: cada panel já depende de `workspaceId` no `useEffect`.

## 4. Tela "Gerenciar ambientes" (master)

Novo `src/components/workspace/WorkspacesPanel.tsx` renderizado quando `section==='settings'`:

- Lista de workspaces que o usuário é owner.
- Para cada um: editar nome/cor, arquivar (`archived_at`), excluir.
- Aba **Membros**: lista `workspace_members` + permissões por módulo (matriz 7×4 checkboxes) lendo/gravando `workspace_permissions`.
- Aba **Convites**: input de email + matriz de permissões → INSERT em `workspace_invitations` (token gerado client-side via `crypto.randomUUID`). MVP: copia link `/invite/:token`; envio real de email fica fora de escopo (será edge function depois).

Isto é uma versão enxuta — só CRUD básico de workspaces e gestão de membros existentes. Botão de "convidar membro" cria registro em `workspace_invitations`; aceitar convites pode ficar para próxima iteração caso queira simplificar.

## 5. Busca dentro do ambiente

`GlobalSearch` recebe `workspaceId` do contexto e adiciona `.eq("workspace_id", workspaceId)` em todas as queries (tasks, processes, forms, responses, schedule).

## 6. Critérios de aceite cobertos

- Visual da sidebar preservado (só inserção do switcher entre email e busca).
- Switcher com pill colorido + dropdown com check no ativo.
- "Novo ambiente" + "Gerenciar ambientes" dentro do dropdown.
- Configurações oculto para não-owners.
- Itens de menu ocultos quando `can_view=false`.
- Troca de ambiente recarrega dados (via dependência `workspaceId` nos effects).
- Busca limitada ao ambiente ativo.
- PublicForm continua funcionando (policy pública preservada).

## Fora de escopo nesta iteração

- Envio real de email de convite (precisa edge function `invite-member` + SMTP — posso adicionar depois).
- Fluxo de aceitar convite via link `/invite/:token`.
- Transferência de ownership.
- Auditoria de mudanças de permissão.

## Pergunta única

Confirma que posso usar essa versão enxuta de gestão de membros (convites criados como registro, sem envio de email ainda)? Se preferir, já incluo a edge function de envio nesta mesma iteração.
