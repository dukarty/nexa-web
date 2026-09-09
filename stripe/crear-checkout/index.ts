// supabase/functions/crear-checkout/index.ts
// Crea una sesión de Stripe Checkout (SOLO web) para que un negocio pague:
//  - Pro / Referente  -> suscripción (mode: subscription)
//  - Impulsar 120/55   -> pago único  (mode: payment)
// El cliente (panel web) llama a esta función y redirige a la URL que devuelve.
// NADA de esto vive en la app de iPhone.

import Stripe from "https://esm.sh/stripe@16?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const SITE = Deno.env.get("SITE_URL") ?? "https://holanyxa.com";

// producto -> { price id (env), modo }.  Los price IDs se rellenan como env vars (ver README).
const PRODUCTOS: Record<string, { price: string | undefined; mode: "subscription" | "payment" }> = {
  pro_mensual:       { price: Deno.env.get("STRIPE_PRICE_PRO_MENSUAL"),       mode: "subscription" },
  pro_anual:         { price: Deno.env.get("STRIPE_PRICE_PRO_ANUAL"),         mode: "subscription" },
  referente_mensual: { price: Deno.env.get("STRIPE_PRICE_REFERENTE_MENSUAL"), mode: "subscription" },
  referente_anual:   { price: Deno.env.get("STRIPE_PRICE_REFERENTE_ANUAL"),   mode: "subscription" },
  impulsar_120:      { price: Deno.env.get("STRIPE_PRICE_IMPULSAR_120"),      mode: "payment" },
  impulsar_55:       { price: Deno.env.get("STRIPE_PRICE_IMPULSAR_55"),       mode: "payment" },
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
    const { producto, business_id, email } = await req.json();
    const cfg = PRODUCTOS[producto];
    if (!cfg) return json({ error: "producto no válido" }, 400);
    if (!cfg.price) return json({ error: `falta el price id para '${producto}' (revisa las env vars)` }, 500);

    const session = await stripe.checkout.sessions.create({
      mode: cfg.mode,
      line_items: [{ price: cfg.price, quantity: 1 }],
      // client_reference_id nos deja saber en el webhook QUÉ negocio pagó.
      client_reference_id: business_id ?? undefined,
      customer_email: email ?? undefined,
      metadata: { business_id: business_id ?? "", producto },
      // vuelta al panel (web) tras pagar / cancelar
      success_url: `${SITE}/panel.html?pago=ok&producto=${encodeURIComponent(producto)}`,
      cancel_url: `${SITE}/panel.html?pago=cancelado`,
      allow_promotion_codes: true,
      automatic_tax: { enabled: false }, // activar cuando Stripe Tax esté configurado
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
