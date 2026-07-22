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
        // Equipo real: todos los miembros de la empresa (source of truth: business_members).
        const { data: miembros } = await sb.from("business_members").select("member_email,role").eq("business_id", mem.business_id);
        const m = biz && biz.meta || {};
        return biz ? {
          nombre: biz.name, plan: (sub && sub.plan) || "verificada", ciudad: biz.city_id,
          categoria: biz.category, descripcion: biz.descripcion, web: biz.web, ig: biz.instagram,
          horario: m.horario || "", persona: user.email, email: user.email,
          business_id: biz.id, verified: biz.verified, verif_pendiente: !!m.verif_pendiente,
          // colecciones editables (perfil/experiencias/objetivo/sedes en meta; equipo en tabla real)
          experiencias: m.experiencias || [], objetivo: m.objetivo || null, sedes: m.sedes || [],
          equipo: (miembros || []).filter((x) => x.member_email !== user.email).map((x) => ({ email: x.member_email, rol: x.role })),
        } : null;
      },
      // Persiste el perfil y las colecciones editables en Supabase (RLS: solo miembros).
      // El equipo NO va aquí: es una tabla real (invita/quita miembros).
      async saveProfile(c) {
        if (!c || !c.business_id) return { ok: false };
        const meta = {
          horario: c.horario || "",
          experiencias: c.experiencias || [],
          objetivo: c.objetivo || null,
          sedes: c.sedes || [],
        };
        const { error } = await sb.from("businesses").update({
          name: c.nombre, category: c.categoria, descripcion: c.descripcion,
          web: c.web, instagram: c.ig, meta,
        }).eq("id", c.business_id);
        return { ok: !error, error: error && error.message };
      },
      // Equipo real: invita (crea acceso al panel) y quita miembros de la empresa.
      async _bid() {
        if (this.__bid) return this.__bid;
        const { data: mem } = await sb.from("business_members").select("business_id").limit(1).maybeSingle();
        this.__bid = mem && mem.business_id;
        return this.__bid;
      },
      async inviteMember(email, rol) {
        const bid = await this._bid(); if (!bid) return { ok: false, error: "sin_empresa" };
        const role = ["admin", "editor", "viewer"].includes(rol) ? rol : "editor";
        const { error } = await sb.from("business_members").insert({
          business_id: bid, member_email: String(email || "").trim().toLowerCase(), role,
        });
        if (error && /duplicate|unique/i.test(error.message)) return { ok: false, error: "Ese email ya está en el equipo." };
        return { ok: !error, error: error && error.message };
      },
      async removeMember(email) {
        const bid = await this._bid(); if (!bid) return { ok: false, error: "sin_empresa" };
        const { error } = await sb.from("business_members").delete()
          .eq("business_id", bid).eq("member_email", String(email || "").trim().toLowerCase());
        return { ok: !error, error: error && error.message };
      },
      // Verificación: la empresa SOLICITA (marca pendiente). NUNCA se auto-verifica:
      // la columna 'verified' está protegida a nivel de columna (solo admin la cambia).
      async requestVerification() {
        const bid = await this._bid(); if (!bid) return { ok: false, error: "sin_empresa" };
        const { data: biz } = await sb.from("businesses").select("meta,verified").eq("id", bid).maybeSingle();
        if (biz && biz.verified) return { ok: true, already: true };
        const meta = Object.assign({}, biz && biz.meta, { verif_pendiente: true, verif_fecha: new Date().toISOString() });
        const { error } = await sb.from("businesses").update({ meta }).eq("id", bid);
        return { ok: !error, error: error && error.message };
      },
      // Acceso instantáneo con email + contraseña (sin confirmación por email)
      async login(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        return error ? { ok: false, error: error.message } : { ok: true, account: await this.account() };
      },
      // Registro: crea usuario (sesión inmediata) y luego la empresa
      async signup(data) {
        let { error: serr } = await sb.auth.signUp({ email: data.email, password: data.password });
        if (serr && /already|registered|exist/i.test(serr.message)) {
          const { error: le } = await sb.auth.signInWithPassword({ email: data.email, password: data.password });
          if (le) return { ok: false, error: "Ese email ya tiene cuenta. Revisa la contraseña o entra desde 'Ya soy empresa'." };
        } else if (serr) {
          return { ok: false, error: serr.message };
        }
        // ACEPTAR INVITACIÓN: si este email ya es miembro de una empresa (le invitaron),
        // entra a ESA empresa; NO se crea una nueva.
        const { data: yaMiembro } = await sb.from("business_members").select("business_id").limit(1).maybeSingle();
        if (yaMiembro) return { ok: true, account: await this.account(), invitado: true };
        const { password, ...biz } = data;   // la contraseña no sale al backend de negocio
        const { data: r, error } = await inv("business-signup", { body: biz });
        if (error) return { ok: false, error: error.message };
        if (r && r.error && r.error !== "ya_tienes_empresa") return { ok: false, error: r.error };
        return { ok: true, account: await this.account() };
      },
      // Compat: si hay sesión, devuelve la cuenta
      async completeSignupIfPending() {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) return null;
        return this.account();
      },
      async metrics(days = 30, opts) {
        days = +days || 30;
        const force = opts && opts.force;
        // Caché por rango (60 s): volver a 7/30/90 ya cargado es instantáneo.
        this.__mc = this.__mc || {};
        const hit = this.__mc[days];
        if (!force && hit && (Date.now() - hit.t) < 60000) return hit.d;
        // Todo en paralelo: business-metrics + las 4 RPC arrancan a la vez (no en fila).
        const bid = await this._bid();
        const baseP = inv("business-metrics", { body: { days } });
        const rpcP = bid ? Promise.all([
          sb.rpc("get_business_series", { bid, days }),
          sb.rpc("get_business_prev", { bid, days }),
          sb.rpc("get_business_experiences", { bid, days }),
          sb.rpc("get_business_sedes", { bid, days }),
        ]) : Promise.resolve(null);
        let baseRes, rpcRes;
        try { [baseRes, rpcRes] = await Promise.all([baseP, rpcP]); }
        catch (e) { return null; }
        if (!baseRes || baseRes.error || !baseRes.data) return null;
        const data = baseRes.data;
        if (rpcRes && rpcRes.length === 4) {
          if (rpcRes[0] && rpcRes[0].data) data.series = rpcRes[0].data;
          if (rpcRes[1] && rpcRes[1].data) data.prev = rpcRes[1].data;
          if (rpcRes[2] && rpcRes[2].data) data.porExperiencia = rpcRes[2].data;
          if (rpcRes[3] && rpcRes[3].data) data.porSede = rpcRes[3].data;
        }
        this.__mc[days] = { t: Date.now(), d: data };
        return data;
      },
      // Invalida la caché de métricas (tras editar algo que las afecta).
      _clearMetrics() { this.__mc = {}; },
      async upgrade(plan, period) {
        const { data, error } = await inv("plan-checkout", { body: { plan, period: period || "mes" } });
        if (error) return { ok: false, error: error.message };
        if (data && data.url) { location.href = data.url; return { ok: true, redirect: true }; }
        return { ok: true, mock: !!(data && data.mock), plan };
      },
      async logout() { try { await sb.auth.signOut(); } catch {} },
    };
  }

  // Carga el SDK de Supabase con tolerancia a fallos de CDN.
  // Un blip puntual de un CDN no debe tumbar el panel: probamos varios y reintentamos.
  async function importSupabase() {
    const cdns = [
      "https://esm.sh/@supabase/supabase-js@2",
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm",
      "https://cdn.skypack.dev/@supabase/supabase-js@2",
    ];
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const url of cdns) {
        try { const m = await import(url); if (m && m.createClient) return m; } catch (e) { /* prueba el siguiente */ }
      }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
    throw new Error("supabase_cdn_unreachable");
  }

  async function boot() {
    let api = Mock;
    if (CFG && CFG.supabaseUrl && CFG.supabaseAnonKey) {
      try {
        const { createClient } = await importSupabase();
        api = Real(createClient(CFG.supabaseUrl, CFG.supabaseAnonKey));
      } catch (e) {
        // No pudimos cargar el SDK real tras varios reintentos. NO caemos a modo
        // demo (confundiría al negocio): avisamos y reintentamos el arranque.
        console.error("[NEXA] No se pudo cargar el SDK de Supabase:", e && e.message);
        window.NEXAEmpresas = { real: true, loadError: true, login: async () => ({ ok: false, error: "No hay conexión con el servidor. Reintentando…" }), account: async () => null, metrics: async () => null };
        const P0 = window.NEXA_PANEL; if (P0 && P0.showGate) P0.showGate();
        setTimeout(boot, 3000);
        return;
      }
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
          // Precarga en segundo plano: al pulsar 7d/90d ya estarán listos (instantáneo).
          if (api.metrics) { setTimeout(() => { api.metrics(7); api.metrics(90); }, 400); }
        } else if (P.showGate) { P.showGate(); }
      } catch (e) { if (P.showGate) P.showGate(); }
    }
    window.dispatchEvent(new CustomEvent("nexa-empresas-ready", { detail: { real: api.real } }));
  }
  boot();
})();
