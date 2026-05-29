import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users, Plus, Search, Trash2, Pencil, Settings, Upload, Eye, EyeOff } from "lucide-react";
import { CopyButton } from "@/components/shared/CopyButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClientForm, type ClientRecord, type CustomField } from "./ClientForm";
import { maskCpf, maskCnpj } from "@/lib/documents";
import {
  useClientSettings,
  resolveFieldOrder,
  STANDARD_FIELD_LABELS,
  type ExtraFieldDef,
} from "@/hooks/useClientSettings";
import { ClientsSettingsDialog } from "./ClientsSettingsDialog";
import { ImportClientsDialog } from "./ImportClientsDialog";
import { Checkbox } from "@/components/ui/checkbox";

const TYPE_LABEL: Record<ClientRecord["client_type"], string> = {
  pessoa_fisica: "PF",
  pessoa_juridica: "PJ",
  estrangeiro: "Estrangeiro",
};


const lsGet = <T,>(k: string, f: T): T => {
  try { return JSON.parse(localStorage.getItem(k) || "null") ?? f; } catch { return f; }
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start gap-2 text-xs">
    <span className="text-muted-foreground w-20 shrink-1 pt-0.5">{label}</span>
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <span className="text-foreground break-words">{value}</span>
      <CopyButton
        getText={() => value}
        getCleanText={() => value.replace(/[^a-zA-Z0-9]/g, "")}
      />
    </div>
  </div>
);

const formatAddress = (a: ClientRecord["address"]): string => {
  if (!a) return "";
  const street = [a.logradouro, a.numero].filter(Boolean).join(", ");
  const withCompl = [street, a.complemento].filter(Boolean).join(" - ");
  const cityUf = [a.cidade, a.uf].filter(Boolean).join("/");
  const tail = [a.bairro, cityUf].filter(Boolean).join(", ");
  const cep = a.cep ? ` – CEP ${a.cep}` : "";
  const pais = a.pais ? `, ${a.pais}` : "";
  const result = [withCompl, tail].filter(Boolean).join(", ") + cep + pais;
  return result.trim();
};

const getStandardValue = (r: ClientRecord, key: string): string => {
  switch (key) {
    case "document":
      if (!r.document) return "";
      return r.client_type === "pessoa_juridica"
        ? maskCnpj(r.document)
        : r.client_type === "pessoa_fisica"
          ? maskCpf(r.document)
          : r.document;
    case "trade_name": return r.trade_name || "";
    case "email": return r.email || "";
    case "phone": return r.phone || "";
    case "address": return formatAddress(r.address);
    case "notes": return r.notes || "";
    default: return "";
  }
};

const getExtraValue = (r: ClientRecord, extraId: string): string => {
  const found = (r.custom_fields ?? []).find(
    (c) => c.source === "extra" && c.extra_id === extraId,
  );
  return found?.value ?? "";
};

export const ClientsPanel = ({ userId }: { userId: string }) => {
  const { workspaceId, workspaces, can } = useWorkspace();
  const { settings, save: saveSettings, reload: reloadSettings } = useClientSettings(workspaceId);
  const [rows, setRows] = useState<(ClientRecord & { _workspace_name?: string; _workspace_color?: string })[]>([]);
  const [hiddenSources, setHiddenSources] = useState<string[]>(() =>
    lsGet<string[]>(`clientsHiddenSources_${workspaceId ?? ""}`, []),
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() =>
    lsGet<string>(`clientsSearch_${workspaceId ?? ""}`, ""),
  );
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<ClientRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const canCreate = can("clientes", "create");
  const canEdit = can("clientes", "edit");
  const canDelete = can("clientes", "delete");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);

    // Load clients from ALL workspaces the user belongs to in one query
    const allIds = workspaces.map((w) => w.id);
    if (allIds.length === 0) { setRows([]); setLoading(false); return; }

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .in("workspace_id", allIds)
      .order("name", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar clientes");
      setLoading(false);
      return;
    }

    const wsMap = Object.fromEntries(
      workspaces.map((w) => [w.id, { name: w.name, color: w.color }]),
    );

    const all = ((data ?? []) as unknown as ClientRecord[]).map((c) => ({
      ...c,
      _workspace_name: c.workspace_id !== workspaceId
        ? (wsMap[c.workspace_id]?.name ?? "Outro ambiente")
        : undefined,
      _workspace_color: wsMap[c.workspace_id]?.color ?? "gray",
    }));

    setRows(all);
    setLoading(false);
  }, [workspaceId, workspaces]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setHiddenSources(lsGet<string[]>(`clientsHiddenSources_${workspaceId ?? ""}`, []));
    setSearch(lsGet<string>(`clientsSearch_${workspaceId ?? ""}`, ""));
  }, [workspaceId]);

  useEffect(() => {
    localStorage.setItem(`clientsHiddenSources_${workspaceId ?? ""}`, JSON.stringify(hiddenSources));
  }, [hiddenSources, workspaceId]);

  useEffect(() => {
    localStorage.setItem(`clientsSearch_${workspaceId ?? ""}`, JSON.stringify(search));
  }, [search, workspaceId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (hiddenSources.includes(r.workspace_id ?? "")) return false;
      if (!q) return true;
      return [r.name, r.trade_name, r.email, r.document]
        .filter(Boolean)
        .some((x) => x!.toLowerCase().includes(q));
    });
  }, [rows, search, hiddenSources]);

  const orderedKeys = useMemo(() => resolveFieldOrder(settings), [settings]);

  const handleDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("clients").delete().eq("id", toDelete.id);
    if (error) {
      toast.error("Erro ao excluir cliente");
    } else {
      toast.success("Cliente excluído");
      setRows((r) => r.filter((x) => x.id !== toDelete.id));
    }
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, documento ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Source workspace filter */}
          {workspaces.length > 1 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Filtrar por ambiente"
                  aria-label="Filtrar por ambiente"
                  className={cn(hiddenSources.length > 0 && "text-foreground")}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Ambientes visíveis
                </p>
                <p className="text-xs text-muted-foreground">
                  Clientes de todos os seus ambientes aparecem aqui. Oculte os que não quer ver.
                </p>
                <div className="space-y-1 pt-1">
                  {workspaces.map((w) => {
                    const hidden = hiddenSources.includes(w.id);
                    return (
                      <label key={w.id} className="flex items-center gap-2 text-xs cursor-pointer py-1">
                        <Checkbox
                          checked={!hidden}
                          onCheckedChange={() =>
                            setHiddenSources((cur) =>
                              cur.includes(w.id)
                                ? cur.filter((x) => x !== w.id)
                                : [...cur, w.id],
                            )
                          }
                          className="h-3.5 w-3.5"
                        />
                        <span className="flex items-center gap-1.5 flex-1">
                          <span className={cn(
                            "h-2 w-2 rounded-full shrink-0",
                            w.id === workspaceId ? "bg-primary" : "bg-muted-foreground/50",
                          )} />
                          <span className={cn("truncate", hidden && "line-through text-muted-foreground")}>
                            {w.name}
                          </span>
                          {w.id === workspaceId && (
                            <span className="text-[10px] text-muted-foreground ml-auto">(atual)</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {hiddenSources.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => setHiddenSources([])}
                  >
                    <Eye className="h-3 w-3" /> Mostrar todos
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              title="Configurações de Clientes"
              aria-label="Configurações de Clientes"
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {canCreate && (
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" /> Importar
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setCreating(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo cliente
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-10 text-center">Carregando…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={
            search
              ? "Ajuste sua busca ou cadastre um novo cliente."
              : "Cadastre seus clientes para mantê-los organizados neste ambiente."
          }
          action={
            canCreate && !search ? (
              <Button onClick={() => setCreating(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo cliente
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const knownExtraIds = new Set(settings.extra_fields.map((e) => e.id));
            const orphanCustoms: CustomField[] = (r.custom_fields ?? []).filter((c) => {
              if (!c) return false;
              if (c.source === "extra") {
                return !c.extra_id || !knownExtraIds.has(c.extra_id);
              }
              if (c.source === "qsa") return false;
              return c.label || c.value;
            });
            const qsaEntry = (r.custom_fields ?? []).find((c) => c?.source === "qsa");
            const qsaCount = Array.isArray(qsaEntry?.data) ? (qsaEntry!.data as unknown[]).length : 0;
            return (
              <div
                key={r.id}
                className="spotlight rounded-lg border bg-card px-4 py-3 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{r.name || "—"}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {TYPE_LABEL[r.client_type]}
                      </Badge>
                      {r._workspace_name && (
                        <Badge variant="outline" className="text-[10px] gap-1.5 font-normal">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                          {r._workspace_name}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {orderedKeys.map(({ key, isExtra, extraId }) => {
                        if (isExtra && extraId) {
                          const def = settings.extra_fields.find((e) => e.id === extraId);
                          if (!def) return null;
                          const v = getExtraValue(r, extraId);
                          if (!v) return null;
                          return <Field key={key} label={def.label || "Extra"} value={v} />;
                        }
                        const v = getStandardValue(r, key);
                        if (!v) return null;
                        const label =
                          key === "document"
                            ? r.client_type === "pessoa_juridica"
                              ? "CNPJ"
                              : r.client_type === "pessoa_fisica"
                                ? "CPF"
                                : "Documento"
                            : STANDARD_FIELD_LABELS[key as keyof typeof STANDARD_FIELD_LABELS] ?? key;
                        return <Field key={key} label={label} value={v} />;
                      })}
                      {orphanCustoms.map((c, i) => (
                        <Field
                          key={`orphan-${i}`}
                          label={c.label || `Campo ${i + 1}`}
                          value={c.value || ""}
                        />
                      ))}
                      {qsaCount > 0 && (
                        <Field label="Sócios / QSA" value={`${qsaCount} sócio(s)`} />
                      )}
                      {r.created_at && (
                        <p className="text-[10px] text-muted-foreground pt-1">
                          Cadastrado em{" "}
                          {new Date(r.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>

                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && !r._workspace_name && (
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                        title="Editar"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && !r._workspace_name && (
                      <button
                        type="button"
                        onClick={() => setToDelete(r)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                        title="Excluir"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Editar cliente" : "Novo cliente"}</SheetTitle>
          </SheetHeader>
          {(creating || editing) && workspaceId && (
            <ClientForm
              workspaceId={workspaceId}
              userId={userId}
              initial={editing ?? undefined}
              onSaved={(saved) => {
                setRows((prev) => {
                  const ix = prev.findIndex((x) => x.id === saved.id);
                  if (ix >= 0) {
                    const next = [...prev];
                    next[ix] = saved;
                    return next.sort((a, b) => a.name.localeCompare(b.name));
                  }
                  return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
                });
                setCreating(false);
                setEditing(null);
              }}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Os dados e anexos vinculados a{" "}
              <strong>{toDelete?.name}</strong> serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {workspaceId && (
        <>
          <ClientsSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            initial={settings}
            onSave={async (next) => {
              const { error } = await saveSettings(next, userId);
              if (error) throw error;
              await reloadSettings();
            }}
          />
          <ImportClientsDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            workspaceId={workspaceId}
            userId={userId}
            extraFields={settings.extra_fields as ExtraFieldDef[]}
            onCreateExtra={async (label) => {
              const novo: ExtraFieldDef = {
                id: crypto.randomUUID(),
                label: label.trim(),
                type: "text",
                required: false,
              };
              const next = {
                ...settings,
                extra_fields: [...settings.extra_fields, novo],
              };
              const { error } = await saveSettings(next, userId);
              if (error) throw error;
              await reloadSettings();
              return novo;
            }}
            onImported={() => {
              setImportOpen(false);
              load();
            }}
          />
        </>
      )}
    </div>
  );
};
