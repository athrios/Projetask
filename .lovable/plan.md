## CNPJ autofill — UI integration (form builder + public form)

The backend (edge function `lookup-cnpj` + cache table) is already in place. This step only wires the UI.

### 1. Database — add new field type to validation

The `validate_form_field_type` trigger currently rejects unknown types. Add `'cnpj'` to the allowed list (migration). No new tables; mapping config is stored inside the existing `form_fields.options` jsonb column.

### 2. Form builder (`src/components/forms/FormsPanel.tsx`)

- Extend `FieldType` union and `FIELD_TYPES` list with `{ value: "cnpj", label: "CNPJ com preenchimento automático" }`.
- When a field of type `cnpj` is selected, render a new config block (similar to the `partner_group` block) titled "Preenchimento automático" with one row per autofillable property:
  - Razão social, Nome fantasia, Status, Endereço (logradouro+nº+complemento+bairro), Cidade, Estado, CEP, CNAE principal, CNAEs secundários, Telefone, E‑mail.
  - Each row has a `Select` listing the other fields of the form (by label, filtered by sensible target types: `short_text`/`long_text`/`state_city`/`address`) plus an "— Não preencher —" option.
- Persist the mapping as `options = { autofill: { company_name: "<label>", trade_name: "<label>", ... } }` in the field row. The view `form_fields_public` already exposes `options`, so the public form reads it without schema changes.
- Hide the existing "options textarea" block for `cnpj` (it's not a select).

### 3. Public form (`src/pages/PublicForm.tsx`)

- Extend the `FieldType` union with `"cnpj"`.
- Render the CNPJ field as a masked input `00.000.000/0000-00` (formatting on each keystroke, max 18 chars).
- On `blur`, if the raw digits length === 14:
  - Set a per-field `loading` state (subtle inline spinner + "Consultando CNPJ…" muted text right of the input).
  - Call the existing edge function via `supabase.functions.invoke("lookup-cnpj", { body: { cnpj: digits } })`.
  - On success: read `data` and the field's `options.autofill` mapping; for each mapped property write into `values[targetLabel]`:
    - Text fields → string (e.g. razão social, status, telefone, e‑mail, CEP formatted, CNAE as `"<code> - <description>"`, secondary CNAEs joined with `; `).
    - `address` target → `{ cep, logradouro, numero, complemento, bairro }` matching `AddressValue`.
    - `state_city` target → `{ uf, cidade }`.
  - Existing user-typed values are overwritten only on a successful lookup (so the respondent can still edit afterwards — every field stays editable).
  - On failure (invalid CNPJ, 404, network): show a small muted line below the input — "Não foi possível consultar este CNPJ. Você pode preencher manualmente." No toast spam.
- No change to required-field/validation logic beyond accepting `cnpj` as a string type.

### 4. Out of scope

- No backend changes (function, cache, schema columns).
- No visual identity changes; reuse existing tokens, `Input`, muted text and `Loader2` icon already used elsewhere.
- No new field validations beyond accepting the new type.

### Technical notes

- Mapping shape stored in `form_fields.options`:
  ```json
  { "autofill": { "company_name": "Razão social", "address": "Endereço", "city": "Cidade", ... } }
  ```
- Public form keeps `options` typed as `unknown`; we cast with a narrow helper `getAutofillMap(options)`.
- CNPJ mask helper lives inline in `PublicForm.tsx` (small, no new file).
- Loading + error state stored in two local maps keyed by field id: `cnpjLoading: Record<string, boolean>`, `cnpjError: Record<string, boolean>`.

### Files touched

- migration (add `'cnpj'` to `validate_form_field_type`)
- `src/components/forms/FormsPanel.tsx`
- `src/pages/PublicForm.tsx`
