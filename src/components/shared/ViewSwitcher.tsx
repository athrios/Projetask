import { List, Table as TableIcon, LayoutGrid, Columns3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "list" | "table" | "cards" | "kanban";

const ICONS = {
  list: List,
  table: TableIcon,
  cards: LayoutGrid,
  kanban: Columns3,
} as const;

const LABELS: Record<ViewMode, string> = {
  list: "Lista",
  table: "Tabela",
  cards: "Cards",
  kanban: "Kanban",
};

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  views?: ViewMode[];
  className?: string;
}

export const ViewSwitcher = ({
  value,
  onChange,
  views = ["list", "table", "cards", "kanban"],
  className,
}: Props) => (
  <div className={cn("inline-flex rounded-md border bg-card p-0.5", className)}>
    {views.map((v) => {
      const Icon = ICONS[v];
      const active = value === v;
      return (
        <button
          key={v}
          onClick={() => onChange(v)}
          title={LABELS[v]}
          className={cn(
            "h-7 px-2.5 inline-flex items-center gap-1.5 rounded text-xs font-medium transition-colors",
            active
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{LABELS[v]}</span>
        </button>
      );
    })}
  </div>
);
