## Escopo

Ajustes pontuais no módulo **Processos** (`src/components/processes/ProcessesPanel.tsx`). Não recriar nada — só editar trechos existentes.

> Observação sobre datas: como o pedido fala em "datas do programa" mas o contexto inteiro é o módulo de Processos, vou aplicar o formato `DD-MM-AA` **apenas em datas do módulo Processos** (cards, lista, modal, etapas). Se quiser estender para todo o app, é só falar depois.

---

### 1. Remover botão "Marcar como concluída" do modal

Arquivo: `ProcessesPanel.tsx`, componente `CurrentStepCard` (linhas ~1438-1441).

- Remover o `<Button>` "Marcar como concluída".
- Manter o botão "Dispensar etapa" (continua sendo ação rápida útil).
- Remover a prop `onComplete` da assinatura de `CurrentStepCard` e do callsite (linha 1188).
- A função `completeStep` **permanece** — ela já é chamada por `changeStepStatus` quando o status vira `"feita"` (linha 1065). Ou seja: selecionar "Concluída" no dropdown do `Select` da etapa já conclui corretamente, avança próxima etapa (`advanceNext`) e recalcula o status do processo (`persistProcessStatus`).

### 2. Formato de data `DD-MM-AA`

Criar helper local no topo do arquivo:
```ts
const fmtDate = (iso?: string | null) =>
  iso ? format(parseISO(iso), "dd-MM-yy") : "";
```

Aplicar em todos os pontos onde data ISO é renderizada como texto no módulo:
- Linha 506: `Prazo: {p.due_date}` → `Prazo: {fmtDate(p.due_date)}` (card)
- Linha 1221: `{s.due_date && <span>{s.due_date}</span>}` → `{fmtDate(s.due_date)}` (etapas futuras)
- Linha 1406: `Prazo: {s.due_date}` → `Prazo: {fmtDate(s.due_date)}` (CurrentStepCard)
- Verificar também `ResolvedStepRow` e linha ~535 (ListView) se exibirem datas.

Inputs nativos `<input type="date">` e o `Calendar` do popover ficam intactos (já são UI controlada pelo SO/componente).

### 3. Status da etapa clicável no card

Arquivo: `ProcessesPanel.tsx`, componente `ProcessCard` (linhas ~419-510).

- Trocar o `<StatusPill>` da etapa atual (linha 489) por um `<Select>` compacto, estilizado para parecer com o pill (`h-6`, sem border visível até hover, mesma cor por status).
- Opções: Pendente / Em andamento / Concluída / Dispensada (mesmas 4 do `defaultStatuses`).
- Adicionar `onClick={(e) => e.stopPropagation()}` no container do select para não abrir o modal.
- Adicionar nova prop `onChangeStepStatus(stepId, nextStatus)` ao `ProcessCard`, repassada do `ProcessesPanel` raiz.
- No `ProcessesPanel`, criar uma função que faz o mesmo que `changeStepStatus` faz hoje no modal: update no `process_steps`, se `feita` chama lógica equivalente a `completeStep` (com `advanceNext` + `persistProcessStatus`), se `pulado` equivalente a `dismissStep`. Para evitar duplicação, **extrair** a lógica atual de `ProcessDetailDialog.changeStepStatus`/`completeStep`/`dismissStep` para funções utilitárias no escopo do módulo (recebendo `steps`, `processId`, etc.) ou aceitar pequena duplicação encapsulada num helper compartilhado.
- Após salvar, recarregar via callback `onChanged` já existente no painel (que faz refetch dos processos).

### 4. Observação copiável sem abrir modal

Arquivo: `ProcessesPanel.tsx`, `ProcessCard` (linhas 492-497).

- No `<div>` da observação adicionar:
  - `onClick={(e) => e.stopPropagation()}`
  - `onMouseDown={(e) => e.stopPropagation()}` (evita o "click" sintético no role=button do card pai durante seleção)
  - `onKeyDown={(e) => e.stopPropagation()}`
  - `className` ganha `cursor-text select-text`
- Resto do card continua clicável (header, nome, progresso, etapa atual).

### Aceite

- Modal: sem botão "Marcar concluída"; dropdown "Concluída" finaliza etapa, avança próxima, atualiza progresso.
- Datas exibidas no módulo Processos no formato `06-05-26`. Banco intacto.
- No card: clicar no pill de status da etapa abre apenas o dropdown (modal não abre); alteração persiste e o card atualiza.
- No card: arrastar/clicar na observação permite selecionar e copiar; não abre o modal.
- Sem mudanças em schema, RLS, workspace ou permissões.
