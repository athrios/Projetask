import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type ModuleKey =
  | "hoje"
  | "clientes"
  | "cronograma"
  | "tarefas"
  | "processos"
  | "formularios"
  | "solicitacoes"
  | "concluidas";

export const MODULE_KEYS: ModuleKey[] = [
  "hoje",
  "clientes",
  "cronograma",
  "tarefas",
  "processos",
  "formularios",
  "solicitacoes",
  "concluidas",
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  hoje: "Hoje",
  clientes: "Clientes",
  cronograma: "Cronograma",
  tarefas: "Tarefas",
  processos: "Processos",
  formularios: "Formulários",
  solicitacoes: "Respostas",
  concluidas: "Concluídas",
};

export interface Workspace {
  id: string;
  name: string;
  color: string;
  owner_id: string;
}

export interface Permission {
  module: ModuleKey;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

type Action = "view" | "create" | "edit" | "delete";

interface WorkspaceCtx {
  loading: boolean;
  workspaces: Workspace[];
  workspaceId: string | null;
  workspace: Workspace | null;
  isOwner: boolean;
  isOwnerOfAny: boolean;
  setWorkspaceId: (id: string) => void;
  permissions: Permission[];
  can: (module: ModuleKey, action: Action) => boolean;
  canViewModule: (module: ModuleKey) => boolean;
  reload: () => Promise<void>;
}

const LS_KEY = "activeWorkspaceId";

const Ctx = createContext<WorkspaceCtx>({
  loading: true,
  workspaces: [],
  workspaceId: null,
  workspace: null,
  isOwner: false,
  isOwnerOfAny: false,
  setWorkspaceId: () => {},
  permissions: [],
  can: () => false,
  canViewModule: () => false,
  reload: async () => {},
});

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);

  const setWorkspaceId = (id: string) => {
    localStorage.setItem(LS_KEY, id);
    setWorkspaceIdState(id);
  };

  const loadWorkspaces = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Get memberships → workspace list
    const { data: memberships } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, workspaces(id, name, color, owner_id, archived_at)")
      .order("created_at", { ascending: true });

    let list: Workspace[] = ((memberships ?? [])
      .map((m: any) => m.workspaces)
      .filter((w: any) => w && !w.archived_at) as Workspace[]);

    // Auto-create default workspace if user has none
    if (list.length === 0) {
      const { data: created } = await supabase
        .from("workspaces")
        .insert({ owner_id: user.id, name: "Meu ambiente", color: "blue" })
        .select("id, name, color, owner_id")
        .single();
      if (created) list = [created as Workspace];
    }

    setWorkspaces(list);

    // Resolve active id
    const stored = localStorage.getItem(LS_KEY);
    const active = stored && list.find((w) => w.id === stored)
      ? stored
      : list[0]?.id ?? null;
    if (active) {
      localStorage.setItem(LS_KEY, active);
      setWorkspaceIdState(active);
    } else {
      setWorkspaceIdState(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setWorkspaces([]);
      setWorkspaceIdState(null);
      setLoading(false);
      return;
    }
    loadWorkspaces();
  }, [user, authLoading, loadWorkspaces]);

  // Load permissions for active workspace
  useEffect(() => {
    if (!workspaceId || !user) {
      setPermissions([]);
      return;
    }
    const ws = workspaces.find((w) => w.id === workspaceId);
    const isOwner = ws?.owner_id === user.id;
    if (isOwner) {
      // Owner: full access to all modules
      setPermissions(
        MODULE_KEYS.map((m) => ({
          module: m,
          can_view: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
        })),
      );
      return;
    }
    supabase
      .from("workspace_permissions")
      .select("module, can_view, can_create, can_edit, can_delete")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .then(({ data }) => {
        setPermissions((data ?? []) as Permission[]);
      });
  }, [workspaceId, user, workspaces]);

  const workspace = workspaces.find((w) => w.id === workspaceId) ?? null;
  const isOwner = !!(workspace && user && workspace.owner_id === user.id);
  const isOwnerOfAny = !!user && workspaces.some((w) => w.owner_id === user.id);

  const can = (module: ModuleKey, action: Action) => {
    if (isOwner) return true;
    const p = permissions.find((x) => x.module === module);
    if (!p) return false;
    return action === "view" ? p.can_view
      : action === "create" ? p.can_create
      : action === "edit" ? p.can_edit
      : p.can_delete;
  };
  const canViewModule = (m: ModuleKey) => can(m, "view");

  return (
    <Ctx.Provider
      value={{
        loading: loading || authLoading,
        workspaces,
        workspaceId,
        workspace,
        isOwner,
        isOwnerOfAny,
        setWorkspaceId,
        permissions,
        can,
        canViewModule,
        reload: loadWorkspaces,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useWorkspace = () => useContext(Ctx);
