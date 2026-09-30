// supabase/functions/stripe-webhook/index.ts
// Escucha a Stripe y, al confirmarse un pago, actualiza `businesses`:
//   - suscripción pagada   -> plan_tier (comercial) + plan (frecuencia de feed) + stripe_customer
//   - cliente extra pagado  -> suma saldo de extras (meta.extra_saldo)
//   - suscripción cancelada -> vuelve a 'alta' / 'verificada'
// Usa la SERVICE ROLE key (solo servidor). Verifica la firma del webhook.
//
// DOS COLUMNAS, A PROPÓSITO (ver migración 20260930120000):
//   · plan_tier = tramo COMERCIAL (lo que gatea el panel): alta|p15|p49|p99|p199|medida
//   · plan      = FRECUENCIA de feed que lee la app YA DESPLEGADA (no se puede renombrar
//                 sin romper el feed de los negocios de pago en los iPhone instalados)
// El webhook es el ÚNICO sitio que mueve ambas (el cliente las tiene congeladas por trigger).

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

// price id -> { tramo comercial, frecuencia de feed }.
// 15 € no se "propone en su zona" (eso empieza en 49 €, PRECIOS-NYXA.md) -> plan feed = verificada.
function tramoDePrice(priceId?: string): { tier: string; plan: string } {
  const map: Record<string, { tier: string; plan: string }> = {
    [Deno.env.get("STRIPE_PRICE_P15") ?? "_15"]:  { tier: "p15",  plan: "verificada" },
    [Deno.env.get("STRIPE_PRICE_P49") ?? "_49"]:  { tier: "p49",  plan: "activacion" },
    [Deno.env.get("STRIPE_PRICE_P99") ?? "_99"]:  { tier: "p99",  plan: "ciudad" },
    [Deno.env.get("STRIPE_PRICE_P199") ?? "_199"]:{ tier: "p199", plan: "red" },
  };
  return (priceId && map[priceId]) || { tier: "p49", plan: "activacion" };
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
          const { tier, plan } = tramoDePrice(priceId);
          await supa.from("businesses")
            .update({ plan_tier: tier, plan, stripe_customer: s.customer as string })
            .eq("id", bizId);
        } else if (s.mode === "payment") {
          // Cliente extra (7,50 €): sumar unidades pagadas como saldo de extras.
          const qty = items.data[0]?.quantity ?? 1;
          const { data } = await supa.from("businesses").select("meta").eq("id", bizId).single();
          const meta = (data?.meta as Record<string, unknown>) ?? {};
          meta.extra_saldo = (Number(meta.extra_saldo) || 0) + qty;
          await supa.from("businesses").update({ meta }).eq("id", bizId);
        }
      }
    }

    // baja / cancelación de suscripción -> vuelve a 'alta' (sin plan de pago)
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await supa.from("businesses")
        .update({ plan_tier: "alta", plan: "verificada" })
        .eq("stripe_customer", sub.customer as string);
    }
  } catch (e) {
    // 500 hace que Stripe reintente el webhook (bien: no perdemos el pago)
    return new Response(`error procesando: ${(e as Error).message}`, { status: 500 });
  }

  return new Response("ok", { status: 200 });
});
