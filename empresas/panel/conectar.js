/* ═══════════════════════════════════════════════════════════════════════════
   PANEL DE EMPRESAS · conexión con NYXA

   Hasta ahora el panel era una maqueta: todo vivía en localStorage. Esto le
   añade lo primero de verdad:

     1. Entrar con la cuenta de empresa (enlace por correo, sin contraseñas).
     2. Traer del servidor el negocio, su plan y las cifras del mes, llamando
        a panel_datos(), que ya existe en producción desde el 30-sep.

   Lo que el plan NO ha pagado no viaja: panel_datos() es SECURITY DEFINER y
   omite del JSON las secciones que no tocan. El bloqueo vive en el servidor.

   Si no hay sesión, o si algo falla, el panel sigue funcionando en modo
   ejemplo exactamente como antes. Nada de esto rompe la demo.
   ═══════════════════════════════════════════════════════════════════════════ */
(() => {
  const CFG = window.NEXA || {};
  const LISTO = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const API = {
    sesion: null, negocio: null, error: null,
    get conectado() { return !!this.negocio; }
  };
  window.NYXA_API = API;

  if (!LISTO) { API.error = 'sin-config'; avisar(); return; }

  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  API.sb = sb;

  /* ── Traer los datos reales ──────────────────────────────────────────── */
  async function traer() {
    const { data, error } = await sb.rpc('panel_datos');
    if (error) { API.error = error.message; return null; }
    if (!data || data.sin_negocio) { API.error = 'sin-negocio'; return null; }
    API.error = null;
    return data;
  }

  /* ── Volcar lo real sobre el estado del panel ────────────────────────── */
  /* El panel declara S, save y show con const/let en su propio script, asi que
     no viven en window: se leen por nombre, que si es alcanzable desde aqui. */
  const elEstado = () => { try { return S; } catch (e) { return null; } };
  const guardar  = () => { try { save(); } catch (e) {} };
  const pintar   = () => { try { show(); } catch (e) {} };

  function volcar(d) {
    const S = elEstado();
    if (!S || !S.biz || !d) return;
    const n = d.negocio || {}, p = d.plan || {}, m = d.mes || {};
    if (n.nombre)   S.biz.n = n.nombre;
    if (n.ciudad)   S.biz.c = n.ciudad;
    if (n.categoria) S.biz.s = n.categoria;
    if (p.tier && p.tier !== 'alta') S.biz.tier = p.tier;
    // 'dentro' | 'premium' | 'ultra' son los mismos slugs que usa el panel.
    if (['dentro','premium','ultra'].includes(p.tier)) S.plan = p.tier;
    S.real = { nivel: p.nivel ?? null, incluido: p.incluido ?? null,
               precio: p.precio ?? null, mes: m, cuando: Date.now() };
    API.negocio = n;
    guardar();
  }

  /* ── La banda de arriba dice la verdad ───────────────────────────────── */
  function avisar() {
    const banda = document.querySelector('.demo');
    if (!banda) return;
    if (API.conectado) {
      banda.innerHTML = '<b>' + esc(API.negocio.nombre || 'Tu negocio') + '</b>'
        + ' · datos reales de NYXA.'
        + ' <button id="salirEmp">Salir</button>';
      banda.style.background = '#0b2a6b';
      const b = document.getElementById('salirEmp');
      if (b) b.onclick = async () => { await sb.auth.signOut(); location.reload(); };
      return;
    }
    const motivo = API.error === 'sin-negocio'
      ? ' Esta cuenta no tiene ningún negocio dado de alta.'
      : API.error === 'sin-config' ? '' : '';
    banda.innerHTML = '<b>Vista previa</b> · datos de ejemplo'
      + '<a class="cta" href="/empresas/alta/">Quiero mi panel</a>'
      + (API.error === 'sin-config' ? '' : '<button id="entrarEmp">Ya tengo cuenta</button>')
      + '<button id="reset">Reiniciar</button>';
    const e = document.getElementById('entrarEmp');
    if (e) e.onclick = entrar;
    const r = document.getElementById('reset');
    if (r) r.onclick = () => { try { localStorage.removeItem('nyxa_panel_v2'); } catch (x) {} location.reload(); };
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ── Entrar: enlace por correo, sin contraseñas ──────────────────────── */
  async function entrar() {
    const email = prompt('Tu correo de empresa en NYXA:');
    if (!email) return;
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: location.origin + '/empresas/panel/' }
    });
    const banda = document.querySelector('.demo');
    if (banda) {
      banda.innerHTML = error
        ? '<b>No se ha podido enviar el enlace.</b> ' + esc(error.message)
        : '<b>Te hemos enviado un enlace a ' + esc(email.trim()) + '.</b> Ábrelo en este mismo navegador.';
    }
  }

  /* ── Dar de alta el negocio de verdad ────────────────────────────────
     El servidor ya lo permite desde el 23-jul: una cuenta autenticada puede
     crear SU negocio si el email coincide. El plan y el "verificado" los
     congela el servidor, no se mandan desde aquí.
     Devuelve {ok:true} o {ok:false, motivo:'...'} — nunca lanza. */
  API.altaNegocio = async function () {
    const S = elEstado();
    if (!S || !S.biz) return { ok:false, motivo:'El panel no está listo.' };
    const { data:{ session } } = await sb.auth.getSession();
    if (!session) return { ok:false, motivo:'Entra con tu cuenta de empresa antes de darte de alta.' };

    const email = (session.user && session.user.email || '').toLowerCase();
    if (!email) return { ok:false, motivo:'Esa sesión no tiene correo.' };

    const nombre = (S.biz.n || '').trim();
    if (!nombre) return { ok:false, motivo:'Falta el nombre del negocio.' };

    // Si ya existe, no se duplica: se actualiza la ficha.
    const d = await traer();
    if (d && d.negocio && d.negocio.id) {
      const { error } = await sb.from('businesses')
        .update({ name: nombre, city_id: S.biz.c || null, category: S.biz.s || null })
        .eq('id', d.negocio.id);
      if (error) return { ok:false, motivo: error.message };
      volcar(await traer()); avisar();
      return { ok:true, actualizado:true };
    }

    const { error } = await sb.from('businesses').insert({
      owner_email: email,
      name: nombre,
      city_id: S.biz.c || null,
      category: S.biz.s || null,
      plan: 'verificada',   // lo exige la política de alta
      verified: false       // lo exige la política de alta
    });
    if (error) return { ok:false, motivo: error.message };

    const nuevo = await traer();
    if (nuevo) { volcar(nuevo); avisar(); }
    return { ok:true, creado:true };
  };

  /* ── Pagar la cuota ───────────────────────────────────────────────────
     Llama a la Edge Function crear-checkout, que devuelve la URL de Stripe
     Checkout, y lleva allí. La clave secreta de Stripe vive solo en esa
     función: aquí no hay ninguna.
     Devuelve {ok:false, motivo} si algo falla; nunca lanza. */
  API.suscribir = async function (plan) {
    const PLANES = ['dentro', 'premium', 'ultra'];
    if (!PLANES.includes(plan)) return { ok:false, motivo:'Plan desconocido: ' + plan };

    const { data:{ session } } = await sb.auth.getSession();
    if (!session) return { ok:false, motivo:'Entra con tu cuenta de empresa antes de contratar.' };

    const d = await traer();
    if (!d || !d.negocio || !d.negocio.id)
      return { ok:false, motivo:'Primero da de alta tu negocio.' };

    let r;
    try {
      r = await fetch(CFG.SUPABASE_URL + '/functions/v1/crear-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token,
          'apikey': CFG.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          producto: plan,
          business_id: d.negocio.id,
          email: (session.user && session.user.email) || undefined
        })
      });
    } catch (e) {
      return { ok:false, motivo:'No se ha podido contactar con el servidor de pagos.' };
    }

    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j || !j.url)
      return { ok:false, motivo: (j && j.error) || ('El servidor de pagos respondió ' + r.status) };

    location.href = j.url;      // a Stripe
    return { ok:true, url:j.url };
  };

  /* Si se vuelve de Stripe, decirlo y refrescar el plan desde el servidor. */
  async function volverDeStripe() {
    const p = new URLSearchParams(location.search).get('pago');
    if (!p) return;
    const banda = document.querySelector('.demo');
    if (p === 'ok') {
      const d = await traer();
      if (d) { volcar(d); avisar(); }
      if (banda) banda.innerHTML = '<b>Pago hecho.</b> Tu plan se activa en cuanto Stripe nos lo confirme.';
    } else if (p === 'cancelado' && banda) {
      banda.innerHTML = '<b>Pago cancelado.</b> No se ha cobrado nada.';
    }
    history.replaceState({}, '', location.pathname);
  }

  /* ── Arranque ────────────────────────────────────────────────────────── */
  async function arrancar() {
    const { data: { session } } = await sb.auth.getSession();
    API.sesion = session;
    if (session) {
      const d = await traer();
      if (d) volcar(d);
    }
    avisar();
    await volverDeStripe();
    if (API.conectado) pintar();
  }

  if (document.readyState === 'loading')
    addEventListener('DOMContentLoaded', () => setTimeout(arrancar, 0));
  else setTimeout(arrancar, 0);

  sb.auth.onAuthStateChange((_e, s) => { if (s && !API.conectado) arrancar(); });
})();
