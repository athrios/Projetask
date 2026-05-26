import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressField, type AddressValue } from "@/components/forms/fields/AddressField";
import {
  isValidCpf,
  isValidCnpj,
  maskCpf,
  maskCnpj,
  onlyDigits,
} from "@/lib/documents";
import {
  Building2,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Paperclip,
  Download,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useClientSettings, type ExtraFieldDef } from "@/hooks/useClientSettings";

export type ClientType = "pessoa_fisica" | "pessoa_juridica" | "estrangeiro";

export interface CustomField {
  label: string;
  value: string;
  source?: "extra";
  extra_id?: string;
}

export interface ClientAddress extends AddressValue {
  pais?: string;
}

export interface ClientRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  client_type: ClientType;
  document: string;
  name: string;
  trade_name: string;
  email: string;
  phone: string;
  address: ClientAddress;
  cnpj_lookup_snapshot: unknown | null;
  notes: string;
  custom_fields: CustomField[];
  created_at: string;
  updated_at: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
}

type CnpjLookupData = {
  cnpj: string;
  company_name: string | null;
  trade_name: string | null;
  status: string | null;
  address: {
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
  };
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
};

const emptyClient = (workspaceId: string, userId: string): ClientRecord => ({
  id: "",
  workspace_id: workspaceId,
  user_id: userId,
  client_type: "pessoa_fisica",
  document: "",
  name: "",
  trade_name: "",
  email: "",
  phone: "",
  address: { pais: "Brasil" },
  cnpj_lookup_snapshot: null,
  notes: "",
  custom_fields: [],
  created_at: "",
  updated_at: "",
});

interface Props {
  workspaceId: string;
  userId: string;
  initial?: ClientRecord;
  onSaved: (c: ClientRecord) => void;
  onCancel: () => void;
}

export const ClientForm = ({ workspaceId, userId, initial, onSaved, onCancel }: Props) => {
  const { settings: clientSettings } = useClientSettings(workspaceId);
  const [draft, setDraft] = useState<ClientRecord>(
    initial ?? emptyClient(workspaceId, userId),
  );
  const [saving, setSaving] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [cnpjPreview, setCnpjPreview] = useState<CnpjLookupData | null>(null);
  const lastLookup = useRef<string>("");

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = !!initial?.id;

  useEffect(() => {
    if (!isEdit) {
      setAttachments([]);
      return;
    }
    supabase
      .from("client_attachments")
      .select("id, file_name, file_path, mime_type, size_bytes")
      .eq("client_id", initial!.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAttachments((data ?? []) as Attachment[]));
  }, [initial, isEdit]);

  const update = <K extends keyof ClientRecord>(key: K, value: ClientRecord[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const runCnpjLookup = async (cnpjMasked: string) => {
    const digits = onlyDigits(cnpjMasked);
    if (digits.length !== 14) return;
    if (!isValidCnpj(digits)) {
      setCnpjError("CNPJ inválido. Verifique os números digitados.");
      setCnpjPreview(null);
      return;
    }
    if (lastLookup.current === digits) return;
    lastLookup.current = digits;
    setCnpjLoading(true);
    setCnpjError(null);
    try {
      const { data, error } = await supabase.functions.invoke("lookup-cnpj", {
        body: { cnpj: digits },
      });
      if (error || !data) {
        setCnpjError("Não encontramos dados públicos para este CNPJ. Você pode continuar mesmo assim.");
        setCnpjPreview(null);
        return;
      }
      const payload = (data as { data?: CnpjLookupData })?.data ?? null;
      if (!payload) {
        setCnpjError("Não encontramos dados públicos para este CNPJ. Você pode continuar mesmo assim.");
        setCnpjPreview(null);
        return;
      }
      const d = payload;
      const addr = d.address ?? {
        street: null,
        number: null,
        complement: null,
        neighborhood: null,
      };
      setCnpjPreview(d);
      setDraft((prev) => ({
        ...prev,
        name: prev.name || d.company_name || prev.name,
        trade_name: prev.trade_name || d.trade_name || prev.trade_name,
        email: prev.email || d.email || prev.email,
        phone: prev.phone || d.phone || prev.phone,
        address: {
          ...prev.address,
          cep: prev.address.cep || d.zip_code || prev.address.cep,
          logradouro: prev.address.logradouro || addr.street || prev.address.logradouro,
          numero: prev.address.numero || addr.number || prev.address.numero,
          complemento:
            prev.address.complemento || addr.complement || prev.address.complemento,
          bairro: prev.address.bairro || addr.neighborhood || prev.address.bairro,
          cidade: prev.address.cidade || d.city || prev.address.cidade,
          uf: prev.address.uf || d.state || prev.address.uf,
          pais: prev.address.pais || "Brasil",
        },
        cnpj_lookup_snapshot: {
          ...d,
          consultado_em: new Date().toISOString(),
        },
      }));
    } catch {
      setCnpjError("Não foi possível consultar o CNPJ agora.");
    } finally {
      setCnpjLoading(false);
    }
  };


  const getExtraValue = (extraId: string): string => {
    const found = draft.custom_fields.find(
      (c) => c.source === "extra" && c.extra_id === extraId,
    );
    return found?.value ?? "";
  };

  const setExtraValue = (ex: ExtraFieldDef, value: string) => {
    setDraft((d) => {
      const idx = d.custom_fields.findIndex(
        (c) => c.source === "extra" && c.extra_id === ex.id,
      );
      const entry: CustomField = {
        source: "extra",
        extra_id: ex.id,
        label: ex.label,
        value,
      };
      const next = [...d.custom_fields];
      if (idx >= 0) next[idx] = entry;
      else next.push(entry);
      return { ...d, custom_fields: next };
    });
  };

  const validate = (): string | null => {
    if (!draft.name.trim()) return "Informe o nome ou razão social.";
    if (draft.client_type === "pessoa_fisica") {
      if (draft.document && !isValidCpf(draft.document)) return "CPF inválido.";
    } else if (draft.client_type === "pessoa_juridica") {
      if (draft.document && !isValidCnpj(draft.document)) return "CNPJ inválido.";
    }
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      return "E-mail inválido.";
    }
    for (const ex of clientSettings.extra_fields) {
      if (ex.required && !getExtraValue(ex.id).trim()) {
        return `Preencha o campo extra obrigatório: ${ex.label}`;
      }
    }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = {
      workspace_id: workspaceId,
      user_id: userId,
      client_type: draft.client_type,
      document:
        draft.client_type === "estrangeiro"
          ? draft.document.trim()
          : onlyDigits(draft.document),
      name: draft.name.trim(),
      trade_name: draft.trade_name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      address: draft.address as unknown as Record<string, unknown>,
      cnpj_lookup_snapshot: draft.cnpj_lookup_snapshot as unknown,
      notes: draft.notes,
      custom_fields: draft.custom_fields.filter((f) => f.label.trim() || f.value.trim()),
    };
    if (isEdit) {
      const { data, error } = await supabase
        .from("clients")
        .update(payload as never)
        .eq("id", initial!.id)
        .select("*")
        .single();
      setSaving(false);
      if (error) return toast.error("Erro ao salvar: " + error.message);
      toast.success("Cliente atualizado");
      onSaved(data as unknown as ClientRecord);
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert(payload as never)
        .select("*")
        .single();
      setSaving(false);
      if (error) return toast.error("Erro ao salvar: " + error.message);
      toast.success("Cliente criado");
      onSaved(data as unknown as ClientRecord);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!isEdit) {
      toast.error("Salve o cliente antes de adicionar anexos.");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${workspaceId}/${initial!.id}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("client-attachments")
          .upload(path, file, { contentType: file.type });
        if (upErr) {
          toast.error("Falha ao enviar " + file.name);
          continue;
        }
        const { data: row, error: insErr } = await supabase
          .from("client_attachments")
          .insert({
            client_id: initial!.id,
            workspace_id: workspaceId,
            user_id: userId,
            file_path: path,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          })
          .select("id, file_name, file_path, mime_type, size_bytes")
          .single();
        if (insErr) {
          await supabase.storage.from("client-attachments").remove([path]);
          toast.error("Falha ao registrar anexo: " + file.name);
          continue;
        }
        setAttachments((a) => [row as Attachment, ...a]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadAttachment = async (a: Attachment) => {
    const { data, error } = await supabase.storage
      .from("client-attachments")
      .createSignedUrl(a.file_path, 60);
    if (error || !data) return toast.error("Erro ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  const removeAttachment = async (a: Attachment) => {
    await supabase.storage.from("client-attachments").remove([a.file_path]);
    const { error } = await supabase.from("client_attachments").delete().eq("id", a.id);
    if (error) return toast.error("Erro ao remover anexo");
    setAttachments((list) => list.filter((x) => x.id !== a.id));
  };

  const docInput = () => {
    if (draft.client_type === "pessoa_juridica") {
      return (
        <div className="space-y-1">
          <Label>CNPJ</Label>
          <div className="relative">
            <Input
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              value={maskCnpj(draft.document)}
              onChange={(e) => {
                update("document", onlyDigits(e.target.value));
                setCnpjError(null);
                if (cnpjPreview && onlyDigits(e.target.value) !== cnpjPreview.cnpj) {
                  setCnpjPreview(null);
                  lastLookup.current = "";
                }
              }}
              onBlur={(e) => runCnpjLookup(e.target.value)}
              maxLength={18}
            />
            {cnpjLoading && (
              <Loader2 className="h-4 w-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>
          {cnpjError && <p className="text-xs text-destructive">{cnpjError}</p>}
          {cnpjPreview && (
            <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Dados públicos consultados
              </div>
              {cnpjPreview.company_name && <div>{cnpjPreview.company_name}</div>}
              {cnpjPreview.trade_name && (
                <div className="text-muted-foreground">{cnpjPreview.trade_name}</div>
              )}
              {cnpjPreview.status && (
                <div className="text-muted-foreground">Situação: {cnpjPreview.status}</div>
              )}
            </div>
          )}
        </div>
      );
    }
    if (draft.client_type === "pessoa_fisica") {
      return (
        <div className="space-y-1">
          <Label>CPF</Label>
          <Input
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={maskCpf(draft.document)}
            onChange={(e) => update("document", onlyDigits(e.target.value))}
            maxLength={14}
          />
          {draft.document &&
            onlyDigits(draft.document).length === 11 &&
            !isValidCpf(draft.document) && (
              <p className="text-xs text-destructive">CPF inválido.</p>
            )}
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <Label>Documento / identificação</Label>
        <Input
          placeholder="Passaporte, TIN, etc."
          value={draft.document}
          onChange={(e) => update("document", e.target.value)}
          maxLength={60}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 py-4">
      {/* General */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Dados gerais</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Tipo de cliente</Label>
            <Select
              value={draft.client_type}
              onValueChange={(v) => {
                update("client_type", v as ClientType);
                update("document", "");
                setCnpjPreview(null);
                setCnpjError(null);
                lastLookup.current = "";
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoa_fisica">Pessoa física</SelectItem>
                <SelectItem value="pessoa_juridica">Pessoa jurídica</SelectItem>
                <SelectItem value="estrangeiro">Estrangeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {docInput()}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>
              {draft.client_type === "pessoa_juridica" ? "Razão social" : "Nome"}
            </Label>
            <Input
              value={draft.name}
              onChange={(e) => update("name", e.target.value)}
              maxLength={200}
            />
          </div>
          {draft.client_type === "pessoa_juridica" && (
            <div className="space-y-1">
              <Label>Nome fantasia</Label>
              <Input
                value={draft.trade_name}
                onChange={(e) => update("trade_name", e.target.value)}
                maxLength={200}
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Telefone / celular</Label>
            <Input
              value={draft.phone}
              onChange={(e) => update("phone", e.target.value)}
              maxLength={40}
            />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => update("email", e.target.value)}
              maxLength={200}
            />
          </div>
        </div>
      </section>

      {/* Address */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Endereço</h3>
        <AddressField
          value={draft.address}
          onChange={(v) => update("address", { ...draft.address, ...v })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Bairro</Label>
            <Input
              value={draft.address.bairro ?? ""}
              onChange={(e) =>
                update("address", { ...draft.address, bairro: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <div className="space-y-1">
              <Label>Cidade</Label>
              <Input
                value={draft.address.cidade ?? ""}
                onChange={(e) =>
                  update("address", { ...draft.address, cidade: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>UF</Label>
              <Input
                value={draft.address.uf ?? ""}
                maxLength={2}
                onChange={(e) =>
                  update("address", {
                    ...draft.address,
                    uf: e.target.value.toUpperCase(),
                  })
                }
              />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <Label>País</Label>
          <Input
            value={draft.address.pais ?? ""}
            onChange={(e) =>
              update("address", { ...draft.address, pais: e.target.value })
            }
            placeholder="Brasil"
          />
        </div>
      </section>

      {/* Attachments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Anexos</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!isEdit || uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-1.5"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Enviar arquivo
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
        {!isEdit && (
          <p className="text-xs text-muted-foreground">
            Salve o cliente primeiro para anexar arquivos.
          </p>
        )}
        {attachments.length > 0 && (
          <ul className="space-y-1.5">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 bg-card"
              >
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{a.file_name}</span>
                <button
                  type="button"
                  onClick={() => downloadAttachment(a)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Baixar"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAttachment(a)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Notes */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Observações</h3>
        <Textarea
          value={draft.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Anotações internas sobre este cliente"
        />
      </section>

      {/* Fixed extra fields (workspace-wide) */}
      {clientSettings.extra_fields.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Campos Extras</h3>
          <p className="text-xs text-muted-foreground">
            Campos configurados nas configurações de Clientes e aplicados a todos os clientes deste ambiente.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {clientSettings.extra_fields.map((ex) => {
              const v = getExtraValue(ex.id);
              return (
                <div key={ex.id} className="space-y-1">
                  <Label>
                    {ex.label || "Campo extra"}
                    {ex.required && <span className="text-destructive"> *</span>}
                  </Label>
                  {ex.type === "long_text" ? (
                    <Textarea
                      value={v}
                      rows={3}
                      maxLength={2000}
                      onChange={(e) => setExtraValue(ex, e.target.value)}
                    />
                  ) : (
                    <Input
                      type={
                        ex.type === "number" ? "number" : ex.type === "date" ? "date" : "text"
                      }
                      value={v}
                      maxLength={300}
                      onChange={(e) => setExtraValue(ex, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Custom fields (client-specific) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Campos personalizados</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              update("custom_fields", [...draft.custom_fields, { label: "", value: "" }])
            }
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
        {(() => {
          const visibleCustoms = draft.custom_fields
            .map((cf, i) => ({ cf, i }))
            .filter(({ cf }) => cf.source !== "extra");
          if (visibleCustoms.length === 0) {
            return (
              <p className="text-xs text-muted-foreground">Sem campos personalizados.</p>
            );
          }
          return (
            <ul className="space-y-2">
              {visibleCustoms.map(({ cf, i }) => (
                <li key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-start">
                  <Input
                    placeholder="Rótulo"
                    value={cf.label}
                    maxLength={80}
                    onChange={(e) => {
                      const next = [...draft.custom_fields];
                      next[i] = { ...next[i], label: e.target.value };
                      update("custom_fields", next);
                    }}
                  />
                  <Input
                    placeholder="Valor"
                    value={cf.value}
                    maxLength={300}
                    onChange={(e) => {
                      const next = [...draft.custom_fields];
                      next[i] = { ...next[i], value: e.target.value };
                      update("custom_fields", next);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      update(
                        "custom_fields",
                        draft.custom_fields.filter((_, ix) => ix !== i),
                      );
                    }}
                    className="p-2 rounded hover:bg-muted text-muted-foreground"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          );
        })()}
      </section>


      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Salvando…" : isEdit ? "Salvar" : "Criar cliente"}
        </Button>
      </div>
    </div>
  );
};
