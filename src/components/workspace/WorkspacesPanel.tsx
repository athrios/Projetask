import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace, MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { TEMPLATE_COLORS, asColor, type TemplateColor } from "@/components/processes/templateColors";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Send, Share2 } from "lucide-react";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import { buildAppUrl } from "@/lib/appUrl";

type Member = { id: string; user_id: string; role: string };
type Perm = {
  id?: string;
  module: ModuleKey;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};
type Invite = { id: string; email: string; created_at: string; accepted_at: string | null };

const ACTIONS: Array<{ key: keyof Omit<Perm, "module" | "id">; label: string }> = [
  { key: "can_view", label: "Ver" },
  { key: "can_create", label: "Criar" },
  { key: "can_edit", label: "Editar" },
  { key: "can_delete", label: "Excluir" },
];

export const WorkspacesPanel = () => {
  const { user } = useAuth();
  const { workspaces, reload, workspaceId } = useWorkspace();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(workspaceId);

  useEffect(() => {
    if (!selectedId && workspaces.length) setSelectedId(workspaces[0].id);
  }, [workspaces, selectedId]);

  const ownedOnly = workspaces.filter((w) => w.owner_id === user?.id);
  const selected = ownedOnly.find((w) => w.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Ambientes de trabalho</h3>
          <p className="text-xs text-muted-foreground">
            Gerencie seus ambientes, membros e permissões.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo ambiente
        </Button>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-4">
        <aside className="rounded-xl border bg-card p-2 space-y-0.5">
          {ownedOnly.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedId(w.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm",
                selectedId === w.id ? "bg-secondary" : "hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0",
                  TEMPLATE_COLORS.find((c) => c.key === asColor(w.color))?.swatch,
                )}
              />
              <span className="truncate">{w.name}</span>
            </button>
          ))}
          {ownedOnly.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Você ainda não é dono de nenhum ambiente.
            </p>
          )}
        </aside>

        <div>
          {selected ? (
            <WorkspaceDetail workspace={selected} reload={reload} />
          ) : (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              Selecione um ambiente.
            </div>
          )}
        </div>
      </div>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

const WorkspaceDetail = ({
  workspace,
  reload,
}: {
  workspace: { id: string; name: string; color: string; owner_id: string; shared_modules: string[] };
  reload: () => Promise<void>;
}) => {
  const [name, setName] = useState(workspace.name);
  const [color, setColor] = useState<TemplateColor>(asColor(workspace.color));

  useEffect(() => {
    setName(workspace.name);
    setColor(asColor(workspace.color));
  }, [workspace.id]);

  const saveMeta = async () => {
    const { error } = await supabase
      .from("workspaces")
      .update({ name: name.trim() || "Ambiente", color })
      .eq("id", workspace.id);
    if (error) return toast.error(error.message);
    await reload();
  };

  const archive = async () => {
    if (!confirm("Arquivar este ambiente? Ele ficará oculto da lista.")) return;
    const { error } = await supabase
      .from("workspaces")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", workspace.id);
    if (error) return toast.error(error.message);
    toast.success("Ambiente arquivado");
    await reload();
  };

  const remove = async () => {
    if (!confirm("Excluir DEFINITIVAMENTE este ambiente e TODOS os seus dados? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("workspaces").delete().eq("id", workspace.id);
    if (error) return toast.error(error.message);
    toast.success("Ambiente excluído");
    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="text-xs font-medium">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveMeta} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Cor</label>
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => { setColor(c.key); supabase.from("workspaces").update({ color: c.key }).eq("id", workspace.id).then(() => reload()); }}
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition",
                    c.swatch,
                    color === c.key ? "border-foreground" : "border-transparent hover:scale-105",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={archive}>Arquivar</Button>
          <Button size="sm" variant="ghost" onClick={remove} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Membros</TabsTrigger>
          <TabsTrigger value="invites">Convites</TabsTrigger>
          <TabsTrigger value="sharing">Compartilhamento</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <MembersTab workspaceId={workspace.id} ownerId={workspace.owner_id} />
        </TabsContent>
        <TabsContent value="invites">
          <InvitesTab workspaceId={workspace.id} workspaceName={workspace.name} />
        </TabsContent>
        <TabsContent value="sharing">
          <SharingTab workspaceId={workspace.id} initialModules={workspace.shared_modules} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SHAREABLE_MODULES: Array<{ key: string; label: string; description: string }> = [
  {
    key: "clientes",
    label: "Clientes",
    description: "A lista de clientes deste ambiente fica visível (somente leitura) em todos os seus outros ambientes.",
  },
];

const SharingTab = ({
  workspaceId,
  initialModules,
}: {
  workspaceId: string;
  initialModules: string[];
}) => {
  const [modules, setModules] = useState<string[]>(initialModules);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setModules(initialModules);
  }, [workspaceId]);

  const toggle = async (key: string) => {
    const next = modules.includes(key)
      ? modules.filter((m) => m !== key)
      : [...modules, key];
    setModules(next);
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ shared_modules: next } as never)
      .eq("id", workspaceId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      setModules(modules); // rollback
    }
  };

  return (
    <div className="space-y-3 mt-3">
      <div className="rounded-xl border bg-card p-4 space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Módulos compartilhados</p>
          {saving && <span className="text-xs text-muted-foreground ml-auto">Salvando…</span>}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Módulos marcados como compartilhados terão seus dados exibidos (somente leitura, com etiqueta do ambiente) em todos os seus outros ambientes.
        </p>
        {SHAREABLE_MODULES.map((mod) => (
          <label
            key={mod.key}
            className="flex items-start gap-3 py-2 cursor-pointer group"
          >
            <Checkbox
              checked={modules.includes(mod.key)}
              onCheckedChange={() => toggle(mod.key)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium group-hover:text-foreground">{mod.label}</p>
              <p className="text-xs text-muted-foreground">{mod.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};


const MembersTab = ({ workspaceId, ownerId }: { workspaceId: string; ownerId: string }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [perms, setPerms] = useState<Record<string, Perm[]>>({});

  const load = async () => {
    const { data: m } = await supabase
      .from("workspace_members")
      .select("id,user_id,role")
      .eq("workspace_id", workspaceId);
    setMembers((m ?? []) as Member[]);
    const { data: p } = await supabase
      .from("workspace_permissions")
      .select("id,user_id,module,can_view,can_create,can_edit,can_delete")
      .eq("workspace_id", workspaceId);
    const grouped: Record<string, Perm[]> = {};
    (p ?? []).forEach((row: any) => {
      (grouped[row.user_id] ||= []).push(row);
    });
    setPerms(grouped);
  };
  useEffect(() => { load(); }, [workspaceId]);

  const togglePerm = async (userId: string, module: ModuleKey, key: keyof Omit<Perm, "module" | "id">, value: boolean) => {
    const existing = (perms[userId] ?? []).find((p) => p.module === module);
    if (existing?.id) {
      const patch: Record<string, boolean> = { [key]: value };
      await supabase
        .from("workspace_permissions")
        .update(patch as never)
        .eq("id", existing.id);
    } else {
      const base: Perm = {
        module,
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
      };
      (base as any)[key] = value;
      await supabase.from("workspace_permissions").insert({
        workspace_id: workspaceId,
        user_id: userId,
        module,
        can_view: base.can_view,
        can_create: base.can_create,
        can_edit: base.can_edit,
        can_delete: base.can_delete,
      });
    }
    load();
  };

  const removeMember = async (id: string) => {
    if (!confirm("Remover este membro?")) return;
    await supabase.from("workspace_members").delete().eq("id", id);
    load();
  };

  const nonOwners = members.filter((m) => m.user_id !== ownerId);

  return (
    <div className="space-y-3 mt-3">
      {nonOwners.length === 0 && (
        <p className="text-xs text-muted-foreground rounded-xl border bg-card p-4">
          Nenhum membro adicional. Use a aba <strong>Convites</strong> para adicionar pessoas.
        </p>
      )}
      {nonOwners.map((m) => {
        const userPerms = perms[m.user_id] ?? [];
        const get = (mod: ModuleKey, key: keyof Omit<Perm, "module" | "id">) =>
          (userPerms.find((p) => p.module === mod) as any)?.[key] ?? false;
        return (
          <div key={m.id} className="rounded-xl border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium font-mono">{m.user_id.slice(0, 8)}…</p>
              <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left font-normal py-1">Módulo</th>
                    {ACTIONS.map((a) => (
                      <th key={a.key} className="font-normal py-1 px-1 text-center">{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULE_KEYS.map((mod) => (
                    <tr key={mod} className="border-t">
                      <td className="py-1.5">{MODULE_LABELS[mod]}</td>
                      {ACTIONS.map((a) => (
                        <td key={a.key} className="text-center">
                          <Checkbox
                            checked={get(mod, a.key)}
                            onCheckedChange={(v) => togglePerm(m.user_id, mod, a.key, !!v)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const InvitesTab = ({ workspaceId, workspaceName }: { workspaceId: string; workspaceName: string }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("workspace_invitations")
      .select("id,email,created_at,accepted_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    setInvites((data ?? []) as Invite[]);
  };
  useEffect(() => { load(); }, [workspaceId]);

  const create = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !user) return toast.error("Informe um e-mail");
    setSending(true);
    const { data: inserted, error } = await supabase
      .from("workspace_invitations")
      .insert({
        workspace_id: workspaceId,
        email: e,
        invited_by: user.id,
        permissions: {},
      })
      .select("id")
      .single();
    if (error || !inserted) {
      setSending(false);
      return toast.error(error?.message ?? "Erro ao criar convite");
    }

    const inviterName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email ||
      "Alguém";
    const acceptUrl = buildAppUrl(`/convite/${inserted.id}`);

    const { error: mailError } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "workspace-invite",
        recipientEmail: e,
        idempotencyKey: `workspace-invite-${inserted.id}`,
        templateData: { inviterName, workspaceName, acceptUrl },
      },
    });

    setSending(false);
    setEmail("");
    if (mailError) {
      toast.warning("Convite criado, mas o e-mail falhou. Você pode compartilhar o link manualmente.");
    } else {
      toast.success("Convite enviado por e-mail");
    }
    load();
  };

  const [resendingId, setResendingId] = useState<string | null>(null);

  const resend = async (invite: Invite) => {
    if (!user) return;
    setResendingId(invite.id);
    const inviterName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email ||
      "Alguém";
    const acceptUrl = buildAppUrl(`/convite/${invite.id}`);
    const { error: mailError } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "workspace-invite",
        recipientEmail: invite.email,
        idempotencyKey: `workspace-invite-${invite.id}-resend-${Date.now()}`,
        templateData: { inviterName, workspaceName, acceptUrl },
      },
    });
    setResendingId(null);
    if (mailError) toast.error("Falha ao reenviar o convite");
    else toast.success("Convite reenviado por e-mail");
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(buildAppUrl(`/convite/${id}`));
    toast.success("Link copiado");
  };

  const remove = async (id: string) => {
    await supabase.from("workspace_invitations").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-3 mt-3">
      <div className="rounded-xl border bg-card p-3">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com"
            disabled={sending}
          />
          <Button size="sm" type="submit" disabled={sending}>
            <Plus className="h-4 w-4" /> {sending ? "Enviando…" : "Convidar"}
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground mt-2">
          Um e-mail com o link de aceitação será enviado para o endereço informado.
        </p>
      </div>
      <div className="rounded-xl border bg-card divide-y">
        {invites.length === 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground">Nenhum convite ainda.</p>
        )}
        {invites.map((i) => (
          <div key={i.id} className="px-4 py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{i.email}</p>
              <p className="text-[11px] text-muted-foreground">
                {i.accepted_at ? `Aceito em ${new Date(i.accepted_at).toLocaleDateString("pt-BR")}` : "Pendente"} ·{" "}
                {new Date(i.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>
            {!i.accepted_at && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => resend(i)}
                disabled={resendingId === i.id}
                title="Reenviar convite"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => copyLink(i.id)} title="Copiar link">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove(i.id)} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
