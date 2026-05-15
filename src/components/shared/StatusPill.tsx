import {
  TASK_STATUS,
  SCHEDULE_STATUS,
  PROCESS_STATUS,
  PROCESS_STEP_STATUS,
  REQUEST_STATUS,
  statusPill,
  processStatusPill,
  processStepStatusPill,
  requestStatusPill,
  type TaskStatus,
  type ScheduleStatus,
  type ProcessStatus,
  type ProcessStepStatus,
  type RequestStatus,
} from "@/lib/taskTokens";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Domain = "task" | "schedule" | "process" | "process_step" | "request";

interface Props {
  domain: Domain;
  value: string;
  onChange?: (v: string) => void;
  size?: "sm" | "xs";
  className?: string;
}

const optionsFor = (d: Domain) => {
  if (d === "task") return TASK_STATUS;
  if (d === "schedule") return SCHEDULE_STATUS;
  if (d === "process") return PROCESS_STATUS;
  if (d === "process_step") return PROCESS_STEP_STATUS;
  return REQUEST_STATUS;
};

const colorFor = (d: Domain, v: string): string => {
  if (d === "process") return processStatusPill[v as ProcessStatus] ?? "";
  if (d === "process_step") return processStepStatusPill[v as ProcessStepStatus] ?? "";
  if (d === "request") return requestStatusPill[v as RequestStatus] ?? "";
  return statusPill[v as ScheduleStatus] ?? "";
};

export const StatusPill = ({ domain, value, onChange, size = "sm", className }: Props) => {
  const options = optionsFor(domain);
  const color = colorFor(domain, value);
  const label = options.find((o) => o.value === value)?.label ?? value;
  const sizeCls =
    size === "sm" ? "h-7 px-2.5 text-xs w-auto" : "h-6 px-2 text-[11px] w-auto";

  if (!onChange) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full font-medium",
          sizeCls,
          color,
          className,
        )}
      >
        {label}
      </span>
    );
  }
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "border-0 rounded-full font-medium justify-center",
          sizeCls,
          color,
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value as string} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export type { TaskStatus, ScheduleStatus, ProcessStatus, RequestStatus };
