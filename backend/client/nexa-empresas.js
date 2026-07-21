/* ============================================================================
 * NEXA · Empresas — SDK de cliente (el puente panel/registro ↔ Supabase)
 * ----------------------------------------------------------------------------
 * DOS MODOS, un mismo API:
 *   · MOCK (por defecto, sin config): usa localStorage. Es EXACTAMENTE lo que
 *     hace hoy el panel en demo. No carga red. Sirve para enseñar sin backend.
 *   · REAL (con window.NEXA_EMPRESAS_CONFIG): usa Supabase de verdad — login por
 *     enlace mágico, empresa real, métricas reales, mejora de plan real.
 *
 * Para pasar de mock a real, David solo pega esto antes de este script:
 *   <script>window.NEXA_EMPRESAS_CONFIG={
 *     supabaseUrl:"https://xxxx.supabase.co", supabaseAnonKey:"eyJ..." };</script>
 *
 * No hay claves en este archivo. Nunca.
 * ========================================================================== */
(function () {
  "use strict";
  const CFG = window.NEXA_EMPRESAS_CONFIG || null;
  const LS = "nexa_empresa";
  const readLS = () => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } };
  const writeLS = (o) => { try { localStorage.setItem(LS, JSON.stringify(o)); } catch {} };

  // --------------------------------------------------------------------------
  // MODO MOCK
  // --------------------------------------------------------------------------
  const Mock = {
    real: false,
    async account() { return readLS(); },
    async login(email) {
      const c = readLS();
      if (c) return { ok: true, account: c };
      return { ok: false, error: "sin_cuenta" };
    },
    async signup(data) {
      const cuenta = { ...data, plan: "verificada", creada: Date.now() };
      writeLS(cuenta);
      return { ok: true, account: cuenta };
    },
    async metrics() { return null; }, // empresa nueva = sin datos
    async upgrade(plan) {
      const c = readLS() || {};
      c.plan = plan; writeLS(c);
      return { ok: true, mock: true, plan };
    },
  };

  // --------------------------------------------------------------------------
  // MODO REAL (Supabase)
  // --------------------------------------------------------------------------
  function Real(sb) {
    const fn = (name, opts = {}) => sb.functions.invoke(name, opts);
    return {
      real: true,
      async account() {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return null;
        const { data: mem } = await sb.from("business_members").select("business_id").limit(1).maybeSingle();
        if (!mem) return null;
        const { data: biz } = await sb.from("businesses").select("*").eq("id", mem.business_id).maybeSingle();
        const { data: sub } = await sb.from("business_subscriptions").select("plan").eq("business_id", mem.business_id).maybeSingle();
        return biz ? { nombre: biz.name, plan: sub?.plan || "verificada", ciudad: biz.city_id,
                       categoria: biz.category, persona: user.email, business_id: biz.id } : null;
      },
      // Login por enlace mágico (sin contraseñas)
      async login(email) {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + "/panel" } });
        return error ? { ok: false, error: error.message } : { ok: "magic_link" };
      },
      // Alta: primero sesión (magic link), luego crear empresa
      async signup(data) {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { await this.login(data.email); return { ok: "magic_link" }; }
        const { data: r, error } = await fn("business-signup", { body: data });
        if (error) return { ok: false, error: error.message };
        return { ok: true, account: await this.account(), ...r };
      },
      async metrics(days = 30) {
        const { data, error } = await fn("business-metrics", { body: { days } });
        return error ? null : data;
      },
      async upgrade(plan) {
        const { data, error } = await fn("plan-checkout", { body: { plan } });
        if (error) return { ok: false, error: error.message };
        if (data?.url) { location.href = data.url; return { ok: true, redirect: true }; } // Stripe real
        return { ok: true, mock: !!data?.mock, plan };                                     // mock: ya aplicado
      },
    };
  }

  // --------------------------------------------------------------------------
  // Arranque
  // --------------------------------------------------------------------------
  async function boot() {
    let api = Mock;
    if (CFG && CFG.supabaseUrl && CFG.supabaseAnonKey) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      api = Real(createClient(CFG.supabaseUrl, CFG.supabaseAnonKey));
    }
    window.NEXAEmpresas = api;

    // Si el panel expone su hook y estamos en modo real, hidratamos con datos reales.
    if (api.real && window.NEXA_PANEL) {
      const acc = await api.account();
      if (acc) {
        window.NEXA_PANEL.setCuenta(acc);
        const m = await api.metrics(30);
        if (m) window.NEXA_PANEL.aplicarDatos(m);
      }
    }
    window.dispatchEvent(new CustomEvent("nexa-empresas-ready", { detail: { real: api.real } }));
  }
  boot();
})();
