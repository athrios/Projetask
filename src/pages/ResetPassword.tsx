import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z
  .object({
    password: z.string().min(6, "Mínimo 6 caracteres").max(72),
    confirm: z.string().min(6).max(72),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não coincidem",
  });

const ResetPassword = () => {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase coloca os tokens no hash quando o usuário chega via link de recovery.
    // O onAuthStateChange dispara PASSWORD_RECOVERY criando uma sessão temporária.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValid(true);
      }
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setValid(true);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      await supabase.auth.signOut();
      toast.success("Senha atualizada. Faça login com a nova senha.");
      nav("/auth", { replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao atualizar senha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 40% at 50% 0%, hsl(96 24% 27% / 0.06) 0%, transparent 70%)",
        }}
      />
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-2">
            <img src="/ambitask-logo.png" alt="Ambitask" className="h-14 w-auto object-contain" />
          </div>
          <div className="w-16 h-[1px] mx-auto bg-gradient-to-r from-transparent via-[hsl(42,42%,50%)] to-transparent opacity-60" />
        </div>

        <div
          className="bg-card rounded-xl shadow-sm overflow-hidden"
          style={{
            border: "1px solid hsl(34 16% 82%)",
            boxShadow:
              "0 1px 3px hsl(28 18% 16% / 0.06), 0 4px 16px hsl(28 18% 16% / 0.05)",
          }}
        >
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(42,42%,50%)] to-transparent opacity-70" />
          <div className="p-8">
            <h1 className="text-xl font-semibold tracking-tight mb-1 text-foreground">
              Definir nova senha
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Escolha uma senha de pelo menos 6 caracteres.
            </p>

            {!ready ? (
              <p className="text-sm text-muted-foreground">Validando link...</p>
            ) : !valid ? (
              <div className="space-y-4">
                <p className="text-sm text-destructive">
                  Link inválido ou expirado. Solicite um novo email de recuperação.
                </p>
                <Button
                  type="button"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => nav("/auth", { replace: true })}
                >
                  Voltar para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pw" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                    Nova senha
                  </Label>
                  <Input
                    id="pw"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background/60 focus-visible:ring-[hsl(96,24%,27%)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw2" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                    Confirmar nova senha
                  </Label>
                  <Input
                    id="pw2"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    className="bg-background/60 focus-visible:ring-[hsl(96,24%,27%)]"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium tracking-wide"
                  disabled={busy}
                >
                  {busy ? "Aguarde..." : "Atualizar senha"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default ResetPassword;
