## Envio de e-mail dos convites de workspace

### Objetivo
Disparar automaticamente um e-mail para o convidado sempre que um novo convite for criado em **Workspaces → Convites**, usando o remetente `convites@task.athrioscontabil.com.br`.

### Etapas

**1. Infraestrutura de e-mails do app**
- Provisionar a infraestrutura de envio (fila com retentativas, supressão de bounces, log de envios, cron de processamento).
- Criar as funções de envio (`send-transactional-email`), unsubscribe (`handle-email-unsubscribe`) e supressão (`handle-email-suppression`).

**2. Template "Convite para workspace"**
- Novo template React Email em `supabase/functions/_shared/transactional-email-templates/workspace-invite.tsx`.
- Conteúdo: saudação, nome de quem convidou, nome do workspace, botão **Aceitar convite** apontando para `/convite/{id}`, e nota de validade.
- Assunto: `Você foi convidado(a) para o workspace {nome}`.
- Remetente visível: `Athrios Tarefas <convites@task.athrioscontabil.com.br>`.

**3. Página de aceitação `/convite/:id`**
- Nova rota pública.
- Se o visitante não está logado, redireciona para `/auth` (login/cadastro) preservando o destino.
- Após login, busca o convite (RLS já permite quando o e-mail confere), exibe nome do workspace e botão **Aceitar**.
- Ao aceitar: marca `accepted_at`, insere o usuário em `workspace_members` e dá feedback de sucesso.
- Trata estados: convite inexistente, já aceito, e-mail não confere com o da conta.

**4. Disparo do e-mail na criação do convite**
- Em `WorkspacesPanel.tsx → InvitesTab.create`: após o insert bem-sucedido em `workspace_invitations`, chamar `supabase.functions.invoke('send-transactional-email', ...)` com:
  - `templateName: 'workspace-invite'`
  - `recipientEmail`: o e-mail informado
  - `idempotencyKey`: `workspace-invite-{id}` (evita reenvio em retries)
  - `templateData`: `{ inviterName, workspaceName, acceptUrl }`
- Remover o aviso "O envio de e-mail será habilitado em breve" e substituir por mensagem de status do envio.

### Detalhes técnicos
- Sender domain: `task.athrioscontabil.com.br` (já verificado).
- O rodapé de cancelamento é anexado automaticamente pelo sistema — o template não inclui esse link.
- `idempotencyKey` baseado no `id` do convite garante que cliques duplos ou retries não gerem dois e-mails.
- Página de aceite usa o `id` do convite como token (já é UUID); RLS garante que só o dono do e-mail pode lê-lo/aceitá-lo.
- Sem mudanças no schema do banco — `workspace_invitations` e `workspace_members` já existem.

### Fora de escopo
- Reenviar convite manualmente (pode vir depois).
- Expiração automática de convites.
- Personalização visual avançada do template além das cores do app.
