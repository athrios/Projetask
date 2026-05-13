import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  ListChecks,
  Workflow,
  Inbox,
  FileText,
  Search,
} from "lucide-react";

type ResultType = "task" | "process" | "request" | "form";

interface Result {
  type: ResultType;
  id: string;
  title: string;
  subtitle?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onNavigate: (section: "tasks" | "processes" | "requests" | "forms") => void;
}

const ICON: Record<ResultType, React.ComponentType<{ className?: string }>> = {
  task: ListChecks,
  process: Workflow,
  request: Inbox,
  form: FileText,
};

const LABEL: Record<ResultType, string> = {
  task: "Tarefa",
  process: "Processo",
  request: "Solicitação",
  form: "Formulário",
};

export const GlobalSearch = ({ open, onOpenChange, onNavigate }: Props) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const like = `%${term}%`;
      const [t, p, r, f] = await Promise.all([
        supabase.from("tasks").select("id,title,status").ilike("title", like).limit(8),
        supabase.from("processes").select("id,name,status,client_name").ilike("name", like).limit(8),
        supabase.from("form_responses").select("id,submitter_name,status,form_id").ilike("submitter_name", like).limit(8),
        supabase.from("forms").select("id,title,is_published").ilike("title", like).limit(8),
      ]);
      if (cancelled) return;
      const rs: Result[] = [];
      (t.data ?? []).forEach((x) => rs.push({ type: "task", id: x.id, title: x.title, subtitle: x.status }));
      (p.data ?? []).forEach((x) => rs.push({ type: "process", id: x.id, title: x.name, subtitle: x.client_name || x.status }));
      (r.data ?? []).forEach((x) => rs.push({ type: "request", id: x.id, title: x.submitter_name || "Anônimo", subtitle: x.status }));
      (f.data ?? []).forEach((x) => rs.push({ type: "form", id: x.id, title: x.title, subtitle: x.is_published ? "Publicado" : "Rascunho" }));
      setResults(rs);
    };
    const id = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(id); };
  }, [q, open]);

  const grouped = results.reduce<Record<ResultType, Result[]>>(
    (acc, r) => { (acc[r.type] ||= []).push(r); return acc; },
    { task: [], process: [], request: [], form: [] },
  );

  const sectionFor: Record<ResultType, "tasks" | "processes" | "requests" | "forms"> = {
    task: "tasks", process: "processes", request: "requests", form: "forms",
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar tarefas, processos, solicitações, formulários..."
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        {q.trim() === "" ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
            <Search className="h-5 w-5 mx-auto mb-2 opacity-50" />
            Comece a digitar para buscar.
          </div>
        ) : results.length === 0 ? (
          <CommandEmpty>Nada encontrado.</CommandEmpty>
        ) : (
          (Object.keys(grouped) as ResultType[])
            .filter((k) => grouped[k].length > 0)
            .map((k) => {
              const Icon = ICON[k];
              return (
                <CommandGroup key={k} heading={LABEL[k]}>
                  {grouped[k].map((r) => (
                    <CommandItem
                      key={`${k}-${r.id}`}
                      value={`${k}-${r.id}-${r.title}`}
                      onSelect={() => {
                        onNavigate(sectionFor[k]);
                        onOpenChange(false);
                      }}
                    >
                      <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="flex-1 truncate">{r.title}</span>
                      {r.subtitle && (
                        <span className="text-[11px] text-muted-foreground ml-2">{r.subtitle}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })
        )}
      </CommandList>
    </CommandDialog>
  );
};
