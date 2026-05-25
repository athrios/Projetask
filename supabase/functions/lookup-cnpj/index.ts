import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const PROVIDER_TIMEOUT_MS = 6000;

const BodySchema = z.object({ cnpj: z.string().min(11).max(20) });

type NormalizedCnpj = {
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
  main_cnae: { code: string | null; description: string | null } | null;
  secondary_cnaes: Array<{ code: string | null; description: string | null }>;
  phone: string | null;
  email: string | null;
};

function sanitizeCnpj(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  if (/^(\d)\1{13}$/.test(digits)) return null;

  const calcDv = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calcDv(digits.slice(0, 12), w1);
  const dv2 = calcDv(digits.slice(0, 12) + dv1, w2);
  if (dv1 !== Number(digits[12]) || dv2 !== Number(digits[13])) return null;
  return digits;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
  } finally {
    clearTimeout(t);
  }
}

function normalizeCnpja(cnpj: string, r: any): NormalizedCnpj {
  const addr = r?.address ?? {};
  const main = r?.mainActivity ?? {};
  const sides: any[] = Array.isArray(r?.sideActivities) ? r.sideActivities : [];
  const phone = Array.isArray(r?.phones) && r.phones[0]
    ? `${r.phones[0].area ?? ""}${r.phones[0].number ?? ""}` || null
    : null;
  const email = Array.isArray(r?.emails) && r.emails[0]?.address ? r.emails[0].address : null;
  return {
    cnpj,
    company_name: r?.company?.name ?? null,
    trade_name: r?.alias ?? null,
    status: r?.status?.text ?? null,
    address: {
      street: addr.street ?? null,
      number: addr.number ?? null,
      complement: addr.details ?? null,
      neighborhood: addr.district ?? null,
    },
    city: addr.city ?? null,
    state: addr.state ?? null,
    zip_code: addr.zip ?? null,
    main_cnae: main?.id ? { code: String(main.id), description: main.text ?? null } : null,
    secondary_cnaes: sides.map((s) => ({
      code: s?.id ? String(s.id) : null,
      description: s?.text ?? null,
    })),
    phone,
    email,
  };
}

function normalizeBrasilApi(cnpj: string, r: any): NormalizedCnpj {
  const sides: any[] = Array.isArray(r?.cnaes_secundarios) ? r.cnaes_secundarios : [];
  const ddd = r?.ddd_telefone_1 ?? r?.ddd_telefone_2 ?? null;
  return {
    cnpj,
    company_name: r?.razao_social ?? null,
    trade_name: r?.nome_fantasia ?? null,
    status: r?.descricao_situacao_cadastral ?? null,
    address: {
      street: r?.logradouro ?? null,
      number: r?.numero ?? null,
      complement: r?.complemento ?? null,
      neighborhood: r?.bairro ?? null,
    },
    city: r?.municipio ?? null,
    state: r?.uf ?? null,
    zip_code: r?.cep ?? null,
    main_cnae: r?.cnae_fiscal
      ? { code: String(r.cnae_fiscal), description: r?.cnae_fiscal_descricao ?? null }
      : null,
    secondary_cnaes: sides.map((s) => ({
      code: s?.codigo ? String(s.codigo) : null,
      description: s?.descricao ?? null,
    })),
    phone: ddd,
    email: r?.email ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "invalid_body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const cnpj = sanitizeCnpj(parsed.data.cnpj);
  if (!cnpj) {
    return new Response(JSON.stringify({ error: "invalid_cnpj" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Cache lookup
  const { data: cached } = await supabase
    .from("cnpj_lookup_cache")
    .select("provider,data,fetched_at")
    .eq("cnpj", cnpj)
    .maybeSingle();

  if (cached && cached.fetched_at) {
    const age = Date.now() - new Date(cached.fetched_at as string).getTime();
    if (age < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({ source: "cache", provider: cached.provider, data: cached.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  // Providers
  const providers: Array<{
    name: "cnpja_open" | "brasilapi";
    url: string;
    normalize: (c: string, r: any) => NormalizedCnpj;
  }> = [
    {
      name: "cnpja_open",
      url: `https://open.cnpja.com/office/${cnpj}`,
      normalize: normalizeCnpja,
    },
    {
      name: "brasilapi",
      url: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      normalize: normalizeBrasilApi,
    },
  ];

  let lastStatus = 502;
  for (const p of providers) {
    try {
      const res = await fetchWithTimeout(p.url);
      if (res.status === 404) {
        lastStatus = 404;
        continue;
      }
      if (!res.ok) {
        lastStatus = 502;
        continue;
      }
      const raw = await res.json();
      const data = p.normalize(cnpj, raw);

      await supabase.from("cnpj_lookup_cache").upsert({
        cnpj,
        provider: p.name,
        data: data as unknown as Record<string, unknown>,
        raw: raw as Record<string, unknown>,
        fetched_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ source: "provider", provider: p.name, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (_e) {
      lastStatus = 502;
      continue;
    }
  }

  return new Response(
    JSON.stringify({
      error: lastStatus === 404 ? "cnpj_not_found" : "upstream_unavailable",
    }),
    { status: lastStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
