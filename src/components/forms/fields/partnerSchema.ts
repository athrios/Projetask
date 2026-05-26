// Schema-driven configuration for the partner_group / QSA field.
// Stored in form_fields.options as { partner_schema: PartnerSubfield[] }.
// Default subfields preserve current builtin ids so old responses remain readable.

export type PartnerSubfieldType =
  | "text"
  | "long_text"
  | "number"
  | "currency"
  | "date"
  | "email"
  | "phone"
  | "cpf"
  | "cnpj"
  | "select"
  | "checkbox"
  | "state_city"
  | "address";

export interface PartnerSubfield {
  id: string;
  label: string;
  type: PartnerSubfieldType;
  required?: boolean;
  options?: string[]; // for "select"
  builtin?: boolean;
  hidden?: boolean; // builtin can be hidden but not removed
}

export const ESTADO_CIVIL_OPTIONS = [
  "Solteiro(a)",
  "Casado(a)",
  "União Estável",
  "Divorciado(a)",
  "Viúvo(a)",
  "Separado Judicialmente",
];

export const REGIME_BENS_OPTIONS = [
  "Comunhão parcial",
  "Comunhão universal",
  "Separação total",
  "Participação final nos aquestos",
];

export const ETNIA_OPTIONS = ["Branca", "Preta", "Parda", "Amarela", "Indígena"];

// Builtin order (do not reorder ids — used for backward compat keying).
export const DEFAULT_PARTNER_SCHEMA: PartnerSubfield[] = [
  { id: "nome", label: "Nome completo", type: "text", required: true, builtin: true },
  { id: "data_nascimento", label: "Data de nascimento", type: "date", builtin: true },
  { id: "nacionalidade", label: "Nacionalidade", type: "text", builtin: true },
  { id: "naturalidade", label: "Naturalidade (UF / Cidade)", type: "state_city", builtin: true },
  { id: "profissao", label: "Profissão", type: "text", builtin: true },
  {
    id: "estado_civil",
    label: "Estado civil",
    type: "select",
    options: ESTADO_CIVIL_OPTIONS,
    builtin: true,
  },
  {
    id: "regime_bens",
    label: "Regime de bens",
    type: "select",
    options: REGIME_BENS_OPTIONS,
    builtin: true,
  },
  { id: "endereco", label: "Endereço residencial", type: "address", builtin: true },
  {
    id: "etnia",
    label: "Autodeclaração de etnia",
    type: "select",
    options: ETNIA_OPTIONS,
    builtin: true,
  },
  { id: "participacao", label: "Participação no capital (R$)", type: "currency", builtin: true },
];

export const BUILTIN_IDS = new Set(DEFAULT_PARTNER_SCHEMA.map((s) => s.id));
export const REQUIRED_BUILTIN_IDS = new Set(["nome"]);

/**
 * Resolve the effective partner schema from a form field's `options` JSON.
 * - If no schema is stored, returns the default.
 * - If a schema exists, merges it with the default so missing builtins are still available
 *   (appended at the end, hidden=false) — preserves backward compatibility for old responses.
 */
export const resolvePartnerSchema = (options: unknown): PartnerSubfield[] => {
  const raw =
    options && typeof options === "object" && !Array.isArray(options)
      ? (options as { partner_schema?: unknown }).partner_schema
      : null;
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PARTNER_SCHEMA.map((s) => ({ ...s }));
  }
  const cleaned: PartnerSubfield[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Partial<PartnerSubfield>;
    if (!o.id || typeof o.id !== "string") continue;
    if (seen.has(o.id)) continue;
    const builtin = BUILTIN_IDS.has(o.id);
    const def = DEFAULT_PARTNER_SCHEMA.find((s) => s.id === o.id);
    cleaned.push({
      id: o.id,
      label: typeof o.label === "string" && o.label.trim() ? o.label : def?.label ?? o.id,
      type: (o.type as PartnerSubfieldType) ?? def?.type ?? "text",
      required: REQUIRED_BUILTIN_IDS.has(o.id) ? true : !!o.required,
      options: Array.isArray(o.options) ? o.options : def?.options,
      builtin,
      hidden: builtin ? !!o.hidden : false,
    });
    seen.add(o.id);
  }
  for (const def of DEFAULT_PARTNER_SCHEMA) {
    if (!seen.has(def.id)) cleaned.push({ ...def });
  }
  return cleaned;
};

export const isMarriedLike = (estadoCivil: unknown): boolean => {
  if (typeof estadoCivil !== "string") return false;
  const v = estadoCivil.toLowerCase();
  return v.startsWith("casado") || v.startsWith("uniao") || v.startsWith("união");
};
