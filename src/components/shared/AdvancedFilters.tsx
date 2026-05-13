import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterState {
  status: string[];
  priority: string[];
  source: string[];
  dueFrom: string | null;
  dueTo: string | null;
}

export const emptyFilterState: FilterState = {
  status: [],
  priority: [],
  source: [],
  dueFrom: null,
  dueTo: null,
};

interface Props {
  value: FilterState;
  onChange: (v: FilterState) => void;
  statusOptions?: FilterOption[];
  priorityOptions?: FilterOption[];
  sourceOptions?: FilterOption[];
}

export const activeFilterCount = (f: FilterState) =>
  f.status.length + f.priority.length + f.source.length +
  (f.dueFrom ? 1 : 0) + (f.dueTo ? 1 : 0);

export const AdvancedFilters = ({
  value,
  onChange,
  statusOptions = [],
  priorityOptions = [],
  sourceOptions = [],
}: Props) => {
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(value);

  const toggle = (key: "status" | "priority" | "source", v: string) => {
    const cur = value[key];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...value, [key]: next });
  };

  const Section = ({
    title, options, key,
  }: {
    title: string; options: FilterOption[]; key: "status" | "priority" | "source";
  }) => options.length === 0 ? null : (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-1">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox
              checked={value[key].includes(o.value)}
              onCheckedChange={() => toggle(key, o.value)}
              className="h-3.5 w-3.5"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5", count > 0 && "border-foreground/40")}
        >
          <Filter className="h-3.5 w-3.5" />
          Filtros
          {count > 0 && (
            <span className="rounded-full bg-foreground text-background text-[10px] h-4 min-w-4 px-1 inline-flex items-center justify-center tabular-nums">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <Section title="Status" options={statusOptions} key_="status" {...{ key: "status" }} />
        <Section title="Prioridade" options={priorityOptions} key_="priority" {...{ key: "priority" }} />
        <Section title="Origem" options={sourceOptions} key_="source" {...{ key: "source" }} />
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prazo</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={value.dueFrom ?? ""}
              onChange={(e) => onChange({ ...value, dueFrom: e.target.value || null })}
              className="h-8 text-xs"
            />
            <Input
              type="date"
              value={value.dueTo ?? ""}
              onChange={(e) => onChange({ ...value, dueTo: e.target.value || null })}
              className="h-8 text-xs"
            />
          </div>
        </div>
        {count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => onChange(emptyFilterState)}
          >
            <X className="h-3 w-3" /> Limpar filtros
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
};
