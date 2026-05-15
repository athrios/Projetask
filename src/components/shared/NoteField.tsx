import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface NoteFieldProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  onLocalChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  autoFocus?: boolean;
  autoResize?: boolean;
}

export function NoteField({
  value,
  onSave,
  onLocalChange,
  placeholder,
  className,
  rows = 3,
  autoFocus,
  autoResize = false,
}: NoteFieldProps) {
  const [local, setLocal] = useState(value ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusedRef = useRef(false);
  const savedRef = useRef(value ?? "");

  // Only sync from incoming prop if user isn't typing and value differs from last saved baseline
  useEffect(() => {
    if (!focusedRef.current && value !== savedRef.current) {
      setLocal(value ?? "");
      savedRef.current = value ?? "";
    }
  }, [value]);

  useLayoutEffect(() => {
    if (!autoResize || !textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [autoResize, local]);

  const handleBlur = async () => {
    focusedRef.current = false;
    if (local === savedRef.current) return;
    setStatus("saving");
    setError(null);
    try {
      await onSave(local);
      savedRef.current = local;
      setStatus("saved");
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1800);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message ?? "Erro ao salvar");
    }
  };

  return (
    <div className="space-y-1">
      <Textarea
        ref={textareaRef}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onLocalChange?.(e.target.value);
          if (status === "saved" || status === "error") setStatus("idle");
        }}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        className={cn(
          autoResize ? "resize-none overflow-y-auto" : "resize-y",
          "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
          className,
        )}
      />
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground h-4">
        {status === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Salvando…
          </>
        )}
        {status === "saved" && (
          <>
            <Check className="h-3 w-3 text-emerald-600" /> Salvo
          </>
        )}
        {status === "error" && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3 w-3" /> {error ?? "Erro ao salvar"}
          </span>
        )}
      </div>
    </div>
  );
}
