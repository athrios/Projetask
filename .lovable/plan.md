# Vínculo Formulário → Modelo de Processo

Permitir que cada formulário tenha um modelo de processo associado e, quando uma resposta pública chegar, gerar automaticamente um processo derivado desse modelo, vinculado à resposta.

## 1. Migração de banco

Adicionar em `forms`:
- `auto_create_process boolean not null default false`
- `linked_process_template_id uuid null` (sem FK declarada formal — alinhado ao padrão atual do projeto; validar no trigger)

Adicionar em `form_responses`:
- `created_process_id uuid null`
- índice único parcial: `create unique index form_responses_one_process_per_response on public.form_responses(id) where created_process_id is not null;` (garante 1 processo por resposta — combinado com a checagem do trigger evita duplicidade)

Atualizar a view `forms_public` para expor `auto_create_process` e `linked_process_template_id` (necessário só se a página pública decidir mostrar algo; pode ficar oculto, mas é inócuo expor um uuid).

Função `public.handle_form_response_autoprocess()` (SECURITY DEFINER, search_path=public) acionada por trigger `AFTER INSERT ON form_responses`:

1. Sair se `NEW.created_process_id IS NOT NULL`.
2. Buscar `forms` por `NEW.form_id`. Se `auto_create_process=false` OU `linked_process_template_id IS NULL`, retornar.
3. Validar que o template existe E pertence ao mesmo `workspace_id` do form. Se não, retornar silenciosamente (não bloquear o INSERT da resposta).
4. Calcular nome do processo:
   - Tentar extrair de `NEW.data` (jsonb) procurando chaves cujo label contenha (case-insensitive, sem acento) um de: `empresa`, `razao social`, `razão social`, `cliente`, `nome`, `email`, `e-mail`. Usar a primeira não-vazia.
   - Fallback: `submitter_name` se não vazio.
   - Fallback final: `to_char(now(), 'DD-MM-YY')` → `"{template.name} - Resposta de formulário - DD-MM-AA"`.
   - Formato com nome: `"{template.name} - {nome encontrado}"`.
5. Criar `processes` com `user_id = form.user_id`, `workspace_id = form.workspace_id`, `template_id`, `status='nao_iniciado'`, `template_type = tpl.template_type`, `table_data = tpl.table_schema` (se table) ou `'{"rows":[],"columns":[]}'`.
6. Se `template_type='tasks'`: inserir `process_steps` a partir de `process_template_steps` (mesma lógica do `createProcess` no client — copia `title`, `position`, `status='pendente'`, `due_date` baseada em `due_offset_days` se >0 sobre `current_date`).
7. `UPDATE form_responses SET created_process_id = <novo_id>, status='convertida_processo' WHERE id = NEW.id`.

Como é SECURITY DEFINER, contorna RLS — exatamente o que precisamos para que o INSERT anônimo via página pública consiga criar o processo. Toda a validação de workspace é feita dentro da função, então não há vazamento entre workspaces.

## 2. UI — `src/components/forms/FormsPanel.tsx`

No editor de formulário (modal de edição):
- Adicionar bloco "Automação":
  - `<Switch>` "Criar processo automaticamente ao receber resposta" → atualiza `auto_create_process`.
  - Se ativado, `<Select>` "Modelo de processo vinculado" listando `process_templates` do workspace ativo (carregar uma vez por modal). Texto de ajuda abaixo: *"Quando este formulário for respondido, um processo será criado automaticamente usando o modelo selecionado."*
  - Persistir via `update` em `forms` (debounced ou no blur, padrão atual do arquivo).
- Estender a interface `Form` local com `auto_create_process` e `linked_process_template_id`, e incluí-los no `select(...)` do `load()`.

Na listagem (card do formulário):
- Quando `auto_create_process && linked_process_template_id`, mostrar uma linha discreta: `Modelo vinculado: {nome do template}` e badge "Automação ativa".
- Caso contrário, nada (ou badge silencioso "Sem automação" — preferir não poluir).

## 3. UI — `src/components/requests/RequestsPanel.tsx`

Estender `Response` com `created_process_id` (já presente como `converted_process_id`; usar o novo `created_process_id` em paralelo, ambos significam vínculo a processo). Ajustes:
- No card e no modal de detalhe, se `created_process_id` existir, mostrar badge "Processo criado" + nome do processo (fetch lazy junto com responses ou via join manual).
- Substituir botão "Converter em processo" por "Abrir processo" (que faz `setOpenProcess(id)` navegando para Processos ou abre o `ProcessDetailDialog` — manter consistente: mais simples disabilitar o botão e adicionar um link/botão "Abrir processo" que troca para a aba Processos com `?process={id}` se já houver navegação por query, ou simplesmente um toast informativo + abre nova aba — verificar se já existe navegação programática entre painéis).
- Trate ambos os campos `converted_process_id` (conversão manual antiga) e `created_process_id` (automática) com a mesma lógica de "já tem processo".

## 4. PublicForm

Nenhuma mudança lógica: o trigger faz todo o trabalho. Garantir apenas que após o INSERT bem-sucedido a tela continua mostrando "Recebido!" — já é o caso.

## 5. Segurança

- A função é a única superfície privilegiada; valida `workspace_id` entre form e template.
- RLS de `forms`/`form_responses`/`processes` permanece intacta.
- `forms_public` segue sem expor `user_id`/template — opcionalmente expor `auto_create_process` se desejado para futuras telas; não é necessário no fluxo atual.

## 6. Critérios de aceite cobertos

- Modelo "Abertura" + form "Perguntas" com automação ligada → ao enviar a resposta pública, o trigger cria o processo, copia etapas e vincula via `created_process_id`.
- Templates de outros workspaces não aparecem no seletor (filtro por `workspace_id` no client) e o trigger ainda valida no servidor.
- Reenvios não duplicam: o trigger só dispara em INSERT; cada INSERT cria 1 processo. Se o mesmo respondente clicar "Enviar" duas vezes, são duas respostas (comportamento aceitável e consistente com o atual) — não duplicação por retry do mesmo registro.
- Tela Processos mostra o novo processo no workspace correto.
- Tela Solicitações mostra "Processo criado: …" com botão "Abrir processo".

## Notas técnicas

- A migração precisa rodar **antes** das mudanças de código (types do Supabase serão regerados).
- Manter `converted_process_id` por compatibilidade; novo campo `created_process_id` é o canônico daqui em diante. Alternativa: reusar `converted_process_id` direto no trigger e dispensar coluna nova — **preferir reuso** para evitar duplicação semântica. → **Decisão:** reusar `converted_process_id`; não criar `created_process_id`. O index único parcial passa a ser sobre `converted_process_id`.

Resumo final dos campos a adicionar:
- `forms.auto_create_process`, `forms.linked_process_template_id`
- Index único parcial em `form_responses.converted_process_id`
- Função + trigger `AFTER INSERT ON form_responses`
