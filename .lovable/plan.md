## Visão geral

Evolução incremental do app atual (Hoje, Cronograma, Tarefas) adicionando 3 novos módulos: **Processos**, **Formulários** e **Solicitações**, mais refinos visuais inspirados no Notion. Vou preservar toda a estrutura atual (TasksPanel, SchedulePanel, TodayPanel, sincronia 2-vias, TaskDatePicker) e construir por cima.

Como o escopo é grande, divido em **3 fases**. Esta proposta cobre a **Fase 1** completa (estrutura + módulos novos com dados reais no backend). Fases 2 e 3 ficam como roadmap.

---

## Fase 1 — Estrutura, base visual e novos módulos (esta entrega)

### 1. Componentes reutilizáveis (novos)
- `src/components/shared/StatusPill.tsx` — pill genérica que aceita `domain: "task" | "schedule" | "process" | "request"` e o status. Centraliza cores via tokens.
- `src/components/shared/PriorityPill.tsx` — usa as 4 prioridades (baixa/media/alta/**urgente** — nova).
- `src/components/shared/ViewSwitcher.tsx` — alternador lista / tabela / card / kanban (props: views disponíveis + valor + onChange).
- `src/components/shared/EmptyState.tsx` — estado vazio padrão (ícone + título + ação).
- `src/components/shared/SectionHeader.tsx` — header consistente (título, subtítulo, ações à direita).

### 2. Design system (refino)
- Adicionar token de status `aguardando`, `cancelado` (tarefas) e os de processo/solicitação em `index.css` e `taskTokens.ts`.
- Adicionar prioridade `urgente`.
- Bordas mais suaves (`rounded-lg` → `rounded-xl` em cards principais), espaçamento mais generoso, hover discreto, ícones aparecendo no hover via `group-hover`.

### 3. Navegação
Atualizar sidebar em `src/pages/Index.tsx` com itens: **Hoje, Cronograma, Tarefas, Processos, Formulários, Solicitações, Configurações**. Cada item carrega seu painel na mesma página (mesmo padrão atual).

### 4. Tela "Hoje" (melhorias)
Estender `TodayPanel.tsx`:
- Cards de stats já existentes + 2 novos: **Tarefas atrasadas** (due_date < hoje, status ≠ feita) e **Processos em andamento**.
- Seção "Próximos no cronograma" (próximos 3 blocos do dia).
- Seção "Resumo de pendências" (lista compacta de atrasos).

### 5. Tela "Tarefas" (refino visual + status novos)
- Adicionar status `aguardando` e `cancelado` ao `taskTokens.ts` + migration validando.
- Adicionar prioridade `urgente`.
- Adicionar campo `due_date` editável inline (já existe na tabela).
- Mantém kanban atual; adiciona coluna "Aguardando".
- Refino visual: cards com `rounded-xl`, ícones de ação só no hover, edição inline mais clara.

### 6. Tela "Cronograma" (refino visual)
- Blocos com visual de "agenda" (não planilha): horário grande à esquerda, conteúdo à direita, status pill discreta.
- Mantém vínculo com tarefa (já existe).

### 7. Novo módulo: **Processos**
Backend (migration):
- `process_templates` (id, user_id, name, description, created_at)
- `process_template_steps` (id, template_id, position, title)
- `processes` (id, user_id, template_id, name, client_name, status, due_date, created_at)
- `process_steps` (id, process_id, position, title, status, notes, completed_at)
- RLS por `user_id` em todas; trigger valida status.

Frontend:
- `src/components/processes/ProcessesPanel.tsx` — lista de processos + botão "Novo processo" (escolhe template).
- `src/components/processes/ProcessCard.tsx` — nome, cliente, etapa atual, progresso (X/Y etapas), pill de status, prazo.
- `src/components/processes/ProcessDetail.tsx` — drawer/dialog com lista de etapas (checkbox + status por etapa).
- `src/components/processes/TemplateManager.tsx` — CRUD simples de modelos e suas etapas.

### 8. Novo módulo: **Formulários**
Backend (migration):
- `forms` (id, user_id, title, description, public_slug, created_at, is_published)
- `form_fields` (id, form_id, position, label, type, required, options jsonb)
- Tipos suportados: `short_text, long_text, select, multi_select, date`. (Anexo fica para fase futura.)
- RLS: dono CRUDa; público lê via `public_slug` se `is_published`.

Frontend:
- `src/components/forms/FormsPanel.tsx` — lista de formulários (cards) + criar.
- `src/components/forms/FormBuilder.tsx` — adicionar/reordenar/remover campos inline.
- `src/components/forms/FormCard.tsx` — título, nº de campos, nº de respostas, botão "copiar link público".
- `src/pages/PublicForm.tsx` — rota `/f/:slug` para o formulário público (sem auth).

### 9. Novo módulo: **Solicitações** (respostas dos formulários)
Backend (migration):
- `form_responses` (id, form_id, submitter_name, status, data jsonb, created_at, converted_task_id, converted_process_id)
- RLS: dono do form vê/edita; insert público permitido em forms publicados.

Frontend:
- `src/components/requests/RequestsPanel.tsx` — usa `ViewSwitcher` (tabela / cards / kanban / lista).
- `src/components/requests/RequestCard.tsx` — formulário origem, nome, data, pill de status.
- `src/components/requests/RequestDetail.tsx` — dados completos + ações **Converter em tarefa** / **Converter em processo**.

### 10. Status novos (resumo)
- **Tarefas:** pendente, fazendo, **aguardando**, feita, **cancelado**
- **Processos:** nao_iniciado, em_andamento, aguardando_cliente, aguardando_orgao, em_exigencia, concluido, cancelado
- **Solicitações:** recebida, em_analise, convertida_tarefa, convertida_processo, concluida, arquivada

---

## Detalhes técnicos

```text
src/
  components/
    shared/        StatusPill, PriorityPill, ViewSwitcher, EmptyState, SectionHeader
    processes/     ProcessesPanel, ProcessCard, ProcessDetail, TemplateManager
    forms/         FormsPanel, FormBuilder, FormCard
    requests/      RequestsPanel, RequestCard, RequestDetail
  pages/
    PublicForm.tsx (rota /f/:slug)
  lib/
    taskTokens.ts  (estende status/prioridades)
```

Migrations criam as 7 tabelas novas com RLS + triggers de validação de status (mesmo padrão do projeto).

Rota pública `/f/:slug` adicionada em `App.tsx` sem ProtectedRoute.

Todos os pills via `StatusPill domain={...} status={...}` — fonte única de cores.

---

## Fora desta fase (roadmap)

- Fase 2: Anexos em formulários, automações (resposta → tarefa automática), notificações de prazo, recorrência de tarefas/processos.
- Fase 3: Dashboards/analytics, busca global, comentários em processos, templates de formulário, drag-and-drop.

---

## Confirmações antes de implementar

1. **Posso adicionar os 2 status novos a `tasks`** (`aguardando`, `cancelado`) e a prioridade `urgente`? Isso muda o trigger de validação.
2. **Formulários públicos:** ok criar rota `/f/:slug` aberta (sem login) e permitir INSERT anônimo em `form_responses` quando o form está publicado?
3. **Escopo desta entrega:** confirma a Fase 1 inteira (Hoje refinado + Tarefas/Cronograma refinados + Processos + Formulários + Solicitações) ou prefere quebrar (ex.: só Processos agora, Formulários/Solicitações depois)?
