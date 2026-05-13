import { PRIORITIES, priorityPill, type Priority } from "@/lib/taskTokens";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  value: Priority;
  onChange?: (v: Priority) => void;
  className?: string;
}

export const PriorityPill = ({ value, onChange, className }: Props) => {
  const label = PRIORITIES.find((p) => p.value === value)?.label ?? value;
  if (!onChange) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-medium h-6 px-2.5 text-[11px]",
          priorityPill[value],
          className,
        )}
      >
        {label}
      </span>
    );
  }
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
      <SelectTrigger
        className={cn(
          "h-7 w-[100px] text-xs border-0 rounded-full font-medium justify-center",
          priorityPill[value],
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
