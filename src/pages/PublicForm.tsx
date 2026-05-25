import { useEffect, useMemo, useState } from "react";
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
import { CheckCircle2, Loader2, Building2, Sparkles, MapPin, Activity, ListChecks } from "lucide-react";
import { submitterNameSchema, publicTextAnswerSchema } from "@/lib/validation";
import { StateCityField } from "@/components/forms/fields/StateCityField";
import { PartnerGroupField } from "@/components/forms/fields/PartnerGroupField";
import { AddressField, type AddressValue } from "@/components/forms/fields/AddressField";
import { parseCondition, evaluateCondition, type FieldCondition } from "@/lib/formConditions";

type FieldType =
  | "short_text"
  | "long_text"
  | "select"
  | "multi_select"
  | "date"
  | "file"
  | "state_city"
  | "partner_group"
  | "address"
  | "cnpj";


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
  conditional_logic: FieldCondition | null;
}

function maskCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  const p1 = d.slice(0, 2);
  const p2 = d.slice(2, 5);
  const p3 = d.slice(5, 8);
  const p4 = d.slice(8, 12);
  const p5 = d.slice(12, 14);
  let out = p1;
  if (d.length > 2) out += "." + p2;
  if (d.length > 5) out += "." + p3;
  if (d.length > 8) out += "/" + p4;
  if (d.length > 12) out += "-" + p5;
  return out;
}

function maskCep(v: string): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function getCnpjAutofillMap(options: unknown): Record<string, string> {
  if (options && typeof options === "object" && !Array.isArray(options)) {
    const a = (options as { autofill?: unknown }).autofill;
    if (a && typeof a === "object" && !Array.isArray(a)) {
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(a as Record<string, unknown>)) {
        if (typeof val === "string" && val.trim()) out[k] = val;
      }
      return out;
    }
  }
  return {};
}

type CnpjLookupData = {
  cnpj: string;
  company_name: string | null;
  trade_name: string | null;
  status: string | null;
  address: { street: string | null; number: string | null; complement: string | null; neighborhood: string | null };
  city: string | null;
  state: string | null;
  zip_code: string | null;
  main_cnae: { code: string | null; description: string | null } | null;
  secondary_cnaes: Array<{ code: string | null; description: string | null }>;
  phone: string | null;
  email: string | null;
};



const PublicForm = () => {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState<Record<string, boolean>>({});
  const [cnpjError, setCnpjError] = useState<Record<string, boolean>>({});


  useEffect(() => {
    document.title = "Formulário";
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("forms_public" as never)
        .select("id,user_id,workspace_id,title,description,is_published,logo_path,logo_alignment,submitter_name_label")
        .eq("public_slug", slug)
        .maybeSingle();
      if (!data) { setLoading(false); return; }
      setForm(data as Form);
      const { data: fs } = await supabase
        .from("form_fields_public" as never)
        .select("id,form_id,label,field_type,required,options,position,description,add_button_label,conditional_logic")
        .eq("form_id", (data as Form).id)
        .order("position", { ascending: true });
      const parsed = ((fs ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
        ...row,
        conditional_logic: parseCondition(row.conditional_logic),
      })) as unknown as Field[];
      setFields(parsed);
      setLoading(false);
    })();
  }, [slug]);

  const visibility = useMemo(() => {
    const labelById: Record<string, string> = {};
    fields.forEach((f) => { labelById[f.id] = f.label; });
    // Iterate in position order so a dependent field can read the visibility
    // of fields declared before it. Single-pass is enough because conditions
    // can only reference earlier fields (enforced in the editor).
    const visibleById: Record<string, boolean> = {};
    for (const f of fields) {
      if (!f.conditional_logic) { visibleById[f.id] = true; continue; }
      visibleById[f.id] = evaluateCondition(f.conditional_logic, {
        labelById,
        visibleById,
        answers: values,
      });
    }
    return visibleById;
  }, [fields, values]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const nameParsed = submitterNameSchema.safeParse(name);
    if (!nameParsed.success) return toast.error(nameParsed.error.issues[0]?.message ?? "Nome inválido");
    const cleanValues: Record<string, unknown> = {};
    for (const f of fields) {
      if (!visibility[f.id]) continue; // skip hidden fields entirely
      const v = values[f.label];
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (f.required && empty) {
        return toast.error(`Preencha "${f.label}"`);
      }
      if (f.field_type === "address" && f.required) {
        const a = (v ?? {}) as AddressValue;
        if (!a.cep || a.cep.replace(/\D/g, "").length !== 8 || !a.numero?.trim() || !a.logradouro?.trim()) {
          return toast.error(`Preencha o endereço em "${f.label}" (CEP e número)`);
        }
      }
      if (typeof v === "string") {
        const r = publicTextAnswerSchema.safeParse(v);
        if (!r.success) return toast.error(`${f.label}: ${r.error.issues[0]?.message ?? "inválido"}`);
        cleanValues[f.label] = r.data;
      } else if (Array.isArray(v)) {
        if (v.length > 50) return toast.error(`${f.label}: máximo 50 itens`);
        cleanValues[f.label] = v.slice(0, 50);
      } else if (v !== undefined) {
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

  const runCnpjLookup = async (field: Field, rawDigits: string) => {
    if (rawDigits.length !== 14) return;
    setCnpjLoading((p) => ({ ...p, [field.id]: true }));
    setCnpjError((p) => ({ ...p, [field.id]: false }));
    try {
      const { data: res, error } = await supabase.functions.invoke("lookup-cnpj", {
        body: { cnpj: rawDigits },
      });
      if (error || !res || (res as { error?: string }).error) {
        setCnpjError((p) => ({ ...p, [field.id]: true }));
        return;
      }
      const data = (res as { data: CnpjLookupData }).data;
      const map = getCnpjAutofillMap(field.options);
      const updates: Record<string, unknown> = {};
      const targetField = (label: string) => fields.find((x) => x.label === label);

      const writeText = (label: string, value: string | null) => {
        if (value === null || value === undefined) return;
        const tf = targetField(label);
        if (!tf) return;
        updates[label] = String(value);
      };

      for (const [key, label] of Object.entries(map)) {
        const tf = targetField(label);
        if (!tf) continue;
        switch (key) {
          case "company_name": writeText(label, data.company_name); break;
          case "trade_name": writeText(label, data.trade_name); break;
          case "status": writeText(label, data.status); break;
          case "phone": writeText(label, data.phone); break;
          case "email": writeText(label, data.email); break;
          case "zip_code": writeText(label, data.zip_code ? maskCep(data.zip_code) : null); break;
          case "main_cnae":
            if (data.main_cnae) {
              const parts = [data.main_cnae.code, data.main_cnae.description].filter(Boolean);
              writeText(label, parts.join(" - "));
            }
            break;
          case "secondary_cnaes": {
            const txt = (data.secondary_cnaes || [])
              .map((c) => [c.code, c.description].filter(Boolean).join(" - "))
              .filter(Boolean)
              .join("; ");
            if (txt) writeText(label, txt);
            break;
          }
          case "address":
            if (tf.field_type === "address") {
              const existing = (values[label] ?? {}) as AddressValue;
              updates[label] = {
                ...existing,
                cep: data.zip_code ? maskCep(data.zip_code) : existing.cep ?? "",
                logradouro: data.address.street ?? existing.logradouro ?? "",
                numero: data.address.number ?? existing.numero ?? "",
                complemento: data.address.complement ?? existing.complemento ?? "",
                bairro: data.address.neighborhood ?? existing.bairro ?? "",
                cidade: data.city ?? existing.cidade ?? "",
                uf: data.state ?? existing.uf ?? "",
              } as AddressValue;
            } else {
              const parts = [
                data.address.street,
                data.address.number,
                data.address.complement,
                data.address.neighborhood,
              ].filter(Boolean);
              writeText(label, parts.join(", "));
            }
            break;
          case "city":
            if (tf.field_type === "state_city") {
              const existing = (values[label] ?? {}) as { uf?: string; cidade?: string };
              updates[label] = { ...existing, cidade: data.city ?? "" };
            } else writeText(label, data.city);
            break;
          case "state":
            if (tf.field_type === "state_city") {
              const existing = (values[label] ?? {}) as { uf?: string; cidade?: string };
              updates[label] = { ...existing, uf: data.state ?? "" };
            } else writeText(label, data.state);
            break;
        }
      }
      if (Object.keys(updates).length) setValues((p) => ({ ...p, ...updates }));
    } catch {
      setCnpjError((p) => ({ ...p, [field.id]: true }));
    } finally {
      setCnpjLoading((p) => ({ ...p, [field.id]: false }));
    }
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
          <label className="text-xs font-medium">{form.submitter_name_label?.trim() || "Seu nome"}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        {fields.map((f) => {
          if (!visibility[f.id]) return null;
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
                  addButtonLabel={f.add_button_label?.trim() || undefined}
                />
              )}
              {f.field_type === "address" && (
                <AddressField
                  value={v as AddressValue | undefined}
                  onChange={(val) => set(val)}
                  required={f.required}
                />
              )}
              {f.field_type === "cnpj" && (
                <div className="space-y-1">
                  <div className="relative">
                    <Input
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      value={maskCnpj((v as string) ?? "")}
                      maxLength={18}
                      onChange={(e) => {
                        set(maskCnpj(e.target.value));
                        if (cnpjError[f.id]) setCnpjError((p) => ({ ...p, [f.id]: false }));
                      }}
                      onBlur={(e) => {
                        const digits = e.target.value.replace(/\D/g, "");
                        if (digits.length === 14) runCnpjLookup(f, digits);
                      }}
                      required={f.required}
                    />
                    {cnpjLoading[f.id] && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Consultando…
                      </span>
                    )}
                  </div>
                  {cnpjError[f.id] && !cnpjLoading[f.id] && (
                    <p className="text-[11px] text-muted-foreground">
                      Não foi possível consultar este CNPJ. Você pode preencher os campos manualmente.
                    </p>
                  )}
                </div>
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
