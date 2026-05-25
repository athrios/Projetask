## Corrigir CNPJ: consulta apenas informativa + snapshot na resposta

Tornar a consulta de CNPJ **somente informativa** (bloco de conferência), nunca preenche outros campos. O snapshot fica salvo em `form_responses` em coluna separada e é exibido em Respostas/Solicitações.

> Migration já executada: coluna `cnpj_lookup_snapshot jsonb` adicionada em `form_responses`.

### 1. Form Builder — `src/components/forms/FormsPanel.tsx`

- Renomear opção do tipo CNPJ para **"CNPJ (consulta informativa)"**.
- Remover `CNPJ_AUTOFILL_KEYS`, `getCnpjAutofillMap`, `eligibleTargetsFor` e todo o bloco de UI de mapeamento autofill dentro do editor de campo CNPJ (linhas ~750–787).
- Campos com `options.autofill` legado deixam de ser usados (sem migração de dados).

### 2. Formulário público — `src/pages/PublicForm.tsx`

- Manter máscara, validação e chamada `lookup-cnpj` no `onBlur`.
- **Remover toda a lógica de autofill** em `runCnpjLookup`: o bloco com `getCnpjAutofillMap`, `switch(key)` e `setValues(...updates)`. Manter só `setCnpjLoading`, `setCnpjError`, `setCnpjData`.
- Tratar `res.error === "invalid_cnpj"` separadamente para mostrar "CNPJ inválido. Verifique os números digitados.". Demais erros: "Não encontramos dados públicos para este CNPJ. Você pode continuar mesmo assim.".
- Loading: adicionar texto "Consultando dados do CNPJ…" ao lado do spinner.
- `CnpjPreviewCard`:
  - Remover prop `hasAutofill` e o rodapé sobre preenchimento automático.
  - Adicionar título **"Dados públicos encontrados para conferência"** e subtítulo **"Revise as informações antes de continuar. Esses dados não preenchem o formulário automaticamente."**.
- **Submit**: montar `cnpj_lookup_snapshot` a partir do primeiro campo CNPJ com `cnpjData` válido, normalizado para:
  ```
  { cnpj, razao_social, nome_fantasia, situacao,
    endereco: { logradouro, numero, complemento, bairro, cidade, uf, cep },
    atividade_principal, atividades_secundarias: [{ codigo, descricao }],
    telefone, email, consultado_em }
  ```
  Incluir no `insert` em `form_responses`. Falha de consulta não bloqueia envio.

### 3. Respostas/Solicitações — `src/components/requests/RequestsPanel.tsx`

- Adicionar `cnpj_lookup_snapshot` ao tipo `Response`.
- No drawer de detalhe, abaixo das respostas, renderizar bloco separado **"Dados públicos do CNPJ consultado"** quando `open.cnpj_lookup_snapshot` existir (CNPJ formatado, razão social, fantasia, situação, endereço, atividade principal, secundárias, telefone, e-mail, data/hora). Visual com `border`, `bg-card` e ícones lucide consistentes.

### Fora do escopo

- Sem alterações na edge function `lookup-cnpj`, em `cnpj_lookup_cache`, RLS, auth ou identidade visual.
- Sem migração de dados antigos: respostas anteriores ficam com snapshot `null`.
