import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Link as LinkIcon, FileText, Copy } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { logActivity } from "@/lib/activityLog";

type FieldType = "short_text" | "long_text" | "select" | "multi_select" | "date";

interface Form {
  id: string;
  title: string;
  description: string;
  public_slug: string;
  is_published: boolean;
}
interface Field {
  id: string;
  form_id: string;
  position: number;
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string[] | unknown;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "short_text", label: "Texto curto" },
  { value: "long_text", label: "Texto longo" },
  { value: "select", label: "Seleção" },
  { value: "multi_select", label: "Múltipla escolha" },
  { value: "date", label: "Data" },
];

interface Props { userId: string }

export const FormsPanel = ({ userId }: Props) => {
  const [forms, setForms] = useState<Form[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Form | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    const list = (data ?? []) as Form[];
    setForms(list);
    if (list.length) {
      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async (f) => {
          const { count } = await supabase
            .from("form_responses")
            .select("id", { count: "exact", head: true })
            .eq("form_id", f.id);
          counts[f.id] = count ?? 0;
        }),
      );
      setResponseCounts(counts);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    const t = newTitle.trim();
    if (!t) return;
    const { data, error } = await supabase
      .from("forms")
      .insert({ title: t, user_id: userId })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setNewTitle("");
    setEditing(data as Form);
    toast.success("Formulário criado");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir formulário e todas as respostas vinculadas?")) return;
    const { error } = await supabase.from("forms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Formulário excluído");
    load();
  };

  const togglePub = async (f: Form) => {
    const next = !f.is_published;
    const { error } = await supabase.from("forms").update({ is_published: next }).eq("id", f.id);
    if (error) return toast.error(error.message);
    await logActivity(userId, "form", f.id, next ? "published" : "unpublished",
      next ? `Formulário publicado: "${f.title}"` : `Formulário despublicado: "${f.title}"`);
    toast.success(next ? "Formulário publicado" : "Formulário despublicado");
    load();
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-5">
      <form
        className="flex gap-2 max-w-md"
        onSubmit={(e) => { e.preventDefault(); create(); }}
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Novo formulário..."
        />
        <Button type="submit" size="sm">
          <Plus className="h-4 w-4" /> Criar
        </Button>
      </form>

      {forms.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum formulário"
          description="Crie um formulário para receber solicitações via link público."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {forms.map((f) => (
            <div key={f.id} className="rounded-xl border bg-card p-4 group hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => setEditing(f)} className="text-left flex-1 min-w-0">
                  <h4 className="text-sm font-semibold truncate">{f.title}</h4>
                  {f.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{f.description}</p>
                  )}
                </button>
                <button
                  onClick={() => remove(f.id)}
                  className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{responseCounts[f.id] ?? 0} resposta(s)</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px]">Publicado</span>
                  <Switch checked={f.is_published} onCheckedChange={() => togglePub(f)} />
                </div>
              </div>
              {f.is_published && (
                <button
                  onClick={() => copyLink(f.public_slug)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs h-8 rounded-md border hover:bg-muted/40"
                >
                  <Copy className="h-3 w-3" /> Copiar link público
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <FormBuilder
          form={editing}
          userId={userId}
          onClose={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
};

const FormBuilder = ({
  form,
  userId,
  onClose,
}: {
  form: Form;
  userId: string;
  onClose: () => void;
}) => {
  const [title, setTitle] = useState(form.title);
  const [desc, setDesc] = useState(form.description);
  const [fields, setFields] = useState<Field[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("form_fields")
      .select("*")
      .eq("form_id", form.id)
      .order("position", { ascending: true });
    setFields(((data ?? []) as Field[]));
  };
  useEffect(() => { load(); }, [form.id]);

  const saveMeta = async () => {
    await supabase.from("forms").update({ title, description: desc }).eq("id", form.id);
  };

  const addField = async (type: FieldType) => {
    await supabase.from("form_fields").insert({
      form_id: form.id, user_id: userId, label: "Novo campo",
      field_type: type, required: false, position: fields.length, options: [],
    });
    load();
  };

  const updateField = async (id: string, patch: Partial<Field>) => {
    await supabase.from("form_fields").update(patch as never).eq("id", id);
    load();
  };

  const removeField = async (id: string) => {
    await supabase.from("form_fields").delete().eq("id", id);
    load();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { saveMeta(); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar formulário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveMeta} />
          </div>
          <div>
            <label className="text-xs font-medium">Descrição / Instruções</label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={saveMeta} className="min-h-[60px]" />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-2">Campos</h4>
            <div className="space-y-2">
              {fields.map((f) => (
                <div key={f.id} className="rounded-lg border p-3 space-y-2 group">
                  <div className="flex items-center gap-2">
                    <Input
                      value={f.label}
                      onChange={(e) => setFields((p) => p.map((x) => x.id === f.id ? { ...x, label: e.target.value } : x))}
                      onBlur={(e) => updateField(f.id, { label: e.target.value })}
                      className="h-8 text-sm flex-1"
                    />
                    <Select value={f.field_type} onValueChange={(v) => updateField(f.id, { field_type: v as FieldType })}>
                      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Switch checked={f.required} onCheckedChange={(v) => updateField(f.id, { required: v })} />
                      Obrigatório
                    </label>
                    <button
                      onClick={() => removeField(f.id)}
                      className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {(f.field_type === "select" || f.field_type === "multi_select") && (
                    <Textarea
                      defaultValue={Array.isArray(f.options) ? (f.options as string[]).join("\n") : ""}
                      placeholder="Uma opção por linha"
                      className="text-xs min-h-[60px]"
                      onBlur={(e) => updateField(f.id, {
                        options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) as never,
                      })}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {FIELD_TYPES.map((t) => (
                <Button key={t.value} variant="outline" size="sm" onClick={() => addField(t.value)}>
                  <Plus className="h-3.5 w-3.5" /> {t.label}
                </Button>
              ))}
            </div>
          </div>
          {form.is_published && (
            <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground flex-1 truncate">
                {window.location.origin}/f/{form.public_slug}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/f/${form.public_slug}`);
                  toast.success("Link copiado");
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => { saveMeta(); onClose(); }}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
