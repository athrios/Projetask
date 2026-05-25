## Card de pré-visualização do CNPJ no formulário público

Depois que o respondente digita um CNPJ válido e a consulta retorna com sucesso, exibir **logo abaixo do input** um card com o resumo dos dados retornados — no estilo da referência (Razão Social, Nome Fantasia, Status, Endereço, Atividade Principal, Atividades Secundárias).

Esse card é **apenas visual** (preview). O autopreenchimento dos demais campos do formulário continua funcionando exatamente como hoje.

### Escopo

Arquivo único: `src/pages/PublicForm.tsx`.

Nada muda no backend, na edge function `lookup-cnpj`, no cache, no builder, na tabela `form_fields`, ou nos `options.autofill`.

### Mudanças

1. **Novo estado** ao lado de `cnpjLoading` / `cnpjError`:
   - `cnpjData: Record<string, CnpjLookupData>` — guarda o último resultado bem-sucedido por field id.

2. **Em `runCnpjLookup`**:
   - Em caso de sucesso: `setCnpjData((p) => ({ ...p, [field.id]: data }))`.
   - Em caso de erro / digitação nova: limpar `cnpjData[field.id]` (no `onChange` do input, quando o usuário alterar o valor, e em erro).

3. **Renderização**: dentro do bloco `f.field_type === "cnpj"`, depois da mensagem de erro, renderizar (se `cnpjData[f.id]` existir):

   ```text
   ┌───────────────────────────────────────────────┐
   │ ● Razão Social         ● Nome Fantasia        │
   │   SONIA LIMA COM…        —                    │
   │ ● Status                                      │
   │   ATIVA                                       │
   ├───────────────────────────────────────────────┤
   │ ● Endereço                                    │
   │   AV TIRADENTES 746 FRENTE                    │
   │   Bairro: JARDIM GUARULHOS — CEP 07.090-000   │
   │   Cidade: GUARULHOS / SP                      │
   ├───────────────────────────────────────────────┤
   │ ● Atividade Principal                         │
   │   47.89-0-99 — Comércio varejista…            │
   │ ● Atividades Secundárias                      │
   │   • 82.11-3-00 — Serviços combinados…         │
   └───────────────────────────────────────────────┘
   ```

   - Card usando tokens do design system: `rounded-lg border bg-card p-4 text-sm space-y-3`.
   - Ícones discretos do `lucide-react` já existentes no projeto (`Building2`, `MapPin`, `Activity`, `CheckCircle2`) à esquerda de cada label, em `text-muted-foreground`.
   - Labels em `text-xs uppercase tracking-wide text-muted-foreground`; valores em `text-foreground`.
   - Grid de 2 colunas em telas ≥ `sm` para Razão social / Nome fantasia / Status; bloco de endereço e atividades em coluna única.
   - Campos ausentes (null) renderizam `—`.
   - CEP formatado com `maskCep` (helper já existente no arquivo).

4. **Texto sutil de rodapé do card**: "Os campos abaixo foram preenchidos automaticamente. Você pode editar à vontade." — apenas quando há mapeamento `autofill` configurado para o campo; caso contrário ocultar essa linha.

### Fora do escopo

- Sem alterações no edge function, na tabela `cnpj_lookup_cache` ou em `form_fields`.
- Sem novos campos no banco.
- Sem mudanças no builder (`FormsPanel.tsx`).
- Sem alteração da identidade visual; reutiliza tokens existentes (`--card`, `--border`, `--muted-foreground`, etc.).
- Sem QSA / sócios (a edge function atual não retorna sócios).
