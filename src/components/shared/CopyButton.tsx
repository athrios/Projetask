import { useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  getText: () => string;
  getCleanText?: () => string;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "xs";
  label?: string;
}

export const CopyButton = ({ getText, getCleanText, className, iconClassName, size = "sm", label = "Copiar" }: Props) => {
  const [done, setDone] = useState(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success(message);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!getCleanText) {
      void copy(getText(), "Copiado");
      return;
    }
    // Defer single-click to detect a double-click
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      void copy(getText(), "Copiado");
    }, 220);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (getCleanText) {
      void copy(getCleanText(), "Copiado (sem formatação)");
    } else {
      void copy(getText(), "Copiado");
    }
  };

  const dims = size === "xs" ? "h-5 w-5" : "h-6 w-6";
  const icon = iconClassName ?? (size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5");
  const title = getCleanText ? `${label} (clique duplo: sem formatação)` : label;
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={title}
      title={title}
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
