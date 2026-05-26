## Novo módulo CRM "Clientes"

Módulo independente para cadastro de clientes do workspace, posicionado logo abaixo de "Hoje" na sidebar. Reaproveita `lookup-cnpj` e o componente `AddressField` (ViaCEP) existentes, sem mexer em Formulários/Respostas/Tarefas.

### 1. Banco de dados (migration)

**Tabela `clients`** (escopo por `workspace_id`):
- `id`, `workspace_id`, `user_id` (criador), `created_at`, `updated_at`
- `client_type` text: `pessoa_fisica` | `pessoa_juridica` | `estrangeiro` (validado por trigger, como demais enums do projeto)
- `document` text (CPF, CNPJ ou doc estrangeiro — armazenado só com dígitos quando PF/PJ)
- `name` text (nome ou razão social)
- `trade_name` text (fantasia, opcional)
- `email` text, `phone` text
- `address` jsonb: `{ cep, logradouro, numero, complemento, bairro, cidade, uf, pais }`
- `cnpj_lookup_snapshot` jsonb (mesma estrutura usada em `form_responses`, opcional)
- `notes` text default `''`
- `custom_fields` jsonb default `'{}'::jsonb` (chave/valor livre, definido pelo usuário no próprio cliente)
- Índices: `(workspace_id)`, `(workspace_id, name)`, `(workspace_id, document)`

**Tabela `client_attachments`**:
- `id`, `client_id`, `workspace_id`, `user_id`, `created_at`
- `file_path` text (caminho no bucket), `file_name`, `mime_type`, `size_bytes`

**RLS (segue padrão dos demais módulos):**
- `clients` e `client_attachments` usam `has_workspace_permission(workspace_id, auth.uid(), 'clientes', <ação>)`
- INSERT exige `user_id = auth.uid()` + permissão `create`
- Triggers: `set_updated_at`, `autofill_workspace_id`, `validate_client_type`

**Storage:**
- Novo bucket privado `client-attachments`
- Policies em `storage.objects` por `bucket_id = 'client-attachments'` e pasta `{workspace_id}/{client_id}/...`, validando membership via `is_workspace_member`

### 2. Permissões

- Adicionar novo módulo `"clientes"` em `MODULE_KEYS`, `MODULE_LABELS` e no tipo `ModuleKey` (`src/hooks/useWorkspace.tsx`).
- Owner recebe acesso total automaticamente (já coberto pela lógica existente).
- Membros não-owner começam sem permissão — owner concede via `SettingsPanel`/`WorkspacesPanel` (UI atual já itera sobre `MODULE_KEYS`, então aparece sozinho).
- `RequireModule module="clientes"` protege a página.

### 3. UI / componentes

Sidebar (`src/pages/Index.tsx`):
- Novo `Section` `"clients"`, ícone `Users` (lucide), label "Clientes", subtitle "Cadastro de clientes do ambiente."
- Entrada em `SECTION_MODULE`: `clients: "clientes"`
- Posicionado logo abaixo de "Hoje" na lista de navegação.

Novos arquivos em `src/components/clients/`:
- `ClientsPanel.tsx` — lista (tabela leve estilo Notion), busca por nome/documento/email, filtro por tipo, botão "Novo cliente", abre drawer/sheet de edição. Empty state com `EmptyState`.
- `ClientForm.tsx` — formulário em seções: Geral, Endereço, Anexos, Observações, Campos personalizados.
  - Tipo: `Select` com 3 opções. Render condicional:
    - PJ: input CNPJ com máscara + validação (reusar `isValidCnpj` de `src/lib/validation.ts`) + botão/`onBlur` chama `supabase.functions.invoke("lookup-cnpj", { body: { cnpj } })`. Sucesso: preenche `name` (razão social), `trade_name`, `phone`, `email` (se vazios) e endereço; armazena `cnpj_lookup_snapshot`. Mostra `CnpjPreviewCard` informativo, igual ao formulário público.
    - PF: input CPF com máscara + validação (`isValidCpf`).
    - Estrangeiro: input livre de documento, sem validação.
  - Endereço: reaproveitar `AddressField` (`src/components/forms/fields/AddressField.tsx`) — já faz autofill por CEP via ViaCEP. Adicionar campo `pais` ao redor do componente (default "Brasil"; obrigatório quando tipo = Estrangeiro).
  - Anexos: lista + upload múltiplo via `supabase.storage.from('client-attachments').upload('{workspace_id}/{client_id}/{uuid}-{name}')`; signed URL para download; botão remover.
  - Campos personalizados: lista editável `{ label, value }[]` armazenada em `custom_fields` (sem schema global, por cliente).
- `ClientDetailDrawer.tsx` (opcional, pode ficar dentro de `ClientsPanel`) — visualização + edição inline com `NoteField` para observações.

### 4. Reaproveitamento

- **CNPJ:** chamar a edge function `lookup-cnpj` já existente. Não alterar a função nem `cnpj_lookup_cache`.
- **CEP/Endereço:** importar e usar `AddressField` como está; passar `value`/`onChange` ligados ao estado do cliente.
- **Validações:** `isValidCpf`, `isValidCnpj`, `maskCpf`, `maskCnpj`, `maskCep` de `src/lib/validation.ts`.
- **Visual:** componentes shadcn já usados (`Card`, `Input`, `Select`, `Sheet`, `Button`), tokens semânticos atuais, ícones lucide discretos. Sem mudanças no `index.css` ou `tailwind.config.ts`.

### 5. Anexos

- Bucket privado `client-attachments` criado por migration.
- Path padronizado: `{workspace_id}/{client_id}/{uuid}-{filename}`.
- Policies no `storage.objects`: SELECT/INSERT/DELETE permitidos quando `bucket_id='client-attachments'` e `is_workspace_member((storage.foldername(name))[1]::uuid, auth.uid())`, cruzando com `has_workspace_permission` quando aplicável.
- Tabela `client_attachments` guarda metadados; download via `createSignedUrl` (60s).

### 6. Passos mínimos de implementação

1. Migration: tabelas `clients`, `client_attachments`, triggers, RLS, bucket `client-attachments` + policies.
2. `useWorkspace.tsx`: adicionar `"clientes"` em `ModuleKey`, `MODULE_KEYS`, `MODULE_LABELS`.
3. `Index.tsx`: nova `Section "clients"`, item de sidebar abaixo de "Hoje", `RequireModule` e render de `<ClientsPanel />`.
4. Criar `src/components/clients/ClientsPanel.tsx` (lista + busca + criar/editar/excluir).
5. Criar `src/components/clients/ClientForm.tsx` (campos condicionais, CNPJ lookup, AddressField, anexos, custom fields).
6. Reuso: importar `AddressField`, helpers de `lib/validation.ts`, `lookup-cnpj` via `supabase.functions.invoke`.
7. Smoke test manual: criar/editar/excluir cliente PF, PJ (com lookup), Estrangeiro; anexar arquivo; conferir isolamento por workspace e bloqueio para membro sem permissão.

### Fora do escopo

- Não alterar `lookup-cnpj`, `cnpj_lookup_cache`, módulos de Formulários/Respostas/Tarefas/Processos.
- Sem mudanças de identidade visual ou tokens.
- Sem importação em massa, integrações externas ou pipeline de oportunidades nesta entrega.
