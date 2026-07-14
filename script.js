/* ═══════════════════════════════════════════════════════════════
   NEXA

   Sin librerías. Sin WebGL. Sin trucos.
   La sofisticación está en el timing, no en la GPU.

   Tres cosas hacen algo aquí:
     1. La Rejilla — 4.160 semanas. Se apagan con tu edad.
     2. El mensaje que no envías — se deshace en el aire.
     3. La demo — mandas un NEXA y una semana se enciende.

   Si el JS no se ejecuta, el contenido sigue ahí y se lee entero.
   ═══════════════════════════════════════════════════════════════ */

const CFG = window.NEXA || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
const TABLA = CFG.TABLA || "waitlist";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const COLS = 80;                  // años
const FILAS = 52;                 // semanas
const TOTAL = COLS * FILAS;       // 4.160
const fmt = (n) => n.toLocaleString("es-ES");

/* ─────────────────────────────────────────────
   Entradas. Suben un poco y aparecen. Nada más.
   ───────────────────────────────────────────── */
const io = new IntersectionObserver(
  (es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("on");
    io.unobserve(e.target);
  }),
  { rootMargin: "0px 0px -10% 0px", threshold: 0.15 }
);
$$(".sube, .display").forEach((el) => io.observe(el));
$$(".ln").forEach((ln, i) => ln.style.setProperty("--l", i));

requestAnimationFrame(() => {
  $(".hero .display")?.classList.add("on");
  $$(".hero .sube").forEach((el) => el.classList.add("on"));
});

const nav = $("#nav");
addEventListener("scroll", () => nav.classList.toggle("solido", scrollY > 24), { passive: true });

/* ═════════════════════════════════════════════
   1 · LA REJILLA
   4.160 puntos. Los que ya has vivido se apagan.
   Y reacciona a tu cursor: está viva, pero no grita.
   ═════════════════════════════════════════════ */
const lienzo = $("#rejilla");
const edadIn = $("#edad");
const quedanEl = $("#quedan");
const finN = $("#finN");

let estados = new Uint8Array(TOTAL);   // 0 apagada · 1 te queda · 2 encendida · 3 ahora
let gastadas = 0, objetivo = 0;
let raton = { x: -999, y: -999 };
let m = null, raf = null;

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

    // Cerca del cursor, el punto crece un poco. Sutil. Solo eso.
    let r = base;
    if (raton.x > -900) {
      const d = Math.hypot(x - raton.x, y - raton.y);
      const f = Math.max(0, 1 - d / (m.paso * 7));
      r += f * base * 0.9;
    }

    let color = "#C2C8D2";           // te queda
    if (e === 0) { color = "#E4E7EC"; r *= 0.78; }   // ya no vuelve
    if (e === 2) { color = "#0A5CFF"; r *= 1.35; }   // encendida
    if (e === 3) { color = "#0A5CFF"; r *= 1.5; }    // esta semana

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function edad() {
  return Math.min(89, Math.max(14, parseInt(edadIn.value, 10) || 20));
}

function cuenta() {
  const q = Math.max(0, TOTAL - Math.round(edad() * FILAS));
  quedanEl.textContent = fmt(q);
  if (finN) finN.textContent = fmt(q) + " semanas";
  return q;
}

/* Las semanas no se apagan de golpe: se apagan una a una.
   Ese medio segundo es todo el argumento de la web. */
function apagar(animado = true) {
  objetivo = Math.round(edad() * FILAS);
  cuenta();

  if (!animado || reduce) {
    gastadas = objetivo;
    for (let i = 0; i < TOTAL; i++) {
      if (estados[i] === 2) continue;
      estados[i] = i < gastadas - 1 ? 0 : i === gastadas - 1 ? 3 : 1;
    }
    pintar();
    return;
  }
  if (!raf) raf = requestAnimationFrame(animar);
}

function animar() {
  const d = objetivo - gastadas;
  if (Math.abs(d) < 1) {
    gastadas = objetivo;
    raf = null;
  } else {
    gastadas += d * 0.08 + Math.sign(d) * 0.5;
    raf = requestAnimationFrame(animar);
  }
  const g = Math.round(gastadas);
  for (let i = 0; i < TOTAL; i++) {
    if (estados[i] === 2) continue;
    estados[i] = i < g - 1 ? 0 : i === g - 1 ? 3 : 1;
  }
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
    lienzo.addEventListener("pointerleave", () => {
      raton = { x: -999, y: -999 };
      pintar();
    });
  }

  addEventListener("resize", () => { m = medir(); pintar(); }, { passive: true });

  // No se apagan hasta que la sección está delante de tus ojos.
  new IntersectionObserver((es, obs) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      apagar(true);
      obs.disconnect();
    });
  }, { threshold: 0.25 }).observe($("#semanas"));
}

/* ═════════════════════════════════════════════
   La rejilla pequeña del perfil: un año.
   52 semanas, con las encendidas en azul.
   ═════════════════════════════════════════════ */
const mini = $("#mini");
if (mini) {
  const M_COLS = 13, M_FILAS = 4;            // 52 semanas
  const vividas = [2, 5, 6, 11, 14, 19, 23, 24, 30, 33, 38, 41, 45, 50];

  function pintarMini(hasta = 99) {
    const w = mini.parentElement.clientWidth;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const paso = w / M_COLS;
    const h = paso * M_FILAS;
    mini.width = w * dpr;
    mini.height = h * dpr;
    mini.style.height = h + "px";
    const ctx = mini.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < 52; i++) {
      const col = i % M_COLS;
      const fila = Math.floor(i / M_COLS);
      const on = vividas.includes(i) && vividas.indexOf(i) < hasta;
      ctx.beginPath();
      ctx.arc(col * paso + paso / 2, fila * paso + paso / 2, paso * (on ? 0.26 : 0.18), 0, 6.2832);
      ctx.fillStyle = on ? "#0A5CFF" : "#C7CCD6";
      ctx.fill();
    }
  }
  pintarMini(0);
  addEventListener("resize", () => pintarMini(99), { passive: true });

  // Se encienden una a una cuando llegas. Es la promesa del producto.
  new IntersectionObserver((es, obs) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      if (reduce) { pintarMini(99); obs.disconnect(); return; }
      let n = 0;
      const t = setInterval(() => {
        pintarMini(++n);
        if (n >= vividas.length) clearInterval(t);
      }, 130);
      obs.disconnect();
    });
  }, { threshold: 0.4 }).observe($(".perfil"));
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
    setTimeout(() => b.remove(), reduce ? 0 : 1400);
  }, reduce ? 150 : 600);

  intentos = Math.min(intentos + 1, RESPUESTAS.length);
  setTimeout(() => {
    salida.innerHTML = RESPUESTAS[intentos - 1];
    salida.classList.add("on");
  }, reduce ? 250 : 1100);
});

/* ═════════════════════════════════════════════
   3 · LA DEMO
   ═════════════════════════════════════════════ */
const caja = $("#caja");
if (caja) {
  const pasos = $$(".paso1", caja);
  const est = { exp: null, img: null, per: null, por: null };

  const ir = (n) => {
    pasos.forEach((p) => p.classList.toggle("is-on", +p.dataset.paso === n));
  };

  $$(".exp", caja).forEach((b) => {
    b.addEventListener("click", () => {
      $$(".exp", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
      est.exp = b.dataset.exp;
      est.img = b.dataset.img;
      setTimeout(() => ir(2), reduce ? 0 : 220);
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
      setTimeout(() => ir(3), reduce ? 0 : 220);
    });
  });

  $("#enviar")?.addEventListener("click", (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    $("#btnT").textContent = "Enviado";
    setTimeout(() => {
      $("#rPer2").textContent = est.per;
      $("#rPer3").textContent = est.per;
      $("#rExp2").textContent = est.exp;
      const img = $("#rImg");
      img.src = est.img;
      img.alt = est.exp;
      encender(1);                 // y una semana deja de estar apagada
      ir(4);
      b.disabled = false;
      $("#btnT").textContent = "Enviar NEXA";
    }, reduce ? 80 : 750);
  });

  $$("[data-volver]", caja).forEach((b) =>
    b.addEventListener("click", () => ir(+b.dataset.volver))
  );

  $("#otra")?.addEventListener("click", () => {
    $$(".exp, .per", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
    ir(1);
  });
}

/* Las fotos nunca se ven rotas. */
$$("img").forEach((img) =>
  img.addEventListener("error", () => {
    img.style.visibility = "hidden";
    const c = img.closest(".exp__f, .recuerdo");
    if (c) c.style.background = "#E4E7EC";
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
