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
import { EmptyState } from "@/components/shared/EmptyState";
import { Users, Plus, Search, Mail, Phone, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ClientForm, type ClientRecord } from "./ClientForm";
import { maskCpf, maskCnpj } from "@/lib/documents";

const TYPE_LABEL: Record<ClientRecord["client_type"], string> = {
  pessoa_fisica: "PF",
  pessoa_juridica: "PJ",
  estrangeiro: "Estrangeiro",
};

export const ClientsPanel = ({ userId }: { userId: string }) => {
  const { workspaceId, can } = useWorkspace();
  const [rows, setRows] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<ClientRecord | null>(null);

  const canCreate = can("clientes", "create");
  const canEdit = can("clientes", "edit");
  const canDelete = can("clientes", "delete");

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar clientes");
    } else {
      setRows((data ?? []) as unknown as ClientRecord[]);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.trade_name, r.email, r.document]
        .filter(Boolean)
        .some((x) => x.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const formatDoc = (r: ClientRecord) =>
    r.client_type === "pessoa_juridica"
      ? maskCnpj(r.document)
      : r.client_type === "pessoa_fisica"
        ? maskCpf(r.document)
        : r.document;

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
        {canCreate && (
          <Button onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        )}
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
        <div className="rounded-lg border bg-card divide-y">
          {filtered.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => canEdit && setEditing(r)}
              className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{r.name || "—"}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {TYPE_LABEL[r.client_type]}
                  </Badge>
                  {r.trade_name && (
                    <span className="text-xs text-muted-foreground truncate">
                      ({r.trade_name})
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                  {r.document && <span>{formatDoc(r)}</span>}
                  {r.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {r.email}
                    </span>
                  )}
                  {r.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {r.phone}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(r);
                    }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </span>
                )}
                {canDelete && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setToDelete(r);
                    }}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </button>
          ))}
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
    </div>
  );
};
