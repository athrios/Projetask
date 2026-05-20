import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Invite = {
  id: string;
  email: string;
  workspace_id: string;
  accepted_at: string | null;
  permissions: Record<string, unknown>;
};

export default function AcceptInvite() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "not_found" | "wrong_email" | "already" | "done">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!id) return setStatus("not_found");

    (async () => {
      const { data, error } = await supabase
        .from("workspace_invitations")
        .select("id,email,workspace_id,accepted_at,permissions")
        .eq("id", id)
        .maybeSingle();

      if (error || !data) return setStatus("not_found");
      const userEmail = (user.email ?? "").toLowerCase();
      if (data.email.toLowerCase() !== userEmail) return setStatus("wrong_email");

      setInvite(data as Invite);
      if (data.accepted_at) {
        setStatus("already");
      } else {
        setStatus("ready");
      }

      const { data: ws } = await supabase
        .from("workspaces")
        .select("name")
        .eq("id", data.workspace_id)
        .maybeSingle();
      setWorkspaceName(ws?.name ?? "");
    })();
  }, [id, user, loading]);

  if (loading) {
    return <CenterCard>Carregando…</CenterCard>;
  }
  if (!user) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(`/convite/${id ?? ""}`)}`} replace />;
  }

  const accept = async () => {
    if (!invite || !user) return;
    setBusy(true);
    const { error: updErr } = await supabase
      .from("workspace_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    if (updErr) {
      setBusy(false);
      return toast.error(updErr.message);
    }
    const { error: memErr } = await supabase
      .from("workspace_members")
      .insert({
        workspace_id: invite.workspace_id,
        user_id: user.id,
        role: "member",
      });
    setBusy(false);
    if (memErr && !memErr.message.includes("duplicate")) {
      return toast.error(memErr.message);
    }
    setStatus("done");
    toast.success("Convite aceito!");
    setTimeout(() => navigate("/"), 1200);
  };

  return (
    <CenterCard>
      <h1 className="text-xl font-semibold text-foreground">Convite para workspace</h1>
      <div className="mt-4 text-sm text-muted-foreground">
        {status === "loading" && "Carregando convite…"}
        {status === "not_found" && "Convite não encontrado ou removido."}
        {status === "wrong_email" && (
          <>
            Este convite foi enviado para <strong>{invite?.email}</strong>, mas você
            está logado(a) com outra conta. Saia e entre com o e-mail correto.
          </>
        )}
        {status === "already" && (
          <>Você já aceitou este convite{workspaceName ? ` para ${workspaceName}` : ""}.</>
        )}
        {status === "ready" && (
          <>
            Você foi convidado(a) para o workspace{" "}
            <strong>{workspaceName || "—"}</strong>. Confirme abaixo para entrar.
          </>
        )}
        {status === "done" && "Tudo certo! Redirecionando…"}
      </div>
      {status === "ready" && (
        <Button className="mt-6 w-full" onClick={accept} disabled={busy}>
          {busy ? "Aceitando…" : "Aceitar convite"}
        </Button>
      )}
      {(status === "already" || status === "done") && (
        <Button className="mt-6 w-full" variant="secondary" onClick={() => navigate("/")}>
          Ir para o app
        </Button>
      )}
    </CenterCard>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm text-center">
        {children}
      </div>
    </main>
  );
}
