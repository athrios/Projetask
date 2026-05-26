import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ExtraFieldType = "text" | "long_text" | "number" | "date";

export interface ExtraFieldDef {
  id: string;
  label: string;
  type: ExtraFieldType;
  required: boolean;
}

export interface ClientSettings {
  field_order: string[];
  hidden_fields: string[];
  extra_fields: ExtraFieldDef[];
}

export const DEFAULT_FIELD_ORDER = [
  "document",
  "trade_name",
  "email",
  "phone",
  "address",
  "notes",
] as const;

export type StandardFieldKey = (typeof DEFAULT_FIELD_ORDER)[number];

export const STANDARD_FIELD_LABELS: Record<StandardFieldKey, string> = {
  document: "Documento",
  trade_name: "Nome fantasia",
  email: "E-mail",
  phone: "Telefone",
  address: "Endereço",
  notes: "Observações",
};

const empty: ClientSettings = {
  field_order: [...DEFAULT_FIELD_ORDER],
  hidden_fields: [],
  extra_fields: [],
};

export const useClientSettings = (workspaceId: string | null) => {
  const [settings, setSettings] = useState<ClientSettings>(empty);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data } = await supabase
      .from("client_settings")
      .select("field_order, hidden_fields, extra_fields")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (data) {
      setSettings({
        field_order: (data.field_order as string[]) ?? [...DEFAULT_FIELD_ORDER],
        hidden_fields: (data.hidden_fields as string[]) ?? [],
        extra_fields: (data.extra_fields as ExtraFieldDef[]) ?? [],
      });
    } else {
      setSettings(empty);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (next: ClientSettings, userId: string) => {
      if (!workspaceId) return { error: new Error("no workspace") };
      const { error } = await supabase.from("client_settings").upsert(
        {
          workspace_id: workspaceId,
          field_order: next.field_order,
          hidden_fields: next.hidden_fields,
          extra_fields: next.extra_fields,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id" },
      );
      if (!error) setSettings(next);
      return { error };
    },
    [workspaceId],
  );

  return { settings, loading, save, reload: load };
};

/**
 * Resolve the effective display order for fields, including extras.
 * Fields missing from field_order are appended at the end (never hidden by omission).
 * Only fields explicitly listed in hidden_fields are hidden.
 */
export const resolveFieldOrder = (
  settings: ClientSettings,
): { key: string; isExtra: boolean; extraId?: string }[] => {
  const allKeys: string[] = [
    ...DEFAULT_FIELD_ORDER,
    ...settings.extra_fields.map((e) => `extra:${e.id}`),
  ];
  const ordered: string[] = [];
  for (const k of settings.field_order) {
    if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k);
  }
  for (const k of allKeys) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  const hidden = new Set(settings.hidden_fields);
  return ordered
    .filter((k) => !hidden.has(k))
    .map((k) =>
      k.startsWith("extra:")
        ? { key: k, isExtra: true, extraId: k.slice("extra:".length) }
        : { key: k, isExtra: false },
    );
};
