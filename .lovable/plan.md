## Diagnóstico

A política de criação de `workspaces` já está correta:

```text
Criar ambiente: usuário autenticado pode criar quando owner_id = usuário logado
```

O problema mais provável está no retorno do `insert().select().single()` usado ao criar o ambiente. Depois de inserir, o app pede o registro criado de volta. Para isso, a política de leitura também precisa permitir que o dono veja o próprio workspace imediatamente.

Hoje a leitura de `workspaces` depende apenas de `is_workspace_member(id, auth.uid())`. Como o membro owner é criado por trigger após a criação do workspace, pode haver falha no retorno da linha recém-criada, aparecendo como erro de RLS na criação.

## Plano de correção

1. Ajustar a política de leitura de `workspaces`
   - Manter membros podendo ver ambientes dos quais fazem parte.
   - Adicionar permissão explícita para o dono ver o próprio workspace:

```sql
auth.uid() = owner_id OR is_workspace_member(id, auth.uid())
```

2. Recriar a política de leitura com escopo autenticado
   - Remover a policy atual `ws members can view`.
   - Criar uma policy nova para usuários autenticados.
   - Isso evita depender exclusivamente do registro em `workspace_members` no momento exato do `insert().select()`.

3. Ajustar o frontend para ser mais resiliente
   - Em `CreateWorkspaceDialog.tsx`, manter `owner_id: user.id`.
   - Se necessário, trocar o fluxo para criar o workspace sem depender de `select()` imediato e recarregar a lista depois.
   - Aplicar o mesmo padrão ao auto-create em `useWorkspace.tsx`, porque ele também usa `insert().select()`.

4. Validar
   - Criar um novo ambiente logado.
   - Confirmar que ele aparece no switcher.
   - Confirmar que o usuário owner aparece como membro.
   - Confirmar que a troca de ambiente continua filtrando os dados por `workspace_id`.