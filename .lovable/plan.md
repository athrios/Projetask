Sim, confirmando: paramos na Seção 3 do módulo Formulários/Respostas (descrição individual por pergunta) — ela continua pendente e não será tocada agora.

# Plano: Recuperação de senha

Implementar fluxo padrão de "Esqueci minha senha" via email, sem mexer em nada do módulo de formulários.

## Escopo

1. **Link "Esqueci a senha?"** na tela `/auth` (modo login), abaixo do campo de senha.
2. **Modal/tela para solicitar o email** de recuperação. Ao enviar, chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${window.location.origin}/reset-password })` e mostra toast de confirmação ("Se o email existir, enviamos um link").
3. **Nova página pública `/reset-password`** que:
   - Detecta o token de recuperação no hash da URL (Supabase já cria a sessão temporária de recovery).
   - Mostra formulário com "Nova senha" + "Confirmar senha" (validação Zod, mínimo 6, máximo 72, iguais).
   - Chama `supabase.auth.updateUser({ password })`.
   - Em sucesso, faz `signOut` e redireciona para `/auth` com toast "Senha atualizada, faça login".
4. **Rota** adicionada em `src/App.tsx` (`/reset-password`), pública (fora de qualquer guard).

## Detalhes técnicos

- Reaproveitar o visual do `Auth.tsx` (mesmo card, logo, gradientes dourados) para consistência.
- Não alterar `useAuth`, `WorkspaceProvider` nem rotas existentes.
- Não habilitar auto-confirm nem mudar configurações de auth.
- Emails de recuperação usarão o template padrão do Lovable (já funciona). Não vou configurar domínio/templates customizados a menos que você peça.
- Sem mudanças de banco, RLS ou edge functions.

## Arquivos

- editar: `src/pages/Auth.tsx` (adicionar link + estado para abrir diálogo de recuperação)
- criar: `src/pages/ResetPassword.tsx`
- editar: `src/App.tsx` (registrar rota `/reset-password`)

## Testes manuais

1. Em `/auth`, clicar "Esqueci a senha?", digitar email, ver toast.
2. Receber email, clicar no link → cair em `/reset-password` autenticado em modo recovery.
3. Definir nova senha → redirecionado a `/auth` → login com nova senha funciona.
4. Senha antiga não funciona mais.
5. Acessar `/reset-password` sem token → mostra mensagem "Link inválido ou expirado".

Quer que eu pergunte o email antes de enviar via modal simples, ou prefere uma página dedicada `/forgot-password`?
