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
import { Plus, Trash2, Link as LinkIcon, FileText, Copy, Workflow, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { logActivity } from "@/lib/activityLog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { TEMPLATE_COLORS, colorPill, colorLeftBorder, asColor } from "@/components/processes/templateColors";
import { cn } from "@/lib/utils";
import { buildAppUrl } from "@/lib/appUrl";
import type { FieldCondition, ConditionOperator } from "@/lib/formConditions";

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
  title: string;
  description: string;
  public_slug: string;
  is_published: boolean;
  color: string;
  auto_create_process: boolean;
  linked_process_template_id: string | null;
  logo_path: string | null;
  logo_alignment: "left" | "center" | "right";
  submitter_name_label: string | null;
}
interface ProcessTemplate { id: string; name: string }

interface Field {
  id: string;
  form_id: string;
  position: number;
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string[] | unknown;
  description: string;
  add_button_label: string | null;
  conditional_logic: FieldCondition | null;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "short_text", label: "Texto curto" },
  { value: "long_text", label: "Texto longo" },
  { value: "select", label: "Seleção" },
  { value: "multi_select", label: "Múltipla escolha" },
  { value: "date", label: "Data" },
  { value: "file", label: "Arquivo / Anexo" },
  { value: "state_city", label: "Estado + Cidade" },
  { value: "address", label: "Endereço (CEP)" },
  { value: "partner_group", label: "Grupo de sócios" },
  { value: "cnpj", label: "CNPJ (consulta informativa)" },
];

interface Props { userId: string }

export const FormsPanel = ({ userId }: Props) => {
  const { workspaceId } = useWorkspace();
  const [forms, setForms] = useState<Form[]>([]);
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Form | null>(null);
  const [newTitle, setNewTitle] = useState("");


  const load = async () => {
    if (!workspaceId) return;
    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    const list = (data ?? []) as Form[];
    setForms(list);
    const { data: tpls } = await supabase
      .from("process_templates")
      .select("id,name")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });
    setTemplates((tpls ?? []) as ProcessTemplate[]);
    if (list.length) {

      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async (f) => {
          const { count } = await supabase
            .from("form_responses")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("form_id", f.id);
          counts[f.id] = count ?? 0;
        }),
      );
      setResponseCounts(counts);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workspaceId]);

  const create = async () => {
    const t = newTitle.trim();
    if (!t || !workspaceId) return;
    const { data, error } = await supabase
      .from("forms")
      .insert({ title: t, user_id: userId, workspace_id: workspaceId })
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
    const url = buildAppUrl(`/f/${slug}`);
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
          {forms.map((f) => {
            const c = asColor(f.color);
            return (
            <div key={f.id} className={cn("rounded-xl border-l-4 border bg-card p-4 group hover:shadow-sm transition", colorLeftBorder[c])}>
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => setEditing(f)} className="text-left flex-1 min-w-0 flex items-start gap-2">
                  {f.logo_path && (
                    <img
                      src={supabase.storage.from("form-logos").getPublicUrl(f.logo_path).data.publicUrl}
                      alt=""
                      className="h-8 w-8 object-contain rounded shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <span className={cn("inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border mb-1.5", colorPill[c])}>
                      {f.title}
                    </span>
                    {f.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{f.description}</p>
                    )}
                  </div>
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
              {f.auto_create_process && f.linked_process_template_id && (
                <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Workflow className="h-3 w-3" />
                  <span>Modelo vinculado:</span>
                  <span className="font-medium text-foreground truncate">
                    {templates.find((t) => t.id === f.linked_process_template_id)?.name ?? "—"}
                  </span>
                </div>
              )}
              {f.is_published && (
                <button
                  onClick={() => copyLink(f.public_slug)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs h-8 rounded-md border hover:bg-muted/40"
                >
                  <Copy className="h-3 w-3" /> Copiar link público
                </button>
              )}

            </div>
            );
          })}
        </div>
      )}

      {editing && (
        <FormBuilder
          form={editing}
          userId={userId}
          templates={templates}
          onClose={() => { setEditing(null); load(); }}
        />
      )}

    </div>
  );
};

const FormBuilder = ({
  form,
  userId,
  templates,
  onClose,
}: {
  form: Form;
  userId: string;
  templates: ProcessTemplate[];
  onClose: () => void;
}) => {
  const { workspaceId } = useWorkspace();
  const [title, setTitle] = useState(form.title);
  const [desc, setDesc] = useState(form.description);
  const [submitterNameLabel, setSubmitterNameLabel] = useState(form.submitter_name_label ?? "Seu nome");
  const [color, setColor] = useState(asColor(form.color));
  const [autoCreate, setAutoCreate] = useState(form.auto_create_process);
  const [linkedTpl, setLinkedTpl] = useState<string | null>(form.linked_process_template_id);
  const [logoPath, setLogoPath] = useState<string | null>(form.logo_path);
  const [logoAlign, setLogoAlign] = useState<"left" | "center" | "right">(form.logo_alignment ?? "center");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [fields, setFields] = useState<Field[]>([]);

  const logoUrl = logoPath
    ? supabase.storage.from("form-logos").getPublicUrl(logoPath).data.publicUrl
    : null;

  const load = async () => {
    const { data } = await supabase
      .from("form_fields")
      .select("*")
      .eq("form_id", form.id)
      .order("position", { ascending: true });
    setFields(((data ?? []) as unknown as Field[]));
  };
  useEffect(() => { load(); }, [form.id]);

  const saveMeta = async () => {
    const label = submitterNameLabel.trim().slice(0, 60) || "Seu nome";
    await supabase.from("forms").update({ title, description: desc, color, submitter_name_label: label }).eq("id", form.id);
  };

  const updateColor = async (c: ReturnType<typeof asColor>) => {
    setColor(c);
    await supabase.from("forms").update({ color: c }).eq("id", form.id);
  };

  const toggleAuto = async (v: boolean) => {
    setAutoCreate(v);
    const patch: { auto_create_process: boolean; linked_process_template_id?: string | null } = { auto_create_process: v };
    if (!v) { patch.linked_process_template_id = null; setLinkedTpl(null); }
    await supabase.from("forms").update(patch).eq("id", form.id);
  };

  const setTemplate = async (id: string) => {
    setLinkedTpl(id);
    await supabase.from("forms").update({ linked_process_template_id: id }).eq("id", form.id);
  };

  const onLogoFile = async (file: File | null) => {
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      return toast.error("Use PNG, JPG ou WEBP.");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("Logo deve ter no máximo 5 MB.");
    }
    setUploadingLogo(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${userId}/${form.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("form-logos")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      setUploadingLogo(false);
      return toast.error("Falha no upload: " + error.message);
    }
    const old = logoPath;
    await supabase.from("forms").update({ logo_path: path }).eq("id", form.id);
    setLogoPath(path);
    if (old) {
      await supabase.storage.from("form-logos").remove([old]);
    }
    setUploadingLogo(false);
    toast.success("Logo atualizado");
  };

  const removeLogo = async () => {
    if (!logoPath) return;
    const old = logoPath;
    await supabase.from("forms").update({ logo_path: null }).eq("id", form.id);
    setLogoPath(null);
    await supabase.storage.from("form-logos").remove([old]);
    toast.success("Logo removido");
  };

  const updateAlign = async (v: "left" | "center" | "right") => {
    setLogoAlign(v);
    await supabase.from("forms").update({ logo_alignment: v }).eq("id", form.id);
  };



  const addField = async (type: FieldType) => {
    if (!workspaceId) return;
    await supabase.from("form_fields").insert({
      form_id: form.id, user_id: userId, workspace_id: workspaceId, label: "Novo campo",
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({ ...f, position: i }));

    // Detect conditions that now reference a field positioned at/after the dependent
    let brokenCount = 0;
    const cleaned = reordered.map((f, selfIdx) => {
      const cond = f.conditional_logic;
      if (!cond) return f;
      const srcIdx = reordered.findIndex((x) => x.id === cond.field_id);
      if (srcIdx === -1) return f;
      if (srcIdx >= selfIdx) {
        brokenCount += 1;
        return { ...f, conditional_logic: null };
      }
      return f;
    });

    setFields(cleaned);

    try {
      await Promise.all(
        cleaned.map((f, i) => {
          const original = fields.find((x) => x.id === f.id);
          const positionChanged = !original || original.position !== i;
          const conditionCleared = original?.conditional_logic && !f.conditional_logic;
          if (!positionChanged && !conditionCleared) return Promise.resolve();
          const patch: Record<string, unknown> = { position: i };
          if (conditionCleared) patch.conditional_logic = null;
          return supabase.from("form_fields").update(patch as never).eq("id", f.id);
        }),
      );
      if (brokenCount > 0) {
        toast.warning(`${brokenCount} condição(ões) removida(s) porque a pergunta de origem ficou abaixo.`);
      }
    } catch {
      toast.error("Não foi possível salvar a nova ordem");
      load();
    }
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
            <label className="text-xs font-medium">Rótulo do campo "Seu nome"</label>
            <Input
              value={submitterNameLabel}
              onChange={(e) => setSubmitterNameLabel(e.target.value)}
              onBlur={saveMeta}
              placeholder="Seu nome"
              maxLength={60}
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">Texto exibido acima do campo de identificação no formulário público.</p>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Cor</label>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => updateColor(c.key)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition",
                    c.swatch,
                    color === c.key ? "border-foreground scale-110" : "border-transparent hover:scale-105",
                  )}
                  title={c.label}
                />
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
            <p className="text-sm font-medium">Identidade visual</p>
            <p className="text-xs text-muted-foreground">Logo aparece no topo do formulário público. PNG, JPG ou WEBP, até 5 MB.</p>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-16 max-w-[160px] object-contain rounded border bg-background p-1" />
              ) : (
                <div className="h-16 w-16 rounded border border-dashed grid place-items-center text-[10px] text-muted-foreground">sem logo</div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border cursor-pointer hover:bg-muted/40">
                  <Plus className="h-3.5 w-3.5" />
                  {uploadingLogo ? "Enviando..." : (logoPath ? "Trocar logo" : "Enviar logo")}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => { onLogoFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
                  />
                </label>
                {logoPath && (
                  <button type="button" onClick={removeLogo} className="text-xs text-destructive hover:underline w-fit">
                    Remover logo
                  </button>
                )}
              </div>
            </div>
            {logoPath && (
              <div>
                <label className="text-xs font-medium block mb-1">Alinhamento</label>
                <Select value={logoAlign} onValueChange={(v) => updateAlign(v as "left" | "center" | "right")}>
                  <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left" className="text-xs">Esquerda</SelectItem>
                    <SelectItem value="center" className="text-xs">Centro</SelectItem>
                    <SelectItem value="right" className="text-xs">Direita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Criar processo automaticamente</p>
                <p className="text-xs text-muted-foreground">
                  Quando este formulário for respondido, um processo será criado automaticamente usando o modelo selecionado.
                </p>
              </div>
              <Switch checked={autoCreate} onCheckedChange={toggleAuto} />
            </div>
            {autoCreate && (
              <div>
                <label className="text-xs font-medium block mb-1">Modelo de processo vinculado</label>
                <Select value={linkedTpl ?? ""} onValueChange={setTemplate}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione um modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum modelo neste ambiente.</div>
                    ) : templates.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-sm">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div>

            <h4 className="text-sm font-semibold mb-2">Campos</h4>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map((f) => (
                    <SortableFieldCard
                      key={f.id}
                      field={f}
                      allFields={fields}
                      onLabelChangeLocal={(v) =>
                        setFields((p) => p.map((x) => (x.id === f.id ? { ...x, label: v } : x)))
                      }
                      onUpdate={(patch) => updateField(f.id, patch)}
                      onRemove={() => removeField(f.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
                {buildAppUrl(`/f/${form.public_slug}`)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(buildAppUrl(`/f/${form.public_slug}`));
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

const SortableFieldCard = ({
  field: f,
  allFields,
  onLabelChangeLocal,
  onUpdate,
  onRemove,
}: {
  field: Field;
  allFields: Field[];
  onLabelChangeLocal: (v: string) => void;
  onUpdate: (patch: Partial<Field>) => void;
  onRemove: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-card p-3 space-y-2 group">
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Reordenar pergunta"
          className="p-1 -ml-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          value={f.label}
          onChange={(e) => onLabelChangeLocal(e.target.value)}
          onBlur={(e) => onUpdate({ label: e.target.value })}
          className="h-8 text-sm flex-1"
        />
        <Select value={f.field_type} onValueChange={(v) => onUpdate({ field_type: v as FieldType })}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={onRemove}
          className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit select-none">
        <Switch checked={f.required} onCheckedChange={(v) => onUpdate({ required: v })} />
        <span>Resposta obrigatória</span>
      </label>
      <Textarea
        defaultValue={f.description ?? ""}
        placeholder="Descrição / instruções (opcional) — aparece abaixo da pergunta no formulário público"
        className="text-xs min-h-[50px]"
        maxLength={500}
        onBlur={(e) => onUpdate({ description: e.target.value.trim() } as Partial<Field>)}
      />
      {(f.field_type === "select" || f.field_type === "multi_select") && (
        <Textarea
          defaultValue={Array.isArray(f.options) ? (f.options as string[]).join("\n") : ""}
          placeholder="Uma opção por linha"
          className="text-xs min-h-[60px]"
          onBlur={(e) => onUpdate({
            options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) as never,
          })}
        />
      )}
      {f.field_type === "partner_group" && (
        <Input
          defaultValue={f.add_button_label ?? ""}
          placeholder='Rótulo do botão (padrão: "Adicionar sócio")'
          className="text-xs h-8"
          maxLength={60}
          onBlur={(e) => onUpdate({ add_button_label: e.target.value.trim() || null } as Partial<Field>)}
        />
      )}
      {f.field_type === "cnpj" && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
          <div className="text-xs font-medium text-foreground">Consulta informativa de CNPJ</div>
          <p className="text-[11px] text-muted-foreground">
            Quando o respondente digitar um CNPJ válido, os dados públicos serão exibidos como referência abaixo do campo. Nenhuma outra pergunta do formulário é preenchida automaticamente.
          </p>
        </div>
      )}

      <ConditionEditor
        field={f}
        allFields={allFields}
        onChange={(cond) => onUpdate({ conditional_logic: cond } as Partial<Field>)}
      />
    </div>
  );
};

const ELIGIBLE_SOURCE_TYPES: FieldType[] = [
  "short_text",
  "long_text",
  "select",
  "multi_select",
];

const ConditionEditor = ({
  field,
  allFields,
  onChange,
}: {
  field: Field;
  allFields: Field[];
  onChange: (cond: FieldCondition | null) => void;
}) => {
  const cond = field.conditional_logic;
  const [open, setOpen] = useState(!!cond);
  const sources = allFields.filter(
    (x) => x.position < field.position && ELIGIBLE_SOURCE_TYPES.includes(x.field_type),
  );
  const source = cond ? allFields.find((x) => x.id === cond.field_id) : null;
  const sourceOpts =
    source && (source.field_type === "select" || source.field_type === "multi_select")
      ? ((Array.isArray(source.options) ? source.options : []) as string[])
      : [];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline w-fit"
      >
        + Mostrar somente se…
      </button>
    );
  }

  if (sources.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground border rounded-md p-2 bg-muted/30">
        Adicione uma pergunta anterior do tipo texto ou seleção para criar uma condição.
        <button
          type="button"
          onClick={() => { setOpen(false); if (cond) onChange(null); }}
          className="ml-2 underline hover:text-foreground"
        >
          fechar
        </button>
      </div>
    );
  }

  const update = (patch: Partial<FieldCondition>) => {
    const base: FieldCondition = cond ?? {
      field_id: sources[0].id,
      operator: sources[0].field_type === "multi_select" ? "contains" : "equals",
      value: "",
    };
    const next = { ...base, ...patch };
    if (patch.field_id) {
      // reset value/operator when source changes to keep a valid combo
      next.value = "";
      const s = allFields.find((x) => x.id === patch.field_id);
      next.operator = s?.field_type === "multi_select" ? "contains" : "equals";
    }
    onChange(next);
  };

  const isMulti = source?.field_type === "multi_select";

  return (
    <div className="rounded-md border bg-muted/20 p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Mostrar somente se…
        </span>
        <button
          type="button"
          onClick={() => { setOpen(false); onChange(null); }}
          className="text-[11px] text-destructive hover:underline"
        >
          Remover condição
        </button>
      </div>
      <div className={`grid grid-cols-1 ${isMulti ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-2`}>
        <Select
          value={cond?.field_id ?? ""}
          onValueChange={(v) => update({ field_id: v })}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pergunta…" /></SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.label || "(sem rótulo)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isMulti && (
          <Select
            value={cond?.operator ?? "equals"}
            onValueChange={(v) => update({ operator: v as ConditionOperator })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="equals" className="text-xs">é igual a</SelectItem>
              <SelectItem value="not_equals" className="text-xs">é diferente de</SelectItem>
            </SelectContent>
          </Select>
        )}
        {sourceOpts.length > 0 ? (
          <Select
            value={cond?.value ?? ""}
            onValueChange={(v) =>
              update(isMulti ? { value: v, operator: "contains" as ConditionOperator } : { value: v })
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={isMulti ? "Aparece quando marcar…" : "Valor…"} />
            </SelectTrigger>
            <SelectContent>
              {sourceOpts.map((o) => (
                <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={cond?.value ?? ""}
            onChange={(e) => update({ value: e.target.value })}
            placeholder="Valor"
            className="h-8 text-xs"
          />
        )}
      </div>
      {isMulti && (
        <p className="text-[10px] text-muted-foreground">
          A pergunta aparece somente quando a opção acima estiver marcada na pergunta de origem.
        </p>
      )}
    </div>
  );
};

