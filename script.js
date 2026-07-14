/* ═══════════════════════════════════════════════════════════════
   NEXA

   Sin librerías. 60 fps.

   Cuatro cosas hacen algo aquí:
     1. La Rejilla — 4.160 semanas que se apagan con tu edad.
     2. El mensaje que no envías — se deshace en el aire.
     3. La demo — mandas un NEXA.
     4. EL MOMENTO — la foto se abre a pantalla completa.
        Eso es lo que compras. Todo lo demás lleva hasta ahí.
   ═══════════════════════════════════════════════════════════════ */

const CFG = window.NEXA || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
const TABLA = CFG.TABLA || "waitlist";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const COLS = 80, FILAS = 52, TOTAL = COLS * FILAS;   // 4.160
const fmt = (n) => n.toLocaleString("es-ES");

/* ── Entradas ── */
const io = new IntersectionObserver(
  (es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("on");
    io.unobserve(e.target);
  }),
  { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
);
$$(".sube, .reveal, .titan, .frase").forEach((el) => io.observe(el));
$$(".ln").forEach((ln, i) => ln.style.setProperty("--l", i % 3));

requestAnimationFrame(() => {
  $(".hero .titan")?.classList.add("on");
  $$(".hero .sube").forEach((el) => el.classList.add("on"));
});

/* ── Nav + barra de progreso + parallax del corte ── */
const nav = $("#nav");
const prog = $("#prog");
const corteImg = $(".corte img");
let last = 0, tick = false;

function frame() {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  prog.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

  nav.classList.toggle("solido", y > innerHeight * 0.85);
  nav.classList.toggle("oculto", y > last && y > 700);
  last = y;

  // El corte se mueve más despacio que el scroll: profundidad.
  if (corteImg && !reduce) {
    const r = corteImg.parentElement.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight) {
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      corteImg.style.transform = `translate3d(0, ${(-p * 9).toFixed(2)}%, 0)`;
    }
  }
  tick = false;
}
addEventListener("scroll", () => { if (!tick) { requestAnimationFrame(frame); tick = true; } }, { passive: true });
addEventListener("resize", frame, { passive: true });
frame();

/* ═════════════════════════════════════════════
   1 · LA REJILLA
   ═════════════════════════════════════════════ */
const lienzo = $("#rejilla");
const edadIn = $("#edad");
const quedanEl = $("#quedan");
const finN = $("#finN");

const estados = new Uint8Array(TOTAL);   // 0 apagada · 1 te queda · 2 encendida · 3 ahora
let gastadas = 0, objetivo = 0, m = null, raf = null;
let raton = { x: -999, y: -999 };

const pos = (i) => ({ col: Math.floor(i / FILAS), fila: i % FILAS });

function medir() {
  const w = lienzo.parentElement.clientWidth;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const paso = w / COLS;
  const h = paso * FILAS;
  lienzo.width = Math.round(w * dpr);
  lienzo.height = Math.round(h * dpr);
  lienzo.style.height = h + "px";
  lienzo.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  return { paso, w, h };
}

function pintar() {
  if (!m) return;
  const ctx = lienzo.getContext("2d");
  ctx.clearRect(0, 0, m.w, m.h);
  const base = Math.max(1, m.paso * 0.2);

  for (let i = 0; i < TOTAL; i++) {
    const { col, fila } = pos(i);
    const x = col * m.paso + m.paso / 2;
    const y = fila * m.paso + m.paso / 2;
    const e = estados[i];

    let r = base;
    if (raton.x > -900) {
      const d = Math.hypot(x - raton.x, y - raton.y);
      const f = Math.max(0, 1 - d / (m.paso * 7));
      r += f * base * 1.1;
    }

    let color = "#8E96A5";                              // te queda
    if (e === 0) { color = "rgba(255,255,255,.09)"; r *= 0.7; }   // ya no vuelve
    if (e === 2) { color = "#0A5CFF"; r *= 1.45; }      // encendida
    if (e === 3) { color = "#0A5CFF"; r *= 1.6; }       // esta semana

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

const edad = () => Math.min(89, Math.max(14, parseInt(edadIn.value, 10) || 20));

function cuenta() {
  const q = Math.max(0, TOTAL - Math.round(edad() * FILAS));
  quedanEl.textContent = fmt(q);
  if (finN) finN.textContent = fmt(q);
  return q;
}

function apagar(animado = true) {
  objetivo = Math.round(edad() * FILAS);
  cuenta();
  if (!animado || reduce) {
    gastadas = objetivo;
    aplicar(Math.round(gastadas));
    pintar();
    return;
  }
  if (!raf) raf = requestAnimationFrame(animar);
}

function aplicar(g) {
  for (let i = 0; i < TOTAL; i++) {
    if (estados[i] === 2) continue;
    estados[i] = i < g - 1 ? 0 : i === g - 1 ? 3 : 1;
  }
}

function animar() {
  const d = objetivo - gastadas;
  if (Math.abs(d) < 1) { gastadas = objetivo; raf = null; }
  else { gastadas += d * 0.08 + Math.sign(d) * 0.5; raf = requestAnimationFrame(animar); }
  aplicar(Math.round(gastadas));
  pintar();
}

function encender(n = 1) {
  const libres = [];
  for (let i = 0; i < TOTAL; i++) if (estados[i] === 1) libres.push(i);
  for (let k = 0; k < n && libres.length; k++) {
    const j = Math.floor(Math.random() * Math.min(libres.length, 120));
    estados[libres[j]] = 2;
    libres.splice(j, 1);
  }
  pintar();
}

if (lienzo && edadIn) {
  m = medir();
  estados.fill(1);
  apagar(false);
  edadIn.addEventListener("input", () => apagar(true));

  if (!reduce) {
    lienzo.addEventListener("pointermove", (e) => {
      const r = lienzo.getBoundingClientRect();
      raton = { x: e.clientX - r.left, y: e.clientY - r.top };
      pintar();
    }, { passive: true });
    lienzo.addEventListener("pointerleave", () => { raton = { x: -999, y: -999 }; pintar(); });
  }

  addEventListener("resize", () => { m = medir(); pintar(); }, { passive: true });

  new IntersectionObserver((es, obs) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      apagar(true);
      obs.disconnect();
    });
  }, { threshold: 0.2 }).observe($("#semanas"));
}

/* ═════════════════════════════════════════════
   2 · EL MENSAJE QUE NO ENVÍAS
   ═════════════════════════════════════════════ */
const chatForm = $("#chatForm");
const chatIn = $("#chatIn");
const chatBody = $("#chatBody");
const salida = $("#salida");

const RESPUESTAS = [
  "Se ha ido. Como se van casi todos.",
  "Otra vez. Y no ha pasado nada: simplemente, no lo has mandado.",
  "Tres. <strong>No eres tú.</strong> Es que proponer expone, y todo el mundo prefiere que empiece otro.",
];
let intentos = 0;

chatForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const txt = chatIn.value.trim() || chatIn.placeholder;

  const b = document.createElement("div");
  b.className = "burb burb--mio";
  b.textContent = txt;
  chatBody.appendChild(b);
  chatIn.value = "";
  chatIn.blur();

  setTimeout(() => {
    b.classList.add("burb--fuga");
    setTimeout(() => b.remove(), reduce ? 0 : 1500);
  }, reduce ? 150 : 600);

  intentos = Math.min(intentos + 1, RESPUESTAS.length);
  setTimeout(() => {
    salida.innerHTML = RESPUESTAS[intentos - 1];
    salida.classList.add("on");
  }, reduce ? 250 : 1150);
});

/* ═════════════════════════════════════════════
   3 · LA DEMO  ·  4 · EL MOMENTO
   ═════════════════════════════════════════════ */
const caja = $("#caja");
const momento = $("#momento");

if (caja) {
  const pasos = $$(".paso1", caja);
  const est = { exp: null, img: null, per: null, por: null };
  const ir = (n) => pasos.forEach((p) => p.classList.toggle("is-on", +p.dataset.paso === n));

  $$(".exp", caja).forEach((b) => {
    b.addEventListener("click", () => {
      $$(".exp", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
      est.exp = b.dataset.exp;
      est.img = b.dataset.img;
      setTimeout(() => ir(2), reduce ? 0 : 240);
    });
  });

  $$(".per", caja).forEach((b) => {
    b.addEventListener("click", () => {
      $$(".per", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
      est.per = b.dataset.per;
      est.por = b.dataset.por;
      $("#rPer").textContent = est.per;
      $("#rExp").textContent = est.exp;
      $("#rPor").textContent = est.por;
      setTimeout(() => ir(3), reduce ? 0 : 240);
    });
  });

  /* ── EL MOMENTO ──
     La foto se abre a pantalla completa. Silencio. Y una frase.
     Si esto no te da un vuelco, no hay web que lo arregle. */
  $("#enviar")?.addEventListener("click", (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    $("#btnT").textContent = "Enviado";

    setTimeout(() => {
      $("#momImg").src = est.img;
      $("#momImg").alt = est.exp;
      $("#momT").textContent = est.exp;
      $("#momS").textContent = `con ${est.per} · el sábado que viene`;

      momento.hidden = false;
      document.body.classList.add("bloq");
      $("#cerrarMom").focus();

      encender(1);   // y una semana deja de estar apagada

      b.disabled = false;
      $("#btnT").textContent = "Enviar NEXA";
      ir(1);
      $$(".exp, .per", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
    }, reduce ? 80 : 700);
  });

  $$("[data-volver]", caja).forEach((b) =>
    b.addEventListener("click", () => ir(+b.dataset.volver))
  );
}

function cerrarMomento() {
  momento.hidden = true;
  document.body.classList.remove("bloq");
  $("#demo")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
}
$("#cerrarMom")?.addEventListener("click", cerrarMomento);
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && momento && !momento.hidden) cerrarMomento();
});

/* Las fotos nunca se ven rotas. */
$$("img").forEach((img) =>
  img.addEventListener("error", () => {
    img.style.visibility = "hidden";
    const c = img.closest(".exp__f, .mz, .paso__f, .hero__foto, .cierre__foto");
    if (c) c.style.background = "linear-gradient(200deg,#2A2F3A,#14171E)";
  })
);

/* ═════════════════════════════════════════════
   Lista de espera
   ═════════════════════════════════════════════ */
const form = $("#waitlist");
const email = $("#email");
const uni = $("#uni");
const btn = $("#submit");
const err = $("#err");
const ok = $("#ok");
const valido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function fallar(msg) {
  err.textContent = msg;
  err.hidden = false;
  email.setAttribute("aria-invalid", "true");
  email.focus();
}

async function enviarLista(datos) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[NEXA] Supabase sin configurar:", datos);
    return true;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLA}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(datos),
  });
  if (res.status === 409) return true;
  if (!res.ok) throw new Error(await res.text());
  return true;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.hidden = true;
  email.removeAttribute("aria-invalid");
  if (!valido(email.value)) return fallar("Ese email no parece un email.");

  btn.disabled = true;
  btn.textContent = "Un segundo…";
  try {
    await enviarLista({
      email: email.value.trim().toLowerCase(),
      universidad: uni.value.trim() || null,
      ciudad: "valencia",
    });
    form.hidden = true;
    ok.hidden = false;
    ok.setAttribute("tabindex", "-1");
    ok.focus();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = "Enciende la primera";
    fallar("No ha entrado. Prueba otra vez en un momento.");
  }
});

$("#y").textContent = new Date().getFullYear();
