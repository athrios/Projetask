import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export interface AddressValue {
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

const cache: Record<string, ViaCep> = {};

interface ViaCep {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

const maskCep = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export const AddressField = ({
  value,
  onChange,
  required,
}: {
  value: AddressValue | undefined;
  onChange: (v: AddressValue) => void;
  required?: boolean;
}) => {
  const v: AddressValue = value ?? {};
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetched = useRef<string>("");

  const set = (patch: Partial<AddressValue>) => onChange({ ...v, ...patch });

  const lookup = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    if (lastFetched.current === digits) return;
    lastFetched.current = digits;

    if (cache[digits]) {
      const c = cache[digits];
      if (c.erro) {
        setError("CEP não encontrado. Verifique e tente novamente.");
        return;
      }
      setError(null);
      onChange({
        ...v,
        cep: maskCep(digits),
        logradouro: c.logradouro ?? "",
        bairro: c.bairro ?? "",
        cidade: c.localidade ?? "",
        uf: c.uf ?? "",
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await r.json()) as ViaCep;
      cache[digits] = data;
      if (data.erro) {
        setError("CEP não encontrado. Verifique e tente novamente.");
        return;
      }
      onChange({
        ...v,
        cep: maskCep(digits),
        logradouro: data.logradouro ?? "",
        bairro: data.bairro ?? "",
        cidade: data.localidade ?? "",
        uf: data.uf ?? "",
      });
    } catch {
      setError("Não foi possível consultar o CEP agora.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (v.cep && (v.cep.replace(/\D/g, "").length === 8) && !v.logradouro && !v.cidade) {
      lookup(v.cep);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filled = !!(v.logradouro || v.cidade || v.uf);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
        <div className="relative">
          <Input
            inputMode="numeric"
            placeholder="CEP (00000-000)"
            value={v.cep ?? ""}
            onChange={(e) => {
              const masked = maskCep(e.target.value);
              set({ cep: masked });
              if (masked.replace(/\D/g, "").length < 8) {
                setError(null);
                lastFetched.current = "";
              }
            }}
            onBlur={(e) => lookup(e.target.value)}
            required={required}
            maxLength={9}
          />
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          )}
        </div>
        <a
          href="https://buscacepinter.correios.com.br/app/endereco/index.php"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground self-center underline-offset-2 hover:underline"
        >
          Não sei meu CEP
        </a>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {filled && (
        <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
          {v.logradouro && <div>{v.logradouro}</div>}
          {(v.bairro || v.cidade || v.uf) && (
            <div>
              {[v.bairro, [v.cidade, v.uf].filter(Boolean).join("/")]
                .filter(Boolean)
                .join(" — ")}
            </div>
          )}
        </div>
      )}

      {/* Allow manual fill when ViaCEP returns blank logradouro (rural / generic CEP) */}
      {v.cep && v.cep.replace(/\D/g, "").length === 8 && !v.logradouro && !error && !loading && (
        <Input
          placeholder="Logradouro"
          value={v.logradouro ?? ""}
          onChange={(e) => set({ logradouro: e.target.value })}
          required={required}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
        <Input
          placeholder="Número"
          value={v.numero ?? ""}
          onChange={(e) => set({ numero: e.target.value })}
          required={required}
          maxLength={20}
        />
        <Input
          placeholder="Complemento (opcional)"
          value={v.complemento ?? ""}
          onChange={(e) => set({ complemento: e.target.value })}
          maxLength={120}
        />
      </div>
    </div>
  );
};
