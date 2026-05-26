import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import Papa from "papaparse";
import {
  isValidCpf,
  isValidCnpj,
  onlyDigits,
} from "@/lib/documents";
import type { ExtraFieldDef } from "@/hooks/useClientSettings";
import type { ClientType, CustomField } from "./ClientForm";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  workspaceId: string;
  userId: string;
  extraFields: ExtraFieldDef[];
  onImported: () => void;
}

type StandardKey =
  | "ignore"
  | "client_type"
  | "name"
  | "trade_name"
  | "document_cpf"
  | "document_cnpj"
  | "document_estrangeiro"
  | "phone"
  | "email"
  | "cep"
  | "logradouro"
  | "numero"
  | "complemento"
  | "bairro"
  | "cidade"
  | "uf"
  | "pais"
  | "notes";

const STANDARD_OPTIONS: { value: StandardKey; label: string }[] = [
  { value: "ignore", label: "Ignorar" },
  { value: "client_type", label: "Tipo de cliente" },
  { value: "name", label: "Nome / Razão social" },
  { value: "trade_name", label: "Nome fantasia" },
  { value: "document_cpf", label: "CPF" },
  { value: "document_cnpj", label: "CNPJ" },
  { value: "document_estrangeiro", label: "Documento estrangeiro" },
  { value: "phone", label: "Celular / telefone" },
  { value: "email", label: "E-mail" },
  { value: "cep", label: "CEP" },
  { value: "logradouro", label: "Logradouro" },
  { value: "numero", label: "Número" },
  { value: "complemento", label: "Complemento" },
  { value: "bairro", label: "Bairro" },
  { value: "cidade", label: "Cidade" },
  { value: "uf", label: "UF" },
  { value: "pais", label: "País" },
  { value: "notes", label: "Observações" },
];

type MappingValue = `std:${StandardKey}` | `extra:${string}`;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const guessMapping = (header: string, extras: ExtraFieldDef[]): MappingValue => {
  const n = normalize(header);
  const dict: Record<string, StandardKey> = {
    tipo: "client_type",
    tipodecliente: "client_type",
    nome: "name",
    razaosocial: "name",
    nomerazaosocial: "name",
    nomefantasia: "trade_name",
    fantasia: "trade_name",
    cpf: "document_cpf",
    cnpj: "document_cnpj",
    documento: "document_estrangeiro",
    passaporte: "document_estrangeiro",
    celular: "phone",
    telefone: "phone",
    fone: "phone",
    whatsapp: "phone",
    email: "email",
    cep: "cep",
    logradouro: "logradouro",
    endereco: "logradouro",
    rua: "logradouro",
    numero: "numero",
    num: "numero",
    complemento: "complemento",
    bairro: "bairro",
    cidade: "cidade",
    municipio: "cidade",
    uf: "uf",
    estado: "uf",
    pais: "pais",
    observacoes: "notes",
    obs: "notes",
    notas: "notes",
  };
  if (dict[n]) return `std:${dict[n]}`;
  for (const ex of extras) {
    if (normalize(ex.label) === n) return `extra:${ex.id}`;
  }
  return "std:ignore";
};

const parseClientType = (raw: string): ClientType | null => {
  const n = normalize(raw);
  if (["pf", "pessoafisica", "fisica", "f"].includes(n)) return "pessoa_fisica";
  if (["pj", "pessoajuridica", "juridica", "j"].includes(n)) return "pessoa_juridica";
  if (["estrangeiro", "exterior", "estrangeira"].includes(n)) return "estrangeiro";
  return null;
};

interface BuiltRow {
  index: number;
  client_type: ClientType;
  name: string;
  trade_name: string;
  document: string;
  email: string;
  phone: string;
  notes: string;
  address: Record<string, string>;
  custom_fields: CustomField[];
  errors: string[];
}

export const ImportClientsDialog = ({
  open,
  onOpenChange,
  workspaceId,
  userId,
  extraFields,
  onImported,
}: Props) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, MappingValue>>({});
  const [defaultType, setDefaultType] = useState<ClientType>("pessoa_fisica");
  const [progress, setProgress] = useState(0);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setStep(1);
    setHeaders([]);
    setAllRows([]);
    setMapping({});
    setProgress(0);
    setImporting(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".csv")) {
        Papa.parse<string[]>(file, {
          skipEmptyLines: true,
          complete: (res) => {
            const data = res.data as string[][];
            if (data.length === 0) {
              toast.error("Arquivo vazio");
              return;
            }
            ingestRaw(data);
          },
          error: () => toast.error("Erro ao ler CSV"),
        });
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          raw: false,
          defval: "",
        });
        if (!json.length) {
          toast.error("Planilha vazia");
          return;
        }
        ingestRaw(json as string[][]);
      } else {
        toast.error("Use um arquivo .csv, .xlsx ou .xls");
      }
    } catch (e) {
      toast.error("Erro ao processar arquivo: " + (e as Error).message);
    }
  };

  const ingestRaw = (data: string[][]) => {
    const head = (data[0] ?? []).map((h) => String(h ?? "").trim());
    const body = data
      .slice(1)
      .map((r) => head.map((_, i) => String(r[i] ?? "").trim()))
      .filter((r) => r.some((c) => c.length > 0));
    setHeaders(head);
    setAllRows(body);
    const map: Record<number, MappingValue> = {};
    head.forEach((h, i) => {
      map[i] = guessMapping(h, extraFields);
    });
    setMapping(map);
    setStep(2);
  };

  const built = useMemo<BuiltRow[]>(() => {
    if (step < 3 && step !== 2) return [];
    return allRows.map((cols, idx) => {
      const row: BuiltRow = {
        index: idx + 2,
        client_type: defaultType,
        name: "",
        trade_name: "",
        document: "",
        email: "",
        phone: "",
        notes: "",
        address: {},
        custom_fields: [],
        errors: [],
      };
      let cpfRaw = "";
      let cnpjRaw = "";
      let estrangeiroRaw = "";

      for (let i = 0; i < headers.length; i++) {
        const m = mapping[i] ?? "std:ignore";
        const val = (cols[i] ?? "").trim();
        if (!val) continue;
        if (m === "std:ignore") continue;
        if (m.startsWith("extra:")) {
          const id = m.slice("extra:".length);
          const def = extraFields.find((e) => e.id === id);
          if (def) {
            row.custom_fields.push({
              source: "extra",
              extra_id: id,
              label: def.label,
              value: val,
            });
          }
          continue;
        }
        const key = m.slice("std:".length) as StandardKey;
        switch (key) {
          case "client_type": {
            const t = parseClientType(val);
            if (t) row.client_type = t;
            break;
          }
          case "name": row.name = val; break;
          case "trade_name": row.trade_name = val; break;
          case "document_cpf": cpfRaw = val; break;
          case "document_cnpj": cnpjRaw = val; break;
          case "document_estrangeiro": estrangeiroRaw = val; break;
          case "phone": row.phone = val; break;
          case "email": row.email = val; break;
          case "notes": row.notes = val; break;
          case "cep":
          case "logradouro":
          case "numero":
          case "complemento":
          case "bairro":
          case "cidade":
          case "uf":
          case "pais":
            row.address[key] = key === "uf" ? val.toUpperCase().slice(0, 2) : val;
            break;
          default: break;
        }
      }

      // Resolve document by client_type
      if (row.client_type === "pessoa_fisica") {
        row.document = onlyDigits(cpfRaw);
      } else if (row.client_type === "pessoa_juridica") {
        row.document = onlyDigits(cnpjRaw);
      } else {
        row.document = estrangeiroRaw;
      }

      // Validate
      if (!row.name) row.errors.push("Nome obrigatório");
      if (row.client_type === "pessoa_fisica" && row.document && !isValidCpf(row.document)) {
        row.errors.push("CPF inválido");
      }
      if (row.client_type === "pessoa_juridica" && row.document && !isValidCnpj(row.document)) {
        row.errors.push("CNPJ inválido");
      }
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        row.errors.push("E-mail inválido");
      }
      for (const ex of extraFields) {
        if (ex.required) {
          const v = row.custom_fields.find((c) => c.extra_id === ex.id)?.value ?? "";
          if (!v.trim()) row.errors.push(`Extra obrigatório: ${ex.label}`);
        }
      }
      return row;
    });
  }, [allRows, headers, mapping, defaultType, extraFields, step]);

  const validCount = built.filter((r) => r.errors.length === 0).length;
  const errorCount = built.length - validCount;

  const doImport = async () => {
    setImporting(true);
    setProgress(0);
    const valid = built.filter((r) => r.errors.length === 0);
    const batchSize = 100;
    let done = 0;
    for (let i = 0; i < valid.length; i += batchSize) {
      const slice = valid.slice(i, i + batchSize).map((r) => ({
        workspace_id: workspaceId,
        user_id: userId,
        client_type: r.client_type,
        document: r.document,
        name: r.name,
        trade_name: r.trade_name,
        email: r.email,
        phone: r.phone,
        notes: r.notes,
        address: r.address as unknown as never,
        custom_fields: r.custom_fields as unknown as never,
      }));
      const { error } = await supabase
        .from("clients")
        .insert(slice as never);
      if (error) {
        toast.error("Erro no lote: " + error.message);
        setImporting(false);
        return;
      }
      done += slice.length;
      setProgress(Math.round((done / valid.length) * 100));
    }
    toast.success(`${done} cliente(s) importado(s)`);
    setImporting(false);
    onImported();
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar clientes</DialogTitle>
          <DialogDescription>
            Envie uma planilha CSV ou XLSX, mapeie as colunas e revise antes de importar.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="border border-dashed rounded-lg p-8 text-center space-y-3">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Selecione um arquivo .csv, .xlsx ou .xls. A primeira linha deve conter os títulos das colunas.
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="block mx-auto text-sm"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-3 text-xs space-y-2">
              <p className="text-muted-foreground">
                Para linhas onde a coluna "Tipo de cliente" estiver vazia ou não mapeada, será usado:
              </p>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Tipo padrão:</Label>
                <Select value={defaultType} onValueChange={(v) => setDefaultType(v as ClientType)}>
                  <SelectTrigger className="w-48 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pessoa_fisica">Pessoa física</SelectItem>
                    <SelectItem value="pessoa_juridica">Pessoa jurídica</SelectItem>
                    <SelectItem value="estrangeiro">Estrangeiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-md divide-y">
              {headers.map((h, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr] gap-3 items-center px-3 py-2">
                  <div className="text-sm font-medium truncate">{h || `Coluna ${i + 1}`}</div>
                  <Select
                    value={mapping[i] ?? "std:ignore"}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [i]: v as MappingValue }))}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={`std:${o.value}`}>
                          {o.label}
                        </SelectItem>
                      ))}
                      {extraFields.length > 0 && (
                        <>
                          {extraFields.map((ex) => (
                            <SelectItem key={ex.id} value={`extra:${ex.id}`}>
                              Extra: {ex.label || "(sem nome)"}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={reset}>Voltar</Button>
              <Button onClick={() => setStep(3)}>Pré-visualizar</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-feita))]" />
                {validCount} válidas
              </Badge>
              {errorCount > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  {errorCount} com erro
                </Badge>
              )}
            </div>
            <div className="border rounded-md max-h-[40vh] overflow-y-auto divide-y text-xs">
              {built.slice(0, 50).map((r) => (
                <div key={r.index} className="px-3 py-2 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Linha {r.index}</span>
                    <span className="font-medium">{r.name || "(sem nome)"}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {r.client_type === "pessoa_juridica" ? "PJ" : r.client_type === "pessoa_fisica" ? "PF" : "Estr."}
                    </Badge>
                  </div>
                  {r.document && <div className="text-muted-foreground">Doc: {r.document}</div>}
                  {r.email && <div className="text-muted-foreground">{r.email}</div>}
                  {r.errors.length > 0 && (
                    <div className="text-destructive">{r.errors.join(" · ")}</div>
                  )}
                </div>
              ))}
              {built.length > 50 && (
                <div className="px-3 py-2 text-muted-foreground text-center">
                  + {built.length - 50} linhas adicionais não mostradas
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Voltar ao mapeamento</Button>
              <Button onClick={() => setStep(4)} disabled={validCount === 0}>
                Importar {validCount} cliente(s)
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            {!importing && (
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                Confirme a importação de <strong>{validCount}</strong> cliente(s) no ambiente atual.
                {errorCount > 0 && (
                  <span className="text-muted-foreground"> {errorCount} linha(s) com erro serão ignoradas.</span>
                )}
              </div>
            )}
            {importing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground text-center">{progress}%</p>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)} disabled={importing}>
                Voltar
              </Button>
              <Button onClick={doImport} disabled={importing || validCount === 0}>
                {importing ? "Importando…" : "Confirmar importação"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
