import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type State = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return setState("invalid");
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: ANON },
        });
        const data = await res.json();
        if (res.ok && data.valid) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    setSubmitting(false);
    if (error) return setState("error");
    if (data?.success) setState("success");
    else if (data?.reason === "already_unsubscribed") setState("already");
    else setState("error");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-foreground">Cancelar inscrição</h1>
        <div className="mt-4 text-sm text-muted-foreground">
          {state === "loading" && "Verificando link…"}
          {state === "valid" && "Confirme abaixo para deixar de receber e-mails desta lista."}
          {state === "already" && "Este e-mail já foi removido da nossa lista."}
          {state === "invalid" && "Link inválido ou expirado."}
          {state === "success" && "Pronto! Você não receberá mais estes e-mails."}
          {state === "error" && "Algo deu errado. Tente novamente em instantes."}
        </div>
        {state === "valid" && (
          <Button className="mt-6 w-full" onClick={confirm} disabled={submitting}>
            {submitting ? "Confirmando…" : "Confirmar cancelamento"}
          </Button>
        )}
      </div>
    </main>
  );
}
