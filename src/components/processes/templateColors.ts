export type TemplateColor =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "orange";

export const TEMPLATE_COLORS: { key: TemplateColor; label: string; swatch: string }[] = [
  { key: "gray", label: "Cinza", swatch: "bg-slate-400" },
  { key: "blue", label: "Azul", swatch: "bg-blue-500" },
  { key: "green", label: "Verde", swatch: "bg-emerald-500" },
  { key: "yellow", label: "Amarelo", swatch: "bg-amber-400" },
  { key: "red", label: "Vermelho", swatch: "bg-rose-500" },
  { key: "purple", label: "Roxo", swatch: "bg-violet-500" },
  { key: "orange", label: "Laranja", swatch: "bg-orange-500" },
];

export const colorPill: Record<TemplateColor, string> = {
  gray: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700",
  blue: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800",
  green: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800",
  yellow: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800",
  red: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800",
  purple: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-200 dark:border-violet-800",
  orange: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800",
};

export const colorLeftBorder: Record<TemplateColor, string> = {
  gray: "border-l-slate-300 dark:border-l-slate-600",
  blue: "border-l-blue-400",
  green: "border-l-emerald-400",
  yellow: "border-l-amber-400",
  red: "border-l-rose-400",
  purple: "border-l-violet-400",
  orange: "border-l-orange-400",
};

export const asColor = (c?: string | null): TemplateColor => {
  const allowed = TEMPLATE_COLORS.map((x) => x.key);
  return (allowed.includes(c as TemplateColor) ? c : "gray") as TemplateColor;
};
