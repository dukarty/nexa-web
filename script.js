/* ═══════════════════════════════════════════════════════════════
   NEXA

   Cero librerías. Todo movimiento va atado al scroll o a un clic:
   nada se mueve porque sí.

     00  El reloj da la vuelta entera y te deja donde estabas.
     01  847 nombres. Se apagan. Quedan seis.
     02  Escribes lo que quieres vivir. Tus palabras se hacen enormes.
     03  Dos toques y ya está propuesto.
     04  Las 4.160 semanas de una vida.
     05  No dejas un email. Dejas un deseo.
   ═══════════════════════════════════════════════════════════════ */

const CFG = window.NEXA || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
const TABLA = CFG.TABLA || "waitlist";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const fmt = (n) => n.toLocaleString("es-ES");

/* Progreso de scroll dentro de una sección alta con contenido pegado. */
function prog(sec) {
  const r = sec.getBoundingClientRect();
  const rec = r.height - innerHeight;
  return rec <= 0 ? 0 : clamp(-r.top / rec);
}

/* ═════════════════════════════════════════════
   00 · EL DOMINGO
   Domingo 23:47. Scrolleas: la semana entera se va.
   Y al final del scroll son las 23:47 de otro domingo.
   Eso es la inercia. No hace falta explicarla.
   ═════════════════════════════════════════════ */
const secDom = $("#domingo");
const elDia = $("#dia");
const elHora = $("#hora");
const frA = $("#frA");
const frB = $("#frB");
const baja = $("#baja");

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const T0 = 23 * 60 + 47;          // 23:47
const SEMANA = 7 * 1440;          // una semana, en minutos

function domingo(p) {
  const t = T0 + p * SEMANA;
  const dia = DIAS[Math.floor(t / 1440) % 7];
  const min = Math.floor(t) % 1440;
  const hh = String(Math.floor(min / 60)).padStart(2, "0");
  const mm = String(min % 60).padStart(2, "0");

  elDia.textContent = dia;
  elHora.textContent = `${hh}:${mm}`;

  // La frase al principio. Silencio en medio. Y la misma frase al final.
  const a = p < 0.16 ? 1 - p / 0.16 * 0.85 : p > 0.8 ? (p - 0.8) / 0.14 : 0;
  const b = p > 0.9 ? (p - 0.9) / 0.08 : 0;
  frA.style.opacity = clamp(p < 0.16 ? 1 : a);
  frB.style.opacity = clamp(b);
  baja.style.opacity = clamp(1 - p * 6);
}

/* ═════════════════════════════════════════════
   01 · LOS 847
   ═════════════════════════════════════════════ */
const NOMBRES = ("Lucía Pablo Alba Sergio Carla Jorge Paula Álvaro Andrea Marc "
  + "Elena Rubén Sara Adrián Laura Víctor Irene Diego Cristina Javier Nerea Raúl Ana Guillermo Julia Óscar "
  + "Rocío Manuel Silvia Aitor Patricia Fernando Miriam Gonzalo Eva Ignacio Noelia Alejandro Marina Rodrigo "
  + "Lidia Samuel Beatriz Emilio Celia Tomás Ainhoa Bruno Alicia Martín Vega Nacho Berta Íker Olivia Gabriel "
  + "Ángela Mario Teresa Enzo Amaia Luis Inés Aarón Daniela Héctor Naia Borja Rebeca Unai Sofía Cristian "
  + "Blanca Joel Valeria Xavi Lorena Arnau Claudia Iker Aurora Pau Vera Kevin Jimena Roberto Ariadna Sandra "
  + "Emma Álex Nadia Simón Leire Gerard Nora Ismael Candela Rafa Lola Erik Miguel Alma Fran Greta Toni Chloe "
  + "Bea Aleix Zoe Nil Ruth Álex Yaiza Denis Carmen Pol Ada Israel Mireia Saúl Lara Cayetana Nico Ainara "
  + "Ariel Elsa Omar Abril Salva Nayara Roger Aitana Cesc Alana Iago Ona Bosco Jana Enrique").split(" ");

const SEIS = ["Marta", "Iván", "Nuria", "Dani", "Clara", "Hugo"];

// Los seis van sueltos por el medio. Si estuvieran juntos al principio,
// se vería venir el golpe.
[14, 37, 58, 79, 101, 124].forEach((i, k) => NOMBRES.splice(i, 0, SEIS[k]));

const secAg = $("#agenda");
const cajaN = $("#nombres");
const agT1 = $("#agT1");
const agT2 = $("#agT2");
let spans = [];

if (cajaN) {
  const frag = document.createDocumentFragment();
  const usados = new Set();
  NOMBRES.forEach((n) => {
    const s = document.createElement("span");
    s.textContent = n;
    // Los seis se quedan. Solo la primera vez que aparece cada uno.
    if (SEIS.includes(n) && !usados.has(n)) { s.classList.add("vivo"); usados.add(n); }
    frag.appendChild(s);
  });
  cajaN.appendChild(frag);
  spans = $$("span", cajaN);

  // Un orden de apagado aleatorio, pero fijo: si no, parpadea al scrollear.
  spans.forEach((s) => s.dataset.o = Math.random().toFixed(4));
}

function agenda(p) {
  // Entre 0.15 y 0.8 se van apagando. Los seis se quedan.
  const q = clamp((p - 0.15) / 0.65);
  spans.forEach((s) => {
    if (s.classList.contains("vivo")) {
      s.style.opacity = 1;
      s.classList.toggle("destaca", q > 0.5);
      return;
    }
    s.style.opacity = +s.dataset.o < q ? 0 : 1;
  });
  const t2 = clamp((p - 0.72) / 0.16);
  agT1.style.opacity = 1 - t2;
  agT2.style.opacity = t2;
}

/* ═════════════════════════════════════════════
   Bucle de scroll
   ═════════════════════════════════════════════ */
const nav = $("#nav");
const barra = $("#prog");
let ultimo = 0, pendiente = false;

function marco() {
  const y = scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  barra.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  nav.classList.toggle("oculto", y > ultimo && y > 700);
  ultimo = y;

  if (secDom) domingo(prog(secDom));
  if (secAg && spans.length) agenda(prog(secAg));

  // El negro solo dura lo que dura el domingo.
  const r = secDom.getBoundingClientRect();
  document.body.classList.toggle("oscuro", r.bottom > innerHeight * 0.5);

  pendiente = false;
}
if (!reduce) {
  addEventListener("scroll", () => { if (!pendiente) { requestAnimationFrame(marco); pendiente = true; } }, { passive: true });
  addEventListener("resize", marco, { passive: true });
  marco();
} else {
  document.body.classList.remove("oscuro");
}

/* ═════════════════════════════════════════════
   02 · EL DESEO
   Lo que escribes aquí te acompaña hasta el final.
   ═════════════════════════════════════════════ */
const dForm = $("#deseoForm");
const dIn = $("#deseoIn");
const dSalida = $("#dSalida");
const dBig = $("#dBig");
const dPista = $("#dPista");
const formK = $("#formK");
const formDeseo = $("#formDeseo");
let DESEO = "";

dForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  DESEO = (dIn.value.trim() || dIn.placeholder).slice(0, 52);
  dBig.textContent = DESEO;
  dSalida.hidden = false;
  dPista.style.opacity = "0";
  formDeseo.textContent = DESEO;
  formK.hidden = false;
  dIn.blur();
  if (!reduce) dSalida.scrollIntoView({ behavior: "smooth", block: "center" });
});

/* El río de deseos. */
const rio = $("#rio");
if (rio && !reduce) {
  rio.innerHTML += rio.innerHTML;
  let x = 0;
  (function rueda() {
    const mitad = rio.scrollWidth / 2;
    x -= 0.5;
    if (x <= -mitad) x += mitad;
    rio.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    requestAnimationFrame(rueda);
  })();
}

/* ═════════════════════════════════════════════
   04 · LAS SEMANAS
   80 años × 52 semanas = 4.160 puntos.
   ═════════════════════════════════════════════ */
const COLS = 80, FILAS = 52, TOTAL = COLS * FILAS;
const lienzo = $("#rejilla");
const edadIn = $("#edad");
const quedanEl = $("#quedan");

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
  const base = Math.max(1, m.paso * 0.21);

  for (let i = 0; i < TOTAL; i++) {
    const { col, fila } = pos(i);
    const x = col * m.paso + m.paso / 2;
    const y = fila * m.paso + m.paso / 2;
    const e = estados[i];

    let r = base;
    if (raton.x > -900) {
      const d = Math.hypot(x - raton.x, y - raton.y);
      r += Math.max(0, 1 - d / (m.paso * 7)) * base * 1.1;
    }

    let color = "#0A0A0A";
    if (e === 0) { color = "#DEDEDE"; r *= 0.72; }
    if (e === 2) { color = "#0A5CFF"; r *= 1.45; }
    if (e === 3) { color = "#0A5CFF"; r *= 1.6; }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.2832);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

const edad = () => Math.min(89, Math.max(14, parseInt(edadIn.value, 10) || 20));

function cuenta() {
  quedanEl.textContent = fmt(Math.max(0, TOTAL - Math.round(edad() * FILAS)));
}

const aplicar = (g) => {
  for (let i = 0; i < TOTAL; i++) {
    if (estados[i] === 2) continue;
    estados[i] = i < g - 1 ? 0 : i === g - 1 ? 3 : 1;
  }
};

function animar() {
  const d = objetivo - gastadas;
  if (Math.abs(d) < 1) { gastadas = objetivo; raf = null; }
  else { gastadas += d * 0.08 + Math.sign(d) * 0.5; raf = requestAnimationFrame(animar); }
  aplicar(Math.round(gastadas));
  pintar();
}

function apagar(animado = true) {
  objetivo = Math.round(edad() * FILAS);
  cuenta();
  if (!animado || reduce) { gastadas = objetivo; aplicar(Math.round(gastadas)); pintar(); return; }
  if (!raf) raf = requestAnimationFrame(animar);
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
    es.forEach((e) => { if (e.isIntersecting) { apagar(true); obs.disconnect(); } });
  }, { threshold: 0.15 }).observe($("#semanas"));
}

/* ═════════════════════════════════════════════
   03 · UN NEXA  ·  EL MOMENTO
   ═════════════════════════════════════════════ */
const caja = $("#caja");
const momento = $("#momento");

if (caja) {
  const pasos = $$(".paso", caja);
  const est = { exp: null, img: null, per: null, por: null };
  const ir = (n) => pasos.forEach((p) => p.classList.toggle("is-on", +p.dataset.paso === n));

  $$(".exp", caja).forEach((b) => b.addEventListener("click", () => {
    $$(".exp", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
    b.setAttribute("aria-checked", "true");
    est.exp = b.dataset.exp;
    est.img = b.dataset.img;
    setTimeout(() => ir(2), reduce ? 0 : 220);
  }));

  $$(".per", caja).forEach((b) => b.addEventListener("click", () => {
    $$(".per", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
    b.setAttribute("aria-checked", "true");
    est.per = b.dataset.per;
    est.por = b.dataset.por;
    $("#rPer").textContent = est.per;
    $("#rExp").textContent = est.exp;
    $("#rPor").textContent = est.por;
    setTimeout(() => ir(3), reduce ? 0 : 220);
  }));

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
      encender(1);
      b.disabled = false;
      $("#btnT").textContent = "Enviar NEXA";
      ir(1);
      $$(".exp, .per", caja).forEach((o) => o.setAttribute("aria-checked", "false"));
    }, reduce ? 80 : 650);
  });

  $$("[data-volver]", caja).forEach((b) => b.addEventListener("click", () => ir(+b.dataset.volver)));
}

function cerrarMomento() {
  momento.hidden = true;
  document.body.classList.remove("bloq");
  $("#semanas")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
$("#cerrarMom")?.addEventListener("click", cerrarMomento);
addEventListener("keydown", (e) => { if (e.key === "Escape" && momento && !momento.hidden) cerrarMomento(); });

/* Una foto rota nunca se ve. */
$$("img").forEach((img) => img.addEventListener("error", () => {
  img.style.visibility = "hidden";
  const c = img.closest(".exp");
  if (c) c.style.background = "#DEDEDE";
}));

/* ═════════════════════════════════════════════
   05 · ENTRAR
   ═════════════════════════════════════════════ */
const form = $("#waitlist");
const email = $("#email");
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

async function post(datos) {
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
  return res;
}

async function enviarLista(base) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[NEXA] Supabase sin configurar:", base);
    return true;
  }
  // Intentamos guardar también el deseo. Si la columna todavía no existe
  // en la tabla, no perdemos el email por eso: reintentamos sin ella.
  let res = await post(DESEO ? { ...base, deseo: DESEO } : base);
  if (res.status === 400 && DESEO) res = await post(base);
  if (res.status === 409) return true;                 // ya estaba dentro
  if (!res.ok) throw new Error(await res.text());
  return true;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  err.hidden = true;
  email.removeAttribute("aria-invalid");
  if (!valido(email.value)) return fallar("Ese email no parece un email.");

  btn.disabled = true;
  btn.querySelector("span").textContent = "Un segundo…";
  try {
    await enviarLista({ email: email.value.trim().toLowerCase(), ciudad: "valencia" });
    form.hidden = true;
    ok.hidden = false;
    ok.setAttribute("tabindex", "-1");
    ok.focus();
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.querySelector("span").textContent = "Entrar";
    fallar("No ha entrado. Prueba otra vez en un momento.");
  }
});

$("#y").textContent = new Date().getFullYear();
