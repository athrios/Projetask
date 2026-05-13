import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({ icon: Icon, title, description, action, className }: Props) => (
  <div
    className={cn(
      "rounded-xl border border-dashed bg-card/50 p-10 text-center flex flex-col items-center gap-3",
      className,
    )}
  >
    {Icon && (
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
    )}
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
    </div>
    {action}
  </div>
);
