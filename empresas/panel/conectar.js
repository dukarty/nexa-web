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
    banda.innerHTML = '<b>Prototipo del panel</b> · los datos se quedan en este '
      + 'navegador y no se envían a ningún sitio.' + motivo
      + (API.error === 'sin-config' ? '' : ' <button id="entrarEmp">Entrar con mi cuenta de empresa</button>')
      + ' <button id="reset">Empezar de cero</button>';
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

  /* ── Arranque ────────────────────────────────────────────────────────── */
  async function arrancar() {
    const { data: { session } } = await sb.auth.getSession();
    API.sesion = session;
    if (session) {
      const d = await traer();
      if (d) volcar(d);
    }
    avisar();
    if (API.conectado) pintar();
  }

  if (document.readyState === 'loading')
    addEventListener('DOMContentLoaded', () => setTimeout(arrancar, 0));
  else setTimeout(arrancar, 0);

  sb.auth.onAuthStateChange((_e, s) => { if (s && !API.conectado) arrancar(); });
})();
