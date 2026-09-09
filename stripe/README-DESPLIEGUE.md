# Cobro de Empresas con Stripe — despliegue (SOLO web)

> Yo escribo el código; **tú despliegas las Edge Functions y pones la clave secreta** (regla: no toco claves ni corro funciones). La app de iPhone NO lleva pago.

Dos Edge Functions de Supabase:
- **`crear-checkout`** — el panel la llama y devuelve la URL de Stripe Checkout.
- **`stripe-webhook`** — Stripe la llama al confirmar el pago y actualiza `businesses`.

---

## 1. Coger los price IDs (en Stripe → Product catalog → cada producto)
En cada precio: menú `···` → **Copy price ID** (`price_…`).

| Env var | De dónde | 
|---|---|
| `STRIPE_PRICE_PRO_MENSUAL` | Pro · 29 €/mes |
| `STRIPE_PRICE_PRO_ANUAL` | Pro · 290 €/año |
| `STRIPE_PRICE_REFERENTE_MENSUAL` | Referente · 99 €/mes |
| `STRIPE_PRICE_REFERENTE_ANUAL` | Referente · 990 €/año |
| `STRIPE_PRICE_IMPULSAR_120` | Impulsar · 120 € |
| `STRIPE_PRICE_IMPULSAR_55` | Impulsar · 55 € |

## 2. Migración (una columna nueva en `businesses`)
```sql
alter table businesses add column if not exists stripe_customer text;
```
*(El plan ya existe. `impulsar_saldo` vive dentro de `meta` jsonb, no necesita columna.)*

## 3. Secretos de las Edge Functions
```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_XXXX \
  STRIPE_WEBHOOK_SECRET=whsec_XXXX \
  SITE_URL=https://holanyxa.com \
  STRIPE_PRICE_PRO_MENSUAL=price_XXX \
  STRIPE_PRICE_PRO_ANUAL=price_XXX \
  STRIPE_PRICE_REFERENTE_MENSUAL=price_XXX \
  STRIPE_PRICE_REFERENTE_ANUAL=price_XXX \
  STRIPE_PRICE_IMPULSAR_120=price_XXX \
  STRIPE_PRICE_IMPULSAR_55=price_XXX
```
`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase.

## 4. Desplegar
```bash
supabase functions deploy crear-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
```
*(`--no-verify-jwt` en el webhook: lo llama Stripe, no un usuario logueado.)*

## 5. Registrar el webhook en Stripe
Stripe → Developers → Webhooks → **Add endpoint**:
- URL: `https://<tu-proyecto>.supabase.co/functions/v1/stripe-webhook`
- Eventos: `checkout.session.completed`, `customer.subscription.deleted`
- Copia el **Signing secret** (`whsec_…`) al secreto `STRIPE_WEBHOOK_SECRET` (paso 3) y **redeploy**.

## 6. Probar en test (tarjeta `4242 4242 4242 4242`, fecha futura, cualquier CVC)
1. Llama a `crear-checkout` con `{ "producto": "pro_mensual", "business_id": "<id real>" }`.
2. Abre la `url` que devuelve → paga con la tarjeta de test.
3. Comprueba en `businesses` que el `plan` cambió a `activacion` (Pro) y hay `stripe_customer`.
4. Repite con `impulsar_120` → debe subir `meta.impulsar_saldo` en 120.

## 7. Cablear el panel (cuando el backend esté verde)
En `panel.html`, donde hoy hay `upgrade` mock, sustituir por:
```js
async function irAPagar(producto){                 // p.ej. "pro_mensual", "impulsar_120"
  const r = await fetch(`${SUPABASE_URL}/functions/v1/crear-checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ producto, business_id: cuenta.id, email: cuenta.email })
  });
  const { url, error } = await r.json();
  if (url) location.href = url;                     // -> Stripe Checkout
  else toast(error || "No se pudo abrir el pago.");
}
```
Y al volver con `?pago=ok` en la URL, mostrar "¡Listo!" y recargar la cuenta (el webhook ya habrá puesto el plan/saldo).

---

## Notas / a reconciliar (dime y lo ajusto)
- **Slug de plan:** el panel usa hoy `verificada / activacion / ciudad / red`. Mapeo puesto: **Pro → `activacion`**, **Referente → `ciudad`**. Si prefieres cambiar los slugs internos a `pro/referente`, es otra pasada (tocar el panel).
- **Cuándo a real:** todo esto es en **test**. Pasar a live = repetir productos/keys en modo live y cambiar `sk_test`→`sk_live`. **No antes del piloto con ROAS.**
- **Stripe Tax:** dejado `automatic_tax: false`. Activar cuando configures Stripe Tax.
