import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { StateCityField, StateCityValue } from "./StateCityField";
import { AddressField, type AddressValue } from "./AddressField";

export interface Partner {
  nome?: string;
  nacionalidade?: string;
  naturalidade?: StateCityValue;
  profissao?: string;
  estado_civil?: string;
  regime_bens?: string;
  endereco?: AddressValue;
  etnia?: string;
  participacao?: string;
}

const ESTADO_CIVIL = [
  "SOLTEIRO(A)",
  "CASADO(A)",
  "UNIÃO ESTÁVEL",
  "DIVORCIADO(A)",
  "VIÚVO(A)",
  "SEPARADO JUDICIALMENTE",
];
const REGIME_BENS = [
  "COMUNHÃO PARCIAL",
  "COMUNHÃO UNIVERSAL",
  "SEPARAÇÃO TOTAL",
  "PARTICIPAÇÃO FINAL NOS AQUESTOS",
];
const ETNIA = ["Branca", "Preta", "Parda", "Amarela", "Indígena"];

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

export const PartnerGroupField = ({
  value,
  onChange,
  addButtonLabel,
}: {
  value: Partner[] | undefined;
  onChange: (v: Partner[]) => void;
  addButtonLabel?: string;
}) => {
  const partners = Array.isArray(value) ? value : [];
  const buttonLabel = addButtonLabel?.trim() || "Adicionar sócio";
  const update = (i: number, patch: Partial<Partner>) => {
    const next = partners.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    onChange(next);
  };
  const add = () => onChange([...partners, {}]);
  const remove = (i: number) => onChange(partners.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {partners.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum sócio adicionado. Clique em "{buttonLabel}".
        </p>
      )}
      {partners.map((p, i) => {
        const casado =
          p.estado_civil === "CASADO(A)" || p.estado_civil === "UNIÃO ESTÁVEL";
        return (
          <div key={i} className="rounded-lg border p-3 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Sócio {i + 1}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nome completo">
                <Input
                  value={p.nome ?? ""}
                  onChange={(e) => update(i, { nome: e.target.value })}
                />
              </Field>
              <Field label="Nacionalidade">
                <Input
                  value={p.nacionalidade ?? ""}
                  onChange={(e) => update(i, { nacionalidade: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Naturalidade (UF / Cidade)">
              <StateCityField
                value={p.naturalidade}
                onChange={(v) => update(i, { naturalidade: v })}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Profissão">
                <Input
                  value={p.profissao ?? ""}
                  onChange={(e) => update(i, { profissao: e.target.value })}
                />
              </Field>
              <Field label="Estado civil">
                <Select
                  value={p.estado_civil ?? ""}
                  onValueChange={(v) =>
                    update(i, { estado_civil: v, regime_bens: casado ? p.regime_bens : "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADO_CIVIL.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {casado && (
              <Field label="Regime de bens">
                <Select
                  value={p.regime_bens ?? ""}
                  onValueChange={(v) => update(i, { regime_bens: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIME_BENS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="Endereço residencial">
              <AddressField
                value={typeof p.endereco === "object" && p.endereco !== null ? p.endereco : undefined}
                onChange={(v) => update(i, { endereco: v })}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Autodeclaração de etnia">
                <Select
                  value={p.etnia ?? ""}
                  onValueChange={(v) => update(i, { etnia: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ETNIA.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Participação no capital (R$)">
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={p.participacao ?? ""}
                  onChange={(e) => update(i, { participacao: e.target.value })}
                />
              </Field>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <UserPlus className="h-4 w-4" /> {buttonLabel}
      </Button>
    </div>
  );
};
