import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  getText: () => string;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "xs";
  label?: string;
}

export const CopyButton = ({ getText, className, iconClassName, size = "sm", label = "Copiar" }: Props) => {
  const [done, setDone] = useState(false);
  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(getText());
      setDone(true);
      toast.success("Copiado");
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  const dims = size === "xs" ? "h-5 w-5" : "h-6 w-6";
  const icon = iconClassName ?? (size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5");
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted shrink-0",
        dims,
        className,
      )}
    >
      {done ? <Check className={cn(icon, "text-[hsl(var(--status-feita))]")} /> : <Copy className={icon} />}
    </button>
  );
};

export default CopyButton;
