export type ConditionOperator = "equals" | "not_equals" | "contains" | "not_contains";

export interface FieldCondition {
  field_id: string;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionContext {
  /** Map of field id -> field label (used as the key in answers). */
  labelById: Record<string, string>;
  /** Map of field id -> whether the field is currently visible. */
  visibleById: Record<string, boolean>;
  answers: Record<string, unknown>;
}

const norm = (s: unknown) =>
  typeof s === "string" ? s.trim().toLowerCase() : "";

export const parseCondition = (raw: unknown): FieldCondition | null => {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<FieldCondition>;
  if (!c.field_id || !c.operator || typeof c.value !== "string") return null;
  if (!["equals", "not_equals", "contains", "not_contains"].includes(c.operator)) return null;
  return { field_id: c.field_id, operator: c.operator, value: c.value };
};

export const evaluateCondition = (
  cond: FieldCondition,
  ctx: ConditionContext,
): boolean => {
  // If controlling field is hidden or missing, treat the dependent as visible
  // (degradação segura).
  const label = ctx.labelById[cond.field_id];
  if (!label) return true;
  if (ctx.visibleById[cond.field_id] === false) return true;

  const answer = ctx.answers[label];
  const target = norm(cond.value);

  const contains = Array.isArray(answer)
    ? answer.some((x) => norm(x) === target)
    : norm(answer).includes(target);

  if (cond.operator === "contains") return contains;
  if (cond.operator === "not_contains") return !contains;
  const a = norm(answer);
  if (cond.operator === "equals") return a === target;
  return a !== target;
};
