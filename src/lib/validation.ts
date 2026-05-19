import { z } from "zod";

// Strip control chars (keep \n \t)
const clean = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim();

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .transform(clean)
    .pipe(
      z
        .string()
        .min(min, `${label}: mínimo ${min} caractere(s)`)
        .max(max, `${label}: máximo ${max} caracteres`),
    );

const optText = (max: number, label: string) =>
  z
    .string()
    .transform(clean)
    .pipe(z.string().max(max, `${label}: máximo ${max} caracteres`));

export const workspaceNameSchema = text(1, 80, "Nome do ambiente");
export const taskTitleSchema = text(1, 200, "Título");
export const subtaskTitleSchema = text(1, 200, "Subtarefa");
export const notesSchema = optText(5000, "Observações");
export const processNameSchema = text(1, 200, "Nome do processo");
export const stepTitleSchema = text(1, 200, "Etapa");
export const templateNameSchema = text(1, 120, "Nome do modelo");
export const formTitleSchema = text(1, 160, "Título do formulário");
export const formDescriptionSchema = optText(2000, "Descrição");
export const fieldLabelSchema = text(1, 160, "Rótulo");
export const optionSchema = text(1, 120, "Opção");
export const memberEmailSchema = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().email("E-mail inválido").max(254));
export const submitterNameSchema = text(1, 120, "Nome");
export const publicTextAnswerSchema = optText(5000, "Resposta");

export const safeParse = <T,>(schema: z.ZodType<T>, value: unknown):
  | { ok: true; value: T }
  | { ok: false; error: string } => {
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? "Valor inválido" };
};
