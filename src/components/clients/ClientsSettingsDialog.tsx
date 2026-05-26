import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_FIELD_ORDER,
  STANDARD_FIELD_LABELS,
  type ClientSettings,
  type ExtraFieldDef,
  type ExtraFieldType,
} from "@/hooks/useClientSettings";

const TYPE_LABEL: Record<ExtraFieldType, string> = {
  text: "Texto curto",
  long_text: "Texto longo",
  number: "Número",
  date: "Data",
};

const labelFor = (key: string, extras: ExtraFieldDef[]) => {
  if (key.startsWith("extra:")) {
    const id = key.slice("extra:".length);
    const ex = extras.find((e) => e.id === id);
    return ex ? `${ex.label || "Campo extra sem nome"} (extra)` : "Campo extra removido";
  }
  return STANDARD_FIELD_LABELS[key as keyof typeof STANDARD_FIELD_LABELS] ?? key;
};

const buildFullOrder = (current: string[], extras: ExtraFieldDef[]): string[] => {
  const all = [...DEFAULT_FIELD_ORDER, ...extras.map((e) => `extra:${e.id}`)];
  const out: string[] = [];
  for (const k of current) {
    if (all.includes(k) && !out.includes(k)) out.push(k);
  }
  for (const k of all) {
    if (!out.includes(k)) out.push(k);
  }
  return out;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial: ClientSettings;
  onSave: (s: ClientSettings) => Promise<void>;
}

export const ClientsSettingsDialog = ({ open, onOpenChange, initial, onSave }: Props) => {
  const [draft, setDraft] = useState<ClientSettings>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  const fullOrder = buildFullOrder(draft.field_order, draft.extra_fields);
  const hidden = new Set(draft.hidden_fields);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...fullOrder];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setDraft({ ...draft, field_order: next });
  };

  const toggleHidden = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft({ ...draft, hidden_fields: Array.from(next) });
  };

  const addExtra = () => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const ex: ExtraFieldDef = { id, label: "", type: "text", required: false };
    setDraft({ ...draft, extra_fields: [...draft.extra_fields, ex] });
  };

  const updateExtra = (id: string, patch: Partial<ExtraFieldDef>) => {
    setDraft({
      ...draft,
      extra_fields: draft.extra_fields.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const removeExtra = (id: string) => {
    setDraft({
      ...draft,
      extra_fields: draft.extra_fields.filter((e) => e.id !== id),
      field_order: draft.field_order.filter((k) => k !== `extra:${id}`),
      hidden_fields: draft.hidden_fields.filter((k) => k !== `extra:${id}`),
    });
  };

  const handleSave = async () => {
    for (const e of draft.extra_fields) {
      if (!e.label.trim()) {
        toast.error("Todos os Campos Extras precisam de um rótulo.");
        return;
      }
    }
    setSaving(true);
    try {
      const normalized: ClientSettings = {
        ...draft,
        field_order: buildFullOrder(draft.field_order, draft.extra_fields),
      };
      await onSave(normalized);
      toast.success("Configurações salvas");
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações de Clientes</DialogTitle>
          <DialogDescription>
            Personalize a ordem e visibilidade dos campos exibidos e crie Campos Extras aplicados a todos os clientes deste ambiente.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Ordem e visibilidade dos campos</h3>
            <p className="text-xs text-muted-foreground">
              Use as setas para reorganizar. Campos ocultos não aparecem nos cards, mas os dados continuam preservados.
            </p>
          </div>
          <ul className="rounded-md border divide-y">
            {fullOrder.map((key, idx) => {
              const isHidden = hidden.has(key);
              return (
                <li key={key} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(idx, 1)}
                      disabled={idx === fullOrder.length - 1}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
                      aria-label="Mover para baixo"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>
                  <span className={isHidden ? "text-sm text-muted-foreground line-through flex-1" : "text-sm flex-1"}>
                    {labelFor(key, draft.extra_fields)}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleHidden(key)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    title={isHidden ? "Mostrar" : "Ocultar"}
                  >
                    {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Campos Extras</h3>
              <p className="text-xs text-muted-foreground">
                Campos fixos que aparecem em todos os clientes deste ambiente.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addExtra} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          {draft.extra_fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum Campo Extra configurado.</p>
          ) : (
            <ul className="space-y-2">
              {draft.extra_fields.map((ex) => (
                <li key={ex.id} className="rounded-md border p-3 space-y-2 bg-card">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Rótulo</Label>
                      <Input
                        value={ex.label}
                        maxLength={80}
                        placeholder="Ex.: Origem do cliente"
                        onChange={(e) => updateExtra(ex.id, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={ex.type}
                        onValueChange={(v) => updateExtra(ex.id, { type: v as ExtraFieldType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TYPE_LABEL) as ExtraFieldType[]).map((t) => (
                            <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExtra(ex.id)}
                      className="p-2 rounded hover:bg-muted text-muted-foreground"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={ex.required}
                      onCheckedChange={(v) => updateExtra(ex.id, { required: v })}
                    />
                    Obrigatório
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
