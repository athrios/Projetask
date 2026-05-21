import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface StateCityValue {
  uf?: string;
  cidade?: string;
}

interface UF {
  id: number;
  sigla: string;
  nome: string;
}
interface City {
  id: number;
  nome: string;
}

let ufCache: UF[] | null = null;
const cityCache: Record<string, City[]> = {};

export const StateCityField = ({
  value,
  onChange,
  required,
}: {
  value: StateCityValue | undefined;
  onChange: (v: StateCityValue) => void;
  required?: boolean;
}) => {
  const [ufs, setUfs] = useState<UF[]>(ufCache ?? []);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    if (ufCache) return;
    (async () => {
      try {
        const r = await fetch(
          "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome",
        );
        const data = (await r.json()) as UF[];
        ufCache = data;
        setUfs(data);
      } catch {
        /* offline; user can type later */
      }
    })();
  }, []);

  useEffect(() => {
    const uf = value?.uf;
    if (!uf) {
      setCities([]);
      return;
    }
    if (cityCache[uf]) {
      setCities(cityCache[uf]);
      return;
    }
    setLoadingCities(true);
    (async () => {
      try {
        const r = await fetch(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
        );
        const data = (await r.json()) as City[];
        cityCache[uf] = data;
        setCities(data);
      } catch {
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    })();
  }, [value?.uf]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
      <Select
        value={value?.uf ?? ""}
        onValueChange={(v) => onChange({ uf: v, cidade: "" })}
      >
        <SelectTrigger>
          <SelectValue placeholder="UF" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {ufs.map((u) => (
            <SelectItem key={u.sigla} value={u.sigla}>
              {u.sigla} — {u.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={value?.cidade ?? ""}
        onValueChange={(v) => onChange({ uf: value?.uf, cidade: v })}
        disabled={!value?.uf || loadingCities}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              !value?.uf
                ? "Selecione a UF primeiro"
                : loadingCities
                  ? "Carregando..."
                  : "Cidade"
            }
          />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {cities.map((c) => (
            <SelectItem key={c.id} value={c.nome}>
              {c.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {required && (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={value?.uf && value?.cidade ? "ok" : ""}
          onChange={() => {}}
          className="sr-only"
        />
      )}
    </div>
  );
};
