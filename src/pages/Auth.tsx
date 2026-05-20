import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const AuthPage = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/";
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) nav(redirect, { replace: true });
  }, [user, nav, redirect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}${redirect}` },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email se necessário.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      {/* Decoração de fundo sutil */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 40% at 50% 0%, hsl(96 24% 27% / 0.06) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-md relative">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-5 rounded-sm bg-[hsl(42,42%,50%)] opacity-85" />
            <span className="text-lg font-semibold tracking-widest uppercase text-foreground">
              Projetask
            </span>
          </div>
          <div className="w-16 h-[1px] mx-auto bg-gradient-to-r from-transparent via-[hsl(42,42%,50%)] to-transparent opacity-60" />
        </div>

        {/* Card principal */}
        <div
          className="bg-card rounded-xl shadow-sm overflow-hidden"
          style={{
            border: "1px solid hsl(34 16% 82%)",
            boxShadow:
              "0 1px 3px hsl(28 18% 16% / 0.06), 0 4px 16px hsl(28 18% 16% / 0.05)",
          }}
        >
          {/* Linha dourada no topo do card */}
          <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[hsl(42,42%,50%)] to-transparent opacity-70" />

          <div className="p-8">
            <h1 className="text-xl font-semibold tracking-tight mb-1 text-foreground">
              {mode === "login" ? "Bem-vindo de volta" : "Criar conta"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {mode === "login"
                ? "Entre para organizar suas tarefas e cronograma."
                : "Cadastre-se e comece a organizar seu dia."}
            </p>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/60 focus-visible:ring-[hsl(96,24%,27%)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw" className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
                  Senha
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

              <Button
                type="submit"
                className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium tracking-wide"
                disabled={busy}
              >
                {busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
              </Button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground/60">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-[hsl(96,24%,27%)] transition-colors duration-200"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login"
                ? "Não tem conta? Cadastre-se"
                : "Já tem conta? Entrar"}
            </button>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/50 mt-6">
          Organize. Planeje. Execute.
        </p>
      </div>
    </main>
  );
};

export default AuthPage;
