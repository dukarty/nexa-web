/* ═══════════════════════════════════════════════════════════
   NEXA — la web es un sábado

   El reloj avanza con el scroll: 18:37 → 06:40 del domingo.
   Cuatro interacciones, ninguna decorativa:
     1. El mensaje que no envías
     2. Los sábados que quedan
     3. Mandar un NEXA de verdad
     4. La foto que se convierte en recuerdo

   Sin dependencias. Sin tracking. Progressive enhancement:
   si el JS falla, el contenido sigue ahí y se lee.
   ═══════════════════════════════════════════════════════════ */

const CFG = window.NEXA || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
const TABLA = CFG.TABLA || "waitlist";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ─────────────────────────────────────────────
   Entradas
   ───────────────────────────────────────────── */
const io = new IntersectionObserver(
  (es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add("on", "is-in");
    io.unobserve(e.target);
  }),
  { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
);
$$(".rise, .marco, .hero__h, .fin__h").forEach((el) => io.observe(el));

// Las líneas de los titulares suben una detrás de otra.
$$(".ln").forEach((ln, i) => ln.style.setProperty("--l", i));

requestAnimationFrame(() => {
  $(".hero")?.classList.add("on");
  $$(".hero .rise").forEach((el) => el.classList.add("on"));
});

/* ─────────────────────────────────────────────
   1. EL RELOJ — el hilo de toda la web
   18:37 (sábado) → 06:40 (domingo). 723 minutos.
   ───────────────────────────────────────────── */
const INICIO = 18 * 60 + 37;  // 18:37
const FINAL  = 30 * 60 + 40;  // 06:40 del día siguiente
const relojH = $("#relojHora");
const relojD = $("#relojDia");
const reloj  = $("#reloj");
const nav    = $("#nav");
const finHora = $("#finHora");

const dosD = (n) => String(n).padStart(2, "0");

function pintarReloj(p) {
  const min = Math.round(INICIO + (FINAL - INICIO) * p);
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  relojH.textContent = `${dosD(h24)}:${dosD(m)}`;
  relojD.textContent = min >= 24 * 60 ? "DOM" : "SÁB";
}

// El reloj cambia de piel cuando cruza una sección oscura.
const oscuras = () => $$(".sab, .demo, .noes, .fin");
function pielReloj() {
  const y = innerHeight - 40; // donde vive el reloj
  const dark = oscuras().some((s) => {
    const r = s.getBoundingClientRect();
    return r.top < y && r.bottom > y - 40;
  });
  reloj.classList.toggle("is-dark", dark);
}

let last = 0, tick = false;
function frame() {
  const y = scrollY;
  const max = document.body.scrollHeight - innerHeight;
  const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;

  pintarReloj(p);
  pielReloj();

  nav.classList.toggle("is-solid", y > 30);
  nav.classList.toggle("is-up", y > last && y > 600);
  last = y;
  tick = false;
}
addEventListener("scroll", () => { if (!tick) { requestAnimationFrame(frame); tick = true; } }, { passive: true });
addEventListener("resize", frame, { passive: true });
frame();

/* ─────────────────────────────────────────────
   2. EL MENSAJE QUE NO ENVÍAS
   Escribes «¿hacemos algo?». Le das a enviar.
   Y el mensaje se te deshace en la mano.
   ───────────────────────────────────────────── */
const chatForm = $("#chatForm");
const chatIn = $("#chatIn");
const chatBody = $("#chatBody");
const msgOut = $("#msgOut");

const RESPUESTAS = [
  "Se ha ido. Como se van casi todos.",
  "Otra vez. Y no ha pasado nada malo: simplemente, no lo has mandado.",
  "Tres. No eres tú. <strong>Es que escribir primero te expone</strong>, y todo el mundo prefiere que empiece otro.",
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

  // El mensaje sube... y se desvanece antes de llegar a nadie.
  setTimeout(() => {
    b.classList.add("burb--fuga");
    setTimeout(() => b.remove(), reduce ? 0 : 1500);
  }, reduce ? 200 : 700);

  intentos = Math.min(intentos + 1, RESPUESTAS.length);
  setTimeout(() => {
    msgOut.innerHTML = RESPUESTAS[intentos - 1];
    msgOut.classList.add("on");
  }, reduce ? 300 : 1200);
});

/* ─────────────────────────────────────────────
   3. LOS SÁBADOS
   90 años × 52 sábados. Los gastados se apagan.
   ───────────────────────────────────────────── */
const VIDA = 90, COLS = 52;
const lienzo = $("#lienzo");
const edadIn = $("#edad");
const quedanEl = $("#quedan");

if (lienzo && edadIn) {
  const ctx = lienzo.getContext("2d");
  const TOTAL = VIDA * COLS;
  let progreso = 0, objetivo = 0, raf = null, arrancado = false, m;
  const fmt = (n) => n.toLocaleString("es-ES");

  function medir() {
    const w = lienzo.parentElement.clientWidth;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const paso = w / COLS;
    const h = paso * VIDA;
    lienzo.width = Math.round(w * dpr);
    lienzo.height = Math.round(h * dpr);
    lienzo.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { paso, w, h };
  }
  m = medir();

  function pintar() {
    ctx.clearRect(0, 0, m.w, m.h);
    const r = Math.max(1, m.paso * 0.19);
    for (let i = 0; i < TOTAL; i++) {
      const x = (i % COLS) * m.paso + m.paso / 2;
      const y = Math.floor(i / COLS) * m.paso + m.paso / 2;
      const gastado = i < progreso;
      ctx.beginPath();
      ctx.arc(x, y, gastado ? r * 0.75 : r, 0, 6.2832);
      ctx.fillStyle = gastado ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.6)";
      ctx.fill();
    }
    // Hoy. El único punto azul de toda la cuadrícula.
    if (progreso > 0 && progreso < TOTAL) {
      const i = Math.round(progreso) - 1;
      ctx.beginPath();
      ctx.arc((i % COLS) * m.paso + m.paso / 2, Math.floor(i / COLS) * m.paso + m.paso / 2, r * 1.6, 0, 6.2832);
      ctx.fillStyle = "#0A5CFF";
      ctx.fill();
    }
  }

  function animar() {
    const d = objetivo - progreso;
    if (Math.abs(d) < 1) {
      progreso = objetivo;
      pintar();
      quedanEl.textContent = fmt(Math.max(0, TOTAL - Math.round(progreso)));
      raf = null;
      return;
    }
    progreso += d * 0.05 + Math.sign(d) * 0.5;
    pintar();
    quedanEl.textContent = fmt(Math.max(0, TOTAL - Math.round(progreso)));
    raf = requestAnimationFrame(animar);
  }

  function actualizar(animado) {
    const edad = Math.min(89, Math.max(14, parseInt(edadIn.value, 10) || 20));
    objetivo = edad * COLS;
    if (!animado || reduce) {
      progreso = objetivo;
      pintar();
      quedanEl.textContent = fmt(Math.max(0, TOTAL - objetivo));
      return;
    }
    if (!raf) raf = requestAnimationFrame(animar);
  }

  edadIn.addEventListener("input", () => arrancado && actualizar(true));
  addEventListener("resize", () => { m = medir(); pintar(); }, { passive: true });

  new IntersectionObserver((es, obs) => {
    es.forEach((e) => {
      if (!e.isIntersecting || arrancado) return;
      arrancado = true;
      actualizar(true);
      obs.disconnect();
    });
  }, { threshold: 0.3 }).observe($("#sabados"));

  pintar();
  quedanEl.textContent = fmt(TOTAL);
}

/* ─────────────────────────────────────────────
   4. LA DEMO — mandar un NEXA de verdad
   Elige experiencia → elige persona → envía.
   Y tu sábado vacío se convierte en otra cosa.
   ───────────────────────────────────────────── */
const box = $("#demoBox");
if (box) {
  const pasos = $$(".paso", box);
  const estado = { exp: null, hora: null, per: null, por: null };

  const ir = (n) => {
    pasos.forEach((p) => p.classList.toggle("is-on", +p.dataset.paso === n));
    if (n > 1) box.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  };

  $$(".exp", box).forEach((b) => {
    b.addEventListener("click", () => {
      $$(".exp", box).forEach((o) => o.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
      estado.exp = b.dataset.exp;
      estado.hora = b.dataset.hora;
      setTimeout(() => ir(2), reduce ? 0 : 260);
    });
  });

  $$(".per", box).forEach((b) => {
    b.addEventListener("click", () => {
      $$(".per", box).forEach((o) => o.setAttribute("aria-checked", "false"));
      b.setAttribute("aria-checked", "true");
      estado.per = b.dataset.per;
      estado.por = b.dataset.por;
      $("#rPer").textContent = estado.per;
      $("#rExp").textContent = estado.exp;
      $("#rPor").textContent = estado.por;
      setTimeout(() => ir(3), reduce ? 0 : 260);
    });
  });

  $("#enviar")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.querySelector(".btn__t").textContent = "Enviado";
    setTimeout(() => {
      $("#rPer2").textContent = estado.per;
      $("#fExp").textContent = estado.exp;
      $("#fPer").textContent = estado.per;
      $("#fHora").textContent = estado.hora;
      ir(4);
      btn.disabled = false;
      btn.querySelector(".btn__t").textContent = "Enviar NEXA";
    }, reduce ? 100 : 900);
  });

  $$("[data-volver]", box).forEach((b) =>
    b.addEventListener("click", () => ir(+b.dataset.volver))
  );

  $("#otra")?.addEventListener("click", () => {
    $$(".exp, .per", box).forEach((o) => o.setAttribute("aria-checked", "false"));
    ir(1);
  });
}

/* ─────────────────────────────────────────────
   5. EL TIEMPO EN ESTA PANTALLA
   No es un contador simpático. Es la tesis.
   ───────────────────────────────────────────── */
const tiempoEl = $("#tiempo");
if (tiempoEl) {
  const t0 = Date.now();
  const pinta = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    const txt = s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
    let cola = "";
    if (s > 180) cola = " Es lo que tardas en mandar un NEXA.";
    if (s > 420) cola = " Y ese sábado sigue sin plan.";
    tiempoEl.innerHTML = `Llevas <strong>${txt}</strong> en esta pantalla.${cola}`;
  };
  pinta();
  setInterval(pinta, 1000);
}

/* Si una foto no carga, no se ve rota. */
$$("img").forEach((img) =>
  img.addEventListener("error", () => {
    img.style.visibility = "hidden";
    const c = img.closest(".exp, .marco");
    if (c) c.style.background = "linear-gradient(200deg,#D9DDE4,#8E97A6)";
  })
);

/* ─────────────────────────────────────────────
   6. Lista de espera
   ───────────────────────────────────────────── */
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

async function enviar(datos) {
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
    await enviar({
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
    btn.textContent = "Que el próximo sea distinto";
    fallar("No ha entrado. Prueba otra vez en un momento.");
  }
});

$("#y").textContent = new Date().getFullYear();
