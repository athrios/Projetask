## Botão de exclusão nos cards de processo

Hoje a lista de processos tem um botão de excluir (ícone lixeira), mas as visualizações **Kanban** e **Grade** mostram cards sem esse botão — só dá pra excluir trocando de visão. A permissão já existe no banco (apenas owner/admin do ambiente consegue excluir), só falta o botão.

### O que será feito

- Adicionar um botão de lixeira no canto superior direito do `ProcessCard` (usado em Kanban e Grade).
- O botão fica oculto por padrão e aparece ao passar o mouse no card (mesmo padrão da lista).
- Ao clicar, pede confirmação ("Excluir processo?") e chama a mesma função `removeProcess` já existente, que:
  - apaga o processo no banco (RLS garante que só quem tem permissão de excluir consegue),
  - registra no log de atividade,
  - recarrega a tela.
- Clicar no botão **não** abre o processo (stopPropagation).

### Detalhes técnicos

- Arquivo: `src/components/processes/ProcessesPanel.tsx`
- `ProcessCard` ganha prop opcional `onRemove?: () => void`.
- `KanbanView` e a grade (linhas ~244-258) passam `onRemove={() => removeProcess(p.id)}`.
- Reutiliza o ícone `Trash2` já importado e as classes `opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive` para combinar com a lista.

Sem mudanças de banco, sem mudanças de permissão — só UI.
