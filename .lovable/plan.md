### Objetivo
Adicionar ao botão de copiar dos campos de cliente a funcionalidade de **clique duplo** para copiar o valor sem caracteres especiais (ex: `31.635.482/0001-45` → `31635482000145`).

### Escopo
1. **Componente `CopyButton` compartilhado** (`src/components/shared/CopyButton.tsx`)
   - Adicionar prop opcional `getCleanText?: () => string`.
   - Manter `onClick` copiando o valor exato (`getText()`).
   - Adicionar `onDoubleClick` que, quando `getCleanText` for fornecido, copia o valor limpo e exibe toast diferente.
   - Se `getCleanText` não for fornecido, o duplo clique executa o mesmo comportamento do clique simples.

2. **Componente `Field` em `ClientsPanel.tsx`**
   - Passar `getCleanText={() => value.replace(/[^a-zA-Z0-9]/g, '')}` para o `CopyButton`.
   - Isso remove todos os caracteres especiais (pontos, barras, hífens, espaços etc.), mantendo apenas letras e números.

3. **Toast diferenciado**
   - Clique simples: "Copiado"
   - Clique duplo: "Copiado (sem formatação)"

### Fora do escopo
- Não será alterado o `CopyButton` local de `RequestsPanel.tsx` (não é parte do pedido).
- Não serão alterados outros painéis (Processos etc.) — o novo prop é opcional, então não há impacto.

### Arquivos a modificar
- `src/components/shared/CopyButton.tsx`
- `src/components/clients/ClientsPanel.tsx`