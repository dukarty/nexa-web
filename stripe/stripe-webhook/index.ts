// supabase/functions/stripe-webhook/index.ts
// Escucha a Stripe y, cuando un pago se confirma, actualiza la tabla `businesses`:
//  - suscripción pagada  -> pone el plan del negocio (Pro / Referente)
//  - pack Impulsar pagado -> suma saldo de Impulsar (meta.impulsar_saldo)
//  - suscripción cancelada -> vuelve a plan gratis ('verificada')
// Usa la SERVICE ROLE key (solo servidor). Verifica la firma del webhook.

import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// price id -> slug de plan que ENTIENDE el panel.
// El panel usa hoy: verificada (gratis) / activacion / ciudad / red.
//   Pro       -> "activacion"   Referente -> "ciudad"
// (Rellenar con los price IDs reales de Pro y Referente, mensual y anual.)
const PLAN_POR_PRICE: Record<string, string> = {
  // [Deno.env.get("STRIPE_PRICE_PRO_MENSUAL")!]:       "activacion",
  // [Deno.env.get("STRIPE_PRICE_PRO_ANUAL")!]:         "activacion",
  // [Deno.env.get("STRIPE_PRICE_REFERENTE_MENSUAL")!]: "ciudad",
  // [Deno.env.get("STRIPE_PRICE_REFERENTE_ANUAL")!]:   "ciudad",
};
function planDePrice(priceId?: string): string {
  const env = {
    [Deno.env.get("STRIPE_PRICE_PRO_MENSUAL") ?? "_"]: "activacion",
    [Deno.env.get("STRIPE_PRICE_PRO_ANUAL") ?? "_"]: "activacion",
    [Deno.env.get("STRIPE_PRICE_REFERENTE_MENSUAL") ?? "_"]: "ciudad",
    [Deno.env.get("STRIPE_PRICE_REFERENTE_ANUAL") ?? "_"]: "ciudad",
  };
  return (priceId && env[priceId]) || "activacion";
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, WH_SECRET);
  } catch (e) {
    return new Response(`firma inválida: ${(e as Error).message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const bizId = s.client_reference_id || (s.metadata?.business_id ?? "");
      if (bizId) {
        const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 1 });
        const priceId = items.data[0]?.price?.id;

        if (s.mode === "subscription") {
          const plan = planDePrice(priceId);
          await supa.from("businesses")
            .update({ plan, stripe_customer: s.customer as string })
            .eq("id", bizId);
        } else if (s.mode === "payment") {
          // Impulsar: sumar el importe pagado como saldo
          const importe = (s.amount_total ?? 0) / 100;
          const { data } = await supa.from("businesses").select("meta").eq("id", bizId).single();
          const meta = (data?.meta as Record<string, unknown>) ?? {};
          meta.impulsar_saldo = (Number(meta.impulsar_saldo) || 0) + importe;
          await supa.from("businesses").update({ meta }).eq("id", bizId);
        }
      }
    }

    // baja / cancelación de suscripción -> vuelve a gratis
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await supa.from("businesses")
        .update({ plan: "verificada" })
        .eq("stripe_customer", sub.customer as string);
    }
  } catch (e) {
    // 500 hace que Stripe reintente el webhook (bien: no perdemos el pago)
    return new Response(`error procesando: ${(e as Error).message}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
