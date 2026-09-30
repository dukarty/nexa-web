// supabase/functions/crear-checkout/index.ts
// Crea una sesión de Stripe Checkout (SOLO web) para que un negocio pague.
// Modelo NUEVO (PRECIOS-NYXA.md, 5 tramos):
//   - p15 / p49 / p99 / p199  -> suscripción mensual (mode: subscription)
//   - extra                    -> cliente extra 7,50 € (mode: payment, con cantidad)
//   - "a medida" NO tiene producto Stripe (se cierra en persona / contrato).
// El cliente (panel web) llama a esta función y redirige a la URL que devuelve.
// NADA de esto vive en la app de iPhone (esquivamos el −30 % de Apple).

import Stripe from "https://esm.sh/stripe@16?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const SITE = Deno.env.get("SITE_URL") ?? "https://holanyxa.com";

// producto -> { price id (env var), modo }. Los price IDs los pone David en los
// Secrets de Supabase (test ahora, live el día del IBAN). Ver ENCENDER-COBRO-EMPRESAS.md.
const PRODUCTOS: Record<string, { price: string | undefined; mode: "subscription" | "payment" }> = {
  p15:   { price: Deno.env.get("STRIPE_PRICE_P15"),   mode: "subscription" },
  p49:   { price: Deno.env.get("STRIPE_PRICE_P49"),   mode: "subscription" },
  p99:   { price: Deno.env.get("STRIPE_PRICE_P99"),   mode: "subscription" },
  p199:  { price: Deno.env.get("STRIPE_PRICE_P199"),  mode: "subscription" },
  extra: { price: Deno.env.get("STRIPE_PRICE_EXTRA"), mode: "payment" },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  try {
    const { producto, business_id, email, cantidad } = await req.json();
    const cfg = PRODUCTOS[producto];
    if (!cfg) return json({ error: "producto no válido" }, 400);
    if (!cfg.price) return json({ error: `falta el price id para '${producto}' (revisa las env vars)` }, 500);

    // El cliente extra puede pedirse en lotes; el resto siempre 1.
    const qty = producto === "extra"
      ? Math.max(1, Math.min(50, parseInt(String(cantidad ?? 1), 10) || 1))
      : 1;

    const session = await stripe.checkout.sessions.create({
      mode: cfg.mode,
      line_items: [{ price: cfg.price, quantity: qty }],
      // client_reference_id nos deja saber en el webhook QUÉ negocio pagó.
      client_reference_id: business_id ?? undefined,
      customer_email: email ?? undefined,
      metadata: { business_id: business_id ?? "", producto },
      success_url: `${SITE}/panel.html?pago=ok&producto=${encodeURIComponent(producto)}`,
      cancel_url: `${SITE}/panel.html?pago=cancelado`,
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
