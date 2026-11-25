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
  /* Esto se tragaba los errores en silencio: `show()` reventaba por una
     categoría desconocida y el panel se quedaba con la demo sin que nadie
     se enterara. Ahora al menos queda dicho en la consola. */
  const pintar   = () => { try { show(); } catch (e) { console.error('[NYXA] no se pudo repintar el panel:', e); } };

  /* El servidor guarda la categoría como texto libre ("Discoteca / Ocio
     nocturno"), y el panel la usa como clave de su tabla de comisiones. Si no
     se traduce, no encuentra nada. Mismo criterio que en la base: lo que no se
     reconoce se queda sin tocar y la comisión cae al 15 %. */
  const SLUGS = ['viajes','turismo','catas','talleres','clases','cenas','ocio','deporte'];
  const PISTAS = [
    [/viaj|escapad|finde/, 'viajes'], [/turismo|aventura|ruta|senderis/, 'turismo'],
    [/cata|bodega|vino|cervez/, 'catas'], [/taller|curso|manualidad/, 'talleres'],
    [/clase|escuela|baile|academ/, 'clases'], [/cena|restaurant|gastro|comida/, 'cenas'],
    [/discotec|ocio|noct|fiesta|concierto|event/, 'ocio'], [/deporte|padel|pádel|running|gimnas|yoga/, 'deporte']
  ];
  function aCodigo(txt) {
    const v = String(txt || '').trim();
    if (!v) return '';
    if (SLUGS.includes(v)) return v;
    const n = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const [re, slug] of PISTAS) if (re.test(n)) return slug;
    return '';
  }

  function volcar(d) {
    const S = elEstado();
    if (!S || !S.biz || !d) return;
    const n = d.negocio || {}, p = d.plan || {}, m = d.mes || {};
    if (n.nombre)   S.biz.n = n.nombre;
    if (n.ciudad)   S.biz.c = n.ciudad;
    if (n.categoria) { const cod = aCodigo(n.categoria); if (cod) S.biz.s = cod; }
    if (p.tier && p.tier !== 'alta') S.biz.tier = p.tier;
    // 'dentro' | 'premium' | 'ultra' son los mismos slugs que usa el panel.
    if (['dentro','premium','ultra'].includes(p.tier)) S.plan = p.tier;
    S.real = { nivel: p.nivel ?? null, incluido: p.incluido ?? null,
               precio: p.precio ?? null, mes: m, cuando: Date.now() };
    API.negocio = n;

    /* Un negocio de verdad no puede estar viendo los planes y las reservas
       de la demo. Si venía del panel de ejemplo, eso se va: lo suyo todavía
       no existe, y un panel vacío es la verdad. */
    if (S.demo) {
      S.demo = false;
      S.plans = []; S.book = []; S.reviews = []; S.promos = []; S.qs = [];
      S.notif = []; S.feat = {}; S.last = {};
      S.stage = 'db';
    }
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
    /* Has entrado, pero esta cuenta todavía no tiene negocio. Antes se
       calculaba este mensaje y NO se usaba: la banda decía «datos de
       ejemplo» y el panel enseñaba un negocio inventado. Para quien acaba
       de pedir su panel, eso no se entiende. */
    if (API.sesion && API.error === 'sin-negocio') {
      const correo = (API.sesion.user && API.sesion.user.email) || 'tu cuenta';
      banda.innerHTML = '<b>Has entrado como ' + esc(correo) + '.</b>'
        + ' Todavía no tienes tu negocio en NYXA.'
        + '<button id="altaEmp" class="cta">Dar de alta mi negocio</button>'
        + '<button id="salirEmp">Salir</button>';
      banda.style.background = '#1b46c2';
      const a = document.getElementById('altaEmp');
      if (a) a.onclick = () => {
        const S = elEstado();
        if (S) { S.stage = 'ob'; S.step = 0; guardar(); pintar(); }
      };
      const s = document.getElementById('salirEmp');
      if (s) s.onclick = async () => { await sb.auth.signOut(); location.reload(); };
      return;
    }

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
  /* ── Entrar · una ventana de verdad, con el mismo molde que el panel ───
     Antes esto era un prompt() del navegador y, después, un recuadro metido
     a presión en la banda de arriba. Ni una cosa ni la otra se parecen al
     resto del panel.

     El correo de Supabase puede traer un ENLACE, un CÓDIGO de 6 cifras o los
     dos, según la plantilla que haya puesta en Supabase — y eso se cambia sin
     tocar este repo. Así que la ventana acepta las dos vías y lo dice. */
  const abrirDrw  = h => { try { openDrw(h); return true; } catch (e) { return false; } };
  const cerrarDrw = () => { try { closeDrw(); } catch (e) {} };

  function pasoCorreo(valor, aviso) {
    const ok = abrirDrw(
      '<h2>Entrar en tu panel</h2>'
      + '<p class="sub">Te mandamos un acceso por correo. Sin contraseñas.</p>'
      + '<div class="form"><div class="f full">'
      +   '<label for="emEnt">Tu correo de empresa</label>'
      +   '<input id="emEnt" type="email" autocomplete="email" placeholder="hola@tunegocio.com" value="' + esc(valor || '') + '">'
      + '</div></div>'
      + (aviso ? '<p class="err" role="alert">' + esc(aviso) + '</p>' : '')
      + '<div class="act"><button class="btn" id="pedirAcc">Enviarme el acceso</button></div>'
    );
    if (!ok) return;
    const campo = document.getElementById('emEnt');
    const boton = document.getElementById('pedirAcc');
    const pedir = async () => {
      const email = (campo.value || '').trim();
      if (!/.+@.+\..+/.test(email)) { campo.focus(); return pasoCorreo(email, 'Escribe un correo válido.'); }
      boton.disabled = true; boton.textContent = 'Enviando…';
      const { error } = await sb.auth.signInWithOtp({
        email, options: { emailRedirectTo: location.origin + '/empresas/panel/' }
      });
      if (error) return pasoCorreo(email, error.message);
      pasoCodigo(email);
    };
    boton.onclick = pedir;
    campo.onkeydown = ev => { if (ev.key === 'Enter') pedir(); };
  }

  function pasoCodigo(email, aviso) {
    const ok = abrirDrw(
      '<h2>Mira tu correo</h2>'
      + '<p class="sub">Te hemos escrito a <b>' + esc(email) + '</b>.</p>'
      + '<div class="form"><div class="f full">'
      +   '<label for="codEnt">Pega aquí el código</label>'
      +   '<input id="codEnt" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456">'
      +   '<small>Si el correo trae un botón en vez de un código, púlsalo y entras directo.</small>'
      + '</div></div>'
      + (aviso ? '<p class="err" role="alert">' + esc(aviso) + '</p>' : '')
      + '<div class="act">'
      +   '<button class="btn g" id="otroCorreo">Es otro correo</button>'
      +   '<button class="btn" id="okCod">Entrar</button>'
      + '</div>'
    );
    if (!ok) return;
    const campo = document.getElementById('codEnt');
    const boton = document.getElementById('okCod');
    const otro  = document.getElementById('otroCorreo');
    const ir = async () => {
      const token = (campo.value || '').replace(/\D/g, '');
      if (token.length < 6) { campo.focus(); return; }
      boton.disabled = true; boton.textContent = 'Comprobando…';
      const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
      if (error) return pasoCodigo(email, error.message);
      cerrarDrw();
      location.reload();   // con la sesión puesta, el panel arranca de cero
    };
    boton.onclick = ir;
    otro.onclick  = () => pasoCorreo('');
    campo.onkeydown = ev => { if (ev.key === 'Enter') ir(); };
  }

  function entrar() { pasoCorreo(''); }

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


  /* ── Las categorías de verdad ────────────────────────────────────────────
     El servidor exige que el plan traiga una categoría que exista en
     `public.categories`; no vale el sector del negocio. Se piden una vez y se
     guardan en memoria. */
  let _cats = null;
  API.categorias = async function () {
    if (_cats) return _cats;
    const { data, error } = await sb.from('categories')
      .select('id,label').eq('activa', true).order('label', { ascending: true });
    _cats = error ? [] : (data || []);
    return _cats;
  };

  /* ── Publicar un plan DE VERDAD ──────────────────────────────────────────
     Hasta ahora el panel guardaba los planes en el navegador y decía «Plan
     publicado». No llegaban a NYXA, no salían en la app y desaparecían al
     cambiar de dispositivo. Esto llama a `crear_plan_negocio()`, que existe
     en producción desde el 15-oct.

     El servidor tiene la última palabra y puede decir que no por motivos
     legítimos (negocio sin verificar, tope del tramo, fecha pasada). Cuando
     dice que no, aquí NO se finge que se publicó: se devuelve el motivo tal
     cual para enseñarlo.

     La portada no se manda: `plans.cover_url` sólo acepta URLs de nuestro
     Storage (constraint `plans_cover_url_solo_storage`), y las imágenes del
     panel son ficheros del sitio. Subirlas es trabajo aparte.

     Devuelve {ok:true, id} o {ok:false, motivo} — nunca lanza. */
  API.publicarPlan = async function (plan, ciudad) {
    if (!API.conectado) return { ok: false, motivo: 'no-conectado' };
    if (!plan || !plan.t) return { ok: false, motivo: 'Falta el título del plan.' };
    if (!plan.cat)        return { ok: false, motivo: 'Elige la actividad del plan.' };
    if (!plan.d)          return { ok: false, motivo: 'Elige una fecha.' };

    const cuando = new Date(plan.d + 'T' + (plan.h || '10:00'));
    if (isNaN(cuando) || cuando <= new Date())
      return { ok: false, motivo: 'La fecha y la hora tienen que estar en el futuro.' };

    const precio = Number(plan.pr) > 0 ? Math.round(Number(plan.pr) * 100) : null;

    const { data, error } = await sb.rpc('crear_plan_negocio', {
      p_title:       String(plan.t).slice(0, 80),
      p_starts_at:   cuando.toISOString(),
      p_capacity:    Math.max(1, Math.min(200, parseInt(plan.p) || 1)),
      p_category_id: plan.cat,
      p_place:       plan.l || null,
      p_city:        ciudad || null,
      p_cover_url:   null,
      p_description: plan.desc || null,
      p_price_cents: precio,
      p_currency:    'EUR'
    });
    if (error) return { ok: false, motivo: error.message };
    return { ok: true, id: (data && (data.id || data.plan_id)) || null };
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

  /* ── Lo que escribió en el alta, para no pedírselo dos veces ─────────── */
  function traerDelAlta() {
    const S = elEstado();
    if (!S || !S.biz) return;
    let a = null;
    try { a = JSON.parse(localStorage.getItem('nyxa_alta_v1') || 'null'); } catch (e) {}
    if (!a) return;
    /* Sector y ciudad vienen con un valor por defecto del panel ('viajes',
       'Valencia') que nadie ha elegido: ésos sí se pisan con lo que escribió
       en el alta. El resto sólo rellena huecos. */
    ['n','e','t','d'].forEach(k => { if (!S.biz[k] && a[k]) S.biz[k] = a[k]; });
    ['s','c'].forEach(k => { if (a[k]) S.biz[k] = a[k]; });
    guardar();
    // El panel ya dibujó el formulario vacío antes de que esto corriera.
    if (S.stage === 'ob') pintar();
  }

  /* ── Arranque ────────────────────────────────────────────────────────── */
  async function arrancar() {
    const { data: { session } } = await sb.auth.getSession();
    API.sesion = session;
    traerDelAlta();
    if (session) {
      const d = await traer();
      if (d) volcar(d);
    }
    avisar();
    /* «Iniciar sesión» de las páginas de empresas llega aquí con ?entrar=1:
       la ventana se abre sola, sin que haya que buscar un botón pequeño
       dentro de la banda. */
    if (!session && /[?&]entrar=1/.test(location.search)) {
      history.replaceState({}, '', location.pathname);
      setTimeout(entrar, 120);
    }
    await volverDeStripe();
    if (API.conectado) pintar();
  }

  if (document.readyState === 'loading')
    addEventListener('DOMContentLoaded', () => setTimeout(arrancar, 0));
  else setTimeout(arrancar, 0);

  sb.auth.onAuthStateChange((_e, s) => { if (s && !API.conectado) arrancar(); });
})();
