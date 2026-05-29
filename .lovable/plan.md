## Objetivo

Trocar todos os `window.confirm()` nativos do app por diálogos de confirmação estilizados (`AlertDialog` do shadcn), garantindo consistência visual e melhor UX (sem o atraso/bloqueio do diálogo nativo do navegador).

## Componente compartilhado

Criar `src/components/shared/ConfirmDialog.tsx` reutilizável, com duas formas de uso:

1. **Imperativa via hook `useConfirm()`** — retorna uma função `confirm({ title, description, confirmText?, cancelText?, destructive? }) => Promise<boolean>`. Internamente monta um `AlertDialog` controlado por estado e resolve a promise no clique. Isso permite trocar `if (!confirm("..."))` por `if (!(await confirm({...})))` com mudança mínima.
2. Provider `<ConfirmProvider>` montado uma vez em `src/App.tsx` (envolvendo as rotas) para hospedar o dialog único.

Variante `destructive: true` aplica `buttonVariants({ variant: "destructive" })` no botão de ação.

## Substituições (12 ocorrências)

| Arquivo | Linha | Texto atual | Destrutivo |
|---|---|---|---|
| `TasksPanel.tsx` | 343 | "Excluir esta tarefa?" | sim |
| `TasksPanel.tsx` | 414 | "Excluir subtarefa \"{title}\"?" | sim |
| `workspace/WorkspacesPanel.tsx` | 134 | "Arquivar este ambiente?..." | não |
| `workspace/WorkspacesPanel.tsx` | 145 | "Excluir DEFINITIVAMENTE..." | sim |
| `workspace/WorkspacesPanel.tsx` | 256 | "Remover este membro?" | sim |
| `requests/RequestsPanel.tsx` | 386 | "Excluir esta solicitação?" | sim |
| `forms/FormsPanel.tsx` | 164 | "Excluir formulário e todas as respostas vinculadas?" | sim |
| `processes/ProcessesPanel.tsx` | 233 | "Excluir processo e todas as etapas?" | sim |
| `processes/ProcessesPanel.tsx` | 550 | "Excluir processo?" | sim |
| `processes/ProcessesPanel.tsx` | 926 | "Excluir modelo e suas etapas?" | sim |
| `processes/ProcessesPanel.tsx` | 1286 | "Excluir esta etapa?" | sim |
| `processes/ProcessesPanel.tsx` | 1292 | "Cancelar este processo?" | não |

Em cada caso, a função handler passa a ser `async` (quando ainda não for) e o `if (!confirm(...)) return;` vira:

```ts
const ok = await confirm({
  title: "Excluir tarefa",
  description: "Esta ação não pode ser desfeita.",
  destructive: true,
});
if (!ok) return;
```

## Detalhes técnicos

- Usa `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel` já existentes em `src/components/ui/alert-dialog.tsx`.
- Hook guarda `{ options, resolve }` em estado; `onOpenChange(false)` resolve `false` para cobrir ESC/clique fora.
- Sem alterações de lógica de negócio, banco ou RLS — apenas camada de apresentação.

## Fora do escopo

- `window.alert` e `window.prompt` (não foram solicitados).
- Diálogos de confirmação já implementados com componentes (se houver) — não tocar.
