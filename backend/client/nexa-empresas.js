/* ============================================================================
 * NEXA · Empresas — SDK de cliente (puente panel/registro ↔ Supabase)
 * ----------------------------------------------------------------------------
 * MOCK (sin config): localStorage, la demo de siempre.
 * REAL (con NEXA_EMPRESAS_CONFIG): Supabase — login por enlace mágico,
 *   empresa real, métricas reales (Edge Functions + RPC), mejora de plan.
 * Sin claves secretas en este archivo. Nunca.
 * ========================================================================== */
(function () {
  "use strict";
  const CFG = window.NEXA_EMPRESAS_CONFIG || null;
  const LS = "nexa_empresa";
  const readLS = () => { try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch { return null; } };
  const writeLS = (o) => { try { localStorage.setItem(LS, JSON.stringify(o)); } catch {} };

  /* ── MOCK ── */
  const Mock = {
    real: false,
    async account() { return readLS(); },
    async login() { const c = readLS(); return c ? { ok: true, account: c } : { ok: false, error: "sin_cuenta" }; },
    async signup(data) { const c = { ...data, plan: "verificada", creada: Date.now() }; writeLS(c); return { ok: true, account: c }; },
    async signupPending(data) { return this.signup(data); },
    async metrics() { return null; },
    async upgrade(plan) { const c = readLS() || {}; c.plan = plan; writeLS(c); return { ok: true, mock: true, plan }; },
    async logout() {},
  };

  /* ── REAL (Supabase) ── */
  function Real(sb) {
    const inv = (name, opts = {}) => sb.functions.invoke(name, opts);
    return {
      real: true, sb,
      async account() {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return null;
        const { data: mem } = await sb.from("business_members").select("business_id").limit(1).maybeSingle();
        if (!mem) return null;
        const { data: biz } = await sb.from("businesses").select("*").eq("id", mem.business_id).maybeSingle();
        const { data: sub } = await sb.from("business_subscriptions").select("plan").eq("business_id", mem.business_id).maybeSingle();
        return biz ? {
          nombre: biz.name, plan: (sub && sub.plan) || "verificada", ciudad: biz.city_id,
          categoria: biz.category, descripcion: biz.descripcion, web: biz.web, ig: biz.instagram,
          horario: (biz.meta && biz.meta.horario) || "", persona: user.email, email: user.email,
          business_id: biz.id, verified: biz.verified,
        } : null;
      },
      // Login / registro por enlace mágico (sin contraseñas)
      async login(email) {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + "/panel" } });
        return error ? { ok: false, error: error.message } : { ok: "magic_link" };
      },
      // Guarda los datos del registro y envía el enlace; la empresa se crea al volver
      async signupPending(data) {
        try { localStorage.setItem("nexa_pending", JSON.stringify(data)); } catch {}
        return this.login(data.email);
      },
      // Al volver del email: si hay sesión y datos pendientes, crea la empresa
      async completeSignupIfPending() {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return null;
        let acc = await this.account();
        if (!acc) {
          let p = null; try { p = JSON.parse(localStorage.getItem("nexa_pending") || "null"); } catch {}
          if (p) { await inv("business-signup", { body: p }); localStorage.removeItem("nexa_pending"); acc = await this.account(); }
        }
        return acc;
      },
      async metrics(days = 30) { const { data, error } = await inv("business-metrics", { body: { days } }); return error ? null : data; },
      async upgrade(plan) {
        const { data, error } = await inv("plan-checkout", { body: { plan } });
        if (error) return { ok: false, error: error.message };
        if (data && data.url) { location.href = data.url; return { ok: true, redirect: true }; }
        return { ok: true, mock: !!(data && data.mock), plan };
      },
      async logout() { try { await sb.auth.signOut(); } catch {} },
    };
  }

  async function boot() {
    let api = Mock;
    if (CFG && CFG.supabaseUrl && CFG.supabaseAnonKey) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      api = Real(createClient(CFG.supabaseUrl, CFG.supabaseAnonKey));
    }
    window.NEXAEmpresas = api;

    // Hidratar el panel en modo real (el panel expone window.NEXA_PANEL)
    const P = window.NEXA_PANEL;
    if (api.real && P) {
      try {
        const acc = await api.completeSignupIfPending();
        if (acc) {
          P.setCuenta(acc); if (P.hideGate) P.hideGate();
          const m = await api.metrics(30); if (m && P.aplicarDatos) P.aplicarDatos(m);
        } else if (P.showGate) { P.showGate(); }
      } catch (e) { if (P.showGate) P.showGate(); }
    }
    window.dispatchEvent(new CustomEvent("nexa-empresas-ready", { detail: { real: api.real } }));
  }
  boot();
})();
