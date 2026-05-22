import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { submitterNameSchema, publicTextAnswerSchema } from "@/lib/validation";
import { StateCityField } from "@/components/forms/fields/StateCityField";
import { PartnerGroupField } from "@/components/forms/fields/PartnerGroupField";

type FieldType =
  | "short_text"
  | "long_text"
  | "select"
  | "multi_select"
  | "date"
  | "file"
  | "state_city"
  | "partner_group";

interface Form {
  id: string;
  user_id: string;
  workspace_id: string | null;
  title: string;
  description: string;
  is_published: boolean;
  logo_path: string | null;
  logo_alignment: "left" | "center" | "right" | null;
  submitter_name_label: string | null;
}
interface Field {
  id: string;
  position: number;
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string[] | unknown;
  description: string | null;
  add_button_label: string | null;
}

const PublicForm = () => {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Formulário";
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("forms_public" as never)
        .select("id,user_id,workspace_id,title,description,is_published,logo_path,logo_alignment")
        .eq("public_slug", slug)
        .maybeSingle();
      if (!data) { setLoading(false); return; }
      setForm(data as Form);
      const { data: fs } = await supabase
        .from("form_fields_public" as never)
        .select("id,form_id,label,field_type,required,options,position,description")
        .eq("form_id", (data as Form).id)
        .order("position", { ascending: true });
      setFields((fs ?? []) as Field[]);
      setLoading(false);
    })();
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const nameParsed = submitterNameSchema.safeParse(name);
    if (!nameParsed.success) return toast.error(nameParsed.error.issues[0]?.message ?? "Nome inválido");
    const cleanValues: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.label];
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (f.required && empty) {
        return toast.error(`Preencha "${f.label}"`);
      }
      if (typeof v === "string") {
        const r = publicTextAnswerSchema.safeParse(v);
        if (!r.success) return toast.error(`${f.label}: ${r.error.issues[0]?.message ?? "inválido"}`);
        cleanValues[f.label] = r.data;
      } else if (Array.isArray(v)) {
        if (v.length > 50) return toast.error(`${f.label}: máximo 50 itens`);
        cleanValues[f.label] = v.slice(0, 50);
      } else {
        cleanValues[f.label] = v;
      }
    }
    setSubmitting(true);
    const { error } = await supabase.from("form_responses").insert({
      form_id: form.id,
      owner_id: form.user_id,
      workspace_id: form.workspace_id,
      submitter_name: nameParsed.data,
      data: cleanValues as never,
      status: "recebida",
    });
    setSubmitting(false);
    if (error) return toast.error("Não foi possível enviar. O formulário pode ter sido despublicado.");
    setSubmitted(true);
  };

  if (loading) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Carregando…</div>;
  if (!form) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold">Formulário indisponível</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Este formulário não existe ou ainda não foi publicado.
          </p>
        </div>
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="min-h-screen grid place-items-center px-4 bg-muted/20">
        <div className="text-center max-w-md rounded-xl border bg-card p-10">
          <CheckCircle2 className="h-10 w-10 text-[hsl(var(--status-feita))] mx-auto" />
          <h1 className="text-xl font-semibold mt-3">Recebido!</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Sua solicitação foi enviada com sucesso.
          </p>
        </div>
      </div>
    );
  }

  const logoUrl = form.logo_path
    ? supabase.storage.from("form-logos").getPublicUrl(form.logo_path).data.publicUrl
    : null;
  const alignClass =
    form.logo_alignment === "left" ? "justify-start"
    : form.logo_alignment === "right" ? "justify-end"
    : "justify-center";

  return (
    <div className="min-h-screen bg-muted/20 py-10 px-4">
      <form onSubmit={submit} className="max-w-2xl mx-auto rounded-xl border bg-card p-8 space-y-5">
        {logoUrl && (
          <div className={`flex ${alignClass}`}>
            <img src={logoUrl} alt="" className="max-h-20 max-w-[240px] object-contain" />
          </div>
        )}
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{form.title}</h1>
          {form.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{form.description}</p>
          )}
        </header>

        <div>
          <label className="text-xs font-medium">Seu nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        {fields.map((f) => {
          const opts = (Array.isArray(f.options) ? f.options : []) as string[];
          const v = values[f.label];
          const set = (val: unknown) => setValues((p) => ({ ...p, [f.label]: val }));
          return (
            <div key={f.id} className="space-y-1">
              <label className="text-xs font-medium">
                {f.label}
                {f.required && <span className="text-destructive ml-0.5">*</span>}
              </label>
              {f.description && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">{f.description}</p>
              )}
              {f.field_type === "short_text" && (
                <Input value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />
              )}
              {f.field_type === "long_text" && (
                <Textarea value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} required={f.required} className="min-h-[80px]" />
              )}
              {f.field_type === "date" && (
                <Input type="date" value={(v as string) ?? ""} onChange={(e) => set(e.target.value)} required={f.required} />
              )}
              {f.field_type === "select" && (
                <Select value={(v as string) ?? ""} onValueChange={(val) => set(val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {f.field_type === "multi_select" && (
                <div className="space-y-1.5">
                  {opts.map((o) => {
                    const arr = (Array.isArray(v) ? v : []) as string[];
                    const checked = arr.includes(o);
                    return (
                      <label key={o} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) => {
                            const next = c ? [...arr, o] : arr.filter((x) => x !== o);
                            set(next);
                          }}
                        />
                        {o}
                      </label>
                    );
                  })}
                </div>
              )}
              {f.field_type === "file" && (
                <div className="space-y-1">
                  <Input
                    type="file"
                    required={f.required && !v}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return set(null);
                      if (file.size > 20 * 1024 * 1024) {
                        toast.error("Arquivo maior que 20MB");
                        e.target.value = "";
                        return;
                      }
                      const safe = file.name.replace(/[^\w.\-]+/g, "_");
                      const path = `${form.user_id}/${form.id}/${crypto.randomUUID()}-${safe}`;
                      const { error } = await supabase.storage
                        .from("form-uploads")
                        .upload(path, file, { upsert: false, contentType: file.type });
                      if (error) {
                        toast.error("Falha no upload: " + error.message);
                        return;
                      }
                      set({ path, name: file.name, size: file.size });
                    }}
                  />
                  {v && typeof v === "object" && "name" in (v as object) && (
                    <p className="text-xs text-muted-foreground truncate">
                      ✓ {(v as { name: string }).name}
                    </p>
                  )}
                </div>
              )}
              {f.field_type === "state_city" && (
                <StateCityField
                  value={v as { uf?: string; cidade?: string } | undefined}
                  onChange={(val) => set(val)}
                  required={f.required}
                />
              )}
              {f.field_type === "partner_group" && (
                <PartnerGroupField
                  value={(Array.isArray(v) ? v : []) as never}
                  onChange={(val) => set(val)}
                />
              )}
            </div>
          );
        })}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Enviando…" : "Enviar"}
        </Button>
      </form>
    </div>
  );
};

export default PublicForm;
