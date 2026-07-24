/* ============================================================================
 * NEXA · Empresas — SDK de cliente (puente panel/registro ↔ Supabase)
 * ----------------------------------------------------------------------------
 * MOCK (sin config): localStorage, la demo de siempre.
 * REAL (con NEXA_EMPRESAS_CONFIG): Supabase, SOBRE EL ESQUEMA DE LA APP.
 *   El cliente escribe y LEE la misma tabla `businesses` de la app, por
 *   `owner_email`, con el perfil ampliado en `meta` (jsonb). SIN Edge Functions
 *   ni business_members/business_subscriptions (la caja negra que derivó y
 *   rompía el alta). La RLS garantiza que un negocio solo toca lo suyo y NUNCA
 *   se auto-asigna plan ni verificación (lo congela un trigger en la BD).
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
    async resetPassword() { return { ok: false, error: "La recuperación por correo solo funciona con el backend real." }; },
    async setNewPassword() { return { ok: true }; },
    async signup(data) { const c = { ...data, plan: "verificada", creada: Date.now() }; writeLS(c); return { ok: true, account: c }; },
    async signupPending(data) { return this.signup(data); },
    async metrics() { return null; },
    async upgrade(plan) { const c = readLS() || {}; c.plan = plan; writeLS(c); return { ok: true, mock: true, plan }; },
    async listExperiences() { const c = readLS() || {}; return c.experiencias || []; },
    async addExperience(e) { const c = readLS() || {}; c.experiencias = c.experiencias || []; c.experiencias.unshift({ id: Date.now(), titulo: e.titulo, cat: e.cat, franja: e.franja, estado: "publicada" }); writeLS(c); return { ok: true }; },
    async removeExperience(id) { const c = readLS() || {}; c.experiencias = (c.experiencias || []).filter((x) => String(x.id) !== String(id)); writeLS(c); return { ok: true }; },
    async setFeatured(id, on) { const c = readLS() || {}; c.experiencias = (c.experiencias || []).map((x) => String(x.id) === String(id) ? { ...x, featured: !!on } : x); writeLS(c); return { ok: true, featured: !!on }; },
    async logout() {},
  };

  /* ── REAL (Supabase, sobre el esquema de la app) ── */
  function Real(sb) {
    const norm = (e) => String(e || "").trim().toLowerCase();
    async function miEmail() {
      const { data: { user } } = await sb.auth.getUser();
      return user ? norm(user.email) : null;
    }
    async function miNegocio() {
      const email = await miEmail(); if (!email) return null;
      const { data } = await sb.from("businesses").select("*").eq("owner_email", email)
        .order("created_at", { ascending: true }).limit(1);
      return (data && data[0]) || null;
    }
    function aCuenta(biz, email) {
      if (!biz) return null;
      const m = biz.meta || {};
      return {
        nombre: biz.name, plan: biz.plan || "verificada", ciudad: biz.city_id,
        categoria: biz.category, tipo: biz.type, descripcion: biz.descripcion || null,
        web: biz.web || null, ig: biz.instagram || null, horario: m.horario || "",
        persona: email, email, business_id: biz.id,
        verified: !!biz.verified, verif_pendiente: !!m.verif_pendiente,
        experiencias: m.experiencias || [], objetivo: m.objetivo || null, sedes: m.sedes || [],
        equipo: [],
      };
    }
    return {
      real: true, sb,
      async account() {
        const email = await miEmail(); if (!email) return null;
        return aCuenta(await miNegocio(), email);
      },
      async login(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email: norm(email), password });
        return error ? { ok: false, error: error.message } : { ok: true, account: await this.account() };
      },
      // Recuperar contraseña: envía un enlace al correo (necesita SMTP configurado
      // en el proyecto Supabase). El enlace vuelve a /panel con sesión de recuperación.
      async resetPassword(email) {
        const { error } = await sb.auth.resetPasswordForEmail(norm(email), { redirectTo: location.origin + "/panel" });
        return error ? { ok: false, error: error.message } : { ok: true };
      },
      async setNewPassword(password) {
        const { error } = await sb.auth.updateUser({ password });
        return error ? { ok: false, error: error.message } : { ok: true };
      },
      // Registro: crea el usuario (sesión inmediata) y su ficha en `businesses`.
      // Siempre nace plan 'verificada' y sin verificar (lo fuerza la RLS + trigger).
      async signup(data) {
        const email = norm(data.email);
        let { error: serr } = await sb.auth.signUp({ email, password: data.password });
        if (serr && /already|registered|exist/i.test(serr.message)) {
          const { error: le } = await sb.auth.signInWithPassword({ email, password: data.password });
          if (le) return { ok: false, error: "Ese email ya tiene cuenta. Revisa la contraseña o entra desde 'Ya soy empresa'." };
        } else if (serr) {
          return { ok: false, error: serr.message };
        }
        // Asegura sesión (si la confirmación por email estuviera activada, no la habrá).
        let { data: { session } } = await sb.auth.getSession();
        if (!session) {
          const r = await sb.auth.signInWithPassword({ email, password: data.password });
          session = r.data && r.data.session;
          if (!session) return { ok: false, error: "Cuenta creada. Confirma tu correo y entra desde 'Ya soy empresa'." };
        }
        // ¿Ya tiene ficha? (reintento) → entra a la suya, no crea otra.
        const ya = await miNegocio();
        if (ya) return { ok: true, account: aCuenta(ya, email) };
        const meta = {};
        if (data.frase) meta.frase = data.frase;
        if (data.aforo) meta.aforo = data.aforo;
        const tipo = (data.tipo === "marca" || data.tipo === "local") ? data.tipo : null;
        const { error } = await sb.from("businesses").insert({
          owner_email: email, name: data.nombre || "Tu empresa", category: data.categoria || null,
          type: tipo, city_id: norm(data.ciudad) || "valencia",
          descripcion: data.descripcion || null, web: data.web || null, instagram: data.ig || null,
          plan: "verificada", verified: false, meta,
        });
        if (error && error.code !== "23505") return { ok: false, error: error.message };
        return { ok: true, account: await this.account() };
      },
      async signupPending(data) { return this.signup(data); },
      // Compat con el boot: si hay sesión, devuelve la cuenta.
      async completeSignupIfPending() {
        const email = await miEmail(); if (!email) return null;
        return aCuenta(await miNegocio(), email);
      },
      // Guarda perfil + colecciones (todo en `businesses`/`meta`). No toca plan/verified.
      async saveProfile(c) {
        if (!c) return { ok: false };
        const email = await miEmail(); if (!email) return { ok: false, error: "sin_sesion" };
        const meta = { horario: c.horario || "", experiencias: c.experiencias || [], objetivo: c.objetivo || null, sedes: c.sedes || [] };
        if (c.frase) meta.frase = c.frase;
        if (c.aforo) meta.aforo = c.aforo;
        const { error } = await sb.from("businesses").update({
          name: c.nombre, category: c.categoria, descripcion: c.descripcion,
          web: c.web, instagram: c.ig, meta,
        }).eq("owner_email", email);
        return { ok: !error, error: error && error.message };
      },
      // Experiencias del negocio: por ahora viven en meta.experiencias (cliente).
      async listExperiences() {
        const biz = await miNegocio();
        return (biz && biz.meta && biz.meta.experiencias) || [];
      },
      async addExperience(e) {
        const email = await miEmail(); const biz = await miNegocio();
        if (!email || !biz) return { ok: false, error: "sin_empresa" };
        const meta = Object.assign({}, biz.meta);
        meta.experiencias = (meta.experiencias || []).slice();
        const id = "e" + Date.now();
        meta.experiencias.unshift({ id, titulo: e.titulo, cat: e.cat, franja: e.franja, estado: "publicada" });
        const { error } = await sb.from("businesses").update({ meta }).eq("owner_email", email);
        return { ok: !error, id, error: error && error.message };
      },
      async removeExperience(id) {
        const email = await miEmail(); const biz = await miNegocio();
        if (!email || !biz) return { ok: false, error: "sin_empresa" };
        const meta = Object.assign({}, biz.meta);
        meta.experiencias = (meta.experiencias || []).filter((x) => String(x.id) !== String(id));
        const { error } = await sb.from("businesses").update({ meta }).eq("owner_email", email);
        return { ok: !error, error: error && error.message };
      },
      async setFeatured(id, on) {
        const email = await miEmail(); const biz = await miNegocio();
        if (!email || !biz) return { ok: false, error: "sin_empresa" };
        const meta = Object.assign({}, biz.meta);
        meta.experiencias = (meta.experiencias || []).map((x) => String(x.id) === String(id) ? Object.assign({}, x, { featured: !!on }) : x);
        const { error } = await sb.from("businesses").update({ meta }).eq("owner_email", email);
        return { ok: !error, featured: !!on, error: error && error.message };
      },
      // Equipo y roles: fase posterior (necesita su propia tabla). De momento, aviso.
      async inviteMember() { return { ok: false, error: "El equipo llega en la próxima fase." }; },
      async removeMember() { return { ok: false, error: "El equipo llega en la próxima fase." }; },
      // Verificación: la empresa SOLICITA (marca pendiente). NUNCA se auto-verifica
      // (el trigger congela `verified`); la aprueba una persona desde el servidor.
      async requestVerification() {
        const email = await miEmail(); const biz = await miNegocio();
        if (!email || !biz) return { ok: false, error: "sin_empresa" };
        if (biz.verified) return { ok: true, already: true };
        const meta = Object.assign({}, biz.meta, { verif_pendiente: true, verif_fecha: new Date().toISOString() });
        const { error } = await sb.from("businesses").update({ meta }).eq("owner_email", email);
        return { ok: !error, error: error && error.message };
      },
      // Métricas: aún no hay backend de atribución para el panel → el panel muestra
      // sus datos de EJEMPLO (marcados) hasta que se instrumente la atribución real.
      async metrics() { return null; },
      // Pago en mock: el plan NO se cambia desde el cliente (el trigger lo congela);
      // se activará de verdad cuando haya pasarela. Devolvemos ok para el flujo de UI.
      async upgrade(plan) { return { ok: true, mock: true, plan }; },
      async logout() { try { await sb.auth.signOut(); } catch (e) {} },
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
