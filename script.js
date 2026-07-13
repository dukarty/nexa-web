/* ═══════════════════════════════════════════════════
   NEXA — movimiento y lista de espera
   Sin dependencias. Sin tracking.
   ═══════════════════════════════════════════════════ */

const CFG = window.NEXA || {};
const SUPABASE_URL = CFG.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = CFG.SUPABASE_ANON_KEY || "";
const TABLA = CFG.TABLA || "waitlist";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─────────────────────────────────────────────
   1. Titulares que suben palabra a palabra
   ───────────────────────────────────────────── */
document.querySelectorAll("[data-split]").forEach((el) => {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = "";
  words.forEach((w, i) => {
    const outer = document.createElement("span");
    outer.className = "w";
    outer.style.setProperty("--w", i);
    const inner = document.createElement("span");
    inner.textContent = w;
    outer.appendChild(inner);
    el.appendChild(outer);
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
  });
});

/* ─────────────────────────────────────────────
   2. Entradas al hacer scroll
   ───────────────────────────────────────────── */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  },
  { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
);

document
  .querySelectorAll(".rise, .reveal, [data-split], .cruz, .reloj")
  .forEach((el) => io.observe(el));

// El hero entra solo.
requestAnimationFrame(() => {
  document.querySelector(".hero [data-split]")?.classList.add("in");
  document.querySelectorAll(".hero .rise").forEach((el) => el.classList.add("in"));
});

/* ─────────────────────────────────────────────
   3. LOS SÁBADOS
   Una vida = 90 años × 52 sábados. Un punto cada uno.
   Los que ya has gastado se apagan delante de ti.
   ───────────────────────────────────────────── */
const VIDA = 90;
const COLS = 52;
const FILAS = VIDA;

const lienzo = document.getElementById("lienzo");
const edadInput = document.getElementById("edad");
const quedanEl = document.getElementById("quedan");

if (lienzo && edadInput) {
  const ctx = lienzo.getContext("2d");
  let progreso = 0;   // cuántos puntos apagados llevamos dibujados
  let objetivo = 0;   // cuántos hay que apagar
  let raf = null;
  let arrancado = false;

  const fmt = (n) => n.toLocaleString("es-ES");

  function medidas() {
    const anchoCSS = lienzo.parentElement.clientWidth;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const paso = anchoCSS / COLS;
    const altoCSS = paso * FILAS;

    lienzo.width = Math.round(anchoCSS * dpr);
    lienzo.height = Math.round(altoCSS * dpr);
    lienzo.style.height = altoCSS + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { paso, anchoCSS, altoCSS };
  }

  let m = medidas();

  function pintar() {
    ctx.clearRect(0, 0, m.anchoCSS, m.altoCSS);
    const r = Math.max(1.1, m.paso * 0.19);

    for (let i = 0; i < VIDA * COLS; i++) {
      const fila = Math.floor(i / COLS);
      const col = i % COLS;
      const x = col * m.paso + m.paso / 2;
      const y = fila * m.paso + m.paso / 2;

      const gastado = i < progreso;
      ctx.beginPath();
      ctx.arc(x, y, gastado ? r * 0.8 : r, 0, Math.PI * 2);
      ctx.fillStyle = gastado ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.62)";
      ctx.fill();
    }

    // El borde de lo gastado: la línea del presente, en azul.
    if (progreso > 0 && progreso < VIDA * COLS) {
      const fila = Math.floor((progreso - 1) / COLS);
      const col = (progreso - 1) % COLS;
      ctx.beginPath();
      ctx.arc(col * m.paso + m.paso / 2, fila * m.paso + m.paso / 2, r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "#0A5CFF";
      ctx.fill();
    }
  }

  function animar() {
    const total = VIDA * COLS;
    const dif = objetivo - progreso;
    if (Math.abs(dif) < 1) {
      progreso = objetivo;
      pintar();
      quedanEl.textContent = fmt(Math.max(0, total - Math.round(progreso)));
      raf = null;
      return;
    }
    // Se apagan rápido al principio y lentos al final. Duele más así.
    progreso += dif * 0.045 + Math.sign(dif) * 0.6;
    pintar();
    quedanEl.textContent = fmt(Math.max(0, total - Math.round(progreso)));
    raf = requestAnimationFrame(animar);
  }

  function actualizar(animado = true) {
    const edad = Math.min(89, Math.max(14, parseInt(edadInput.value, 10) || 20));
    objetivo = edad * COLS;
    if (!animado || reduce) {
      progreso = objetivo;
      pintar();
      quedanEl.textContent = fmt(Math.max(0, VIDA * COLS - objetivo));
      return;
    }
    if (!raf) raf = requestAnimationFrame(animar);
  }

  edadInput.addEventListener("input", () => {
    if (!arrancado) return;
    actualizar(true);
  });

  addEventListener("resize", () => {
    m = medidas();
    pintar();
  }, { passive: true });

  // Los puntos no se apagan hasta que la sección está delante de tus ojos.
  const ioSab = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || arrancado) return;
        arrancado = true;
        actualizar(true);
        ioSab.disconnect();
      });
    },
    { threshold: 0.35 }
  );
  ioSab.observe(document.getElementById("sabados"));

  pintar();
  quedanEl.textContent = fmt(VIDA * COLS);
}

/* ─────────────────────────────────────────────
   4. Parallax + progreso + nav
   ───────────────────────────────────────────── */
const layers = [...document.querySelectorAll("[data-parallax]")];
const bar = document.getElementById("progress");
const nav = document.getElementById("nav");
let last = 0;
let ticking = false;

function frame() {
  const y = scrollY;
  const vh = innerHeight;
  const max = document.body.scrollHeight - vh;
  bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

  nav.classList.toggle("is-solid", y > 40);
  nav.classList.toggle("is-up", y > last && y > 500);
  last = y;

  if (!reduce) {
    layers.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const centre = r.top + r.height / 2 - vh / 2;
      const speed = parseFloat(el.dataset.parallax) || 0;
      el.style.transform = `translate3d(0, ${(-centre * speed).toFixed(2)}px, 0)`;
    });
  }
  ticking = false;
}
addEventListener("scroll", () => {
  if (!ticking) { requestAnimationFrame(frame); ticking = true; }
}, { passive: true });
addEventListener("resize", frame, { passive: true });
frame();

/* ─────────────────────────────────────────────
   5. El tiempo que llevas leyendo sobre vivir
   ───────────────────────────────────────────── */
const tiempoEl = document.getElementById("tiempo");
if (tiempoEl) {
  const t0 = Date.now();
  setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    const min = Math.floor(s / 60);
    const seg = s % 60;
    const txt = min > 0 ? `${min} min ${seg} s` : `${seg} s`;
    tiempoEl.innerHTML = `Llevas <strong>${txt}</strong> leyendo sobre vivir.`;
  }, 1000);
}

/* ─────────────────────────────────────────────
   6. Botones magnéticos
   ───────────────────────────────────────────── */
if (!reduce && matchMedia("(hover: hover)").matches) {
  document.querySelectorAll(".btn--mag").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.3;
      b.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    b.addEventListener("pointerleave", () => (b.style.transform = ""));
  });
}

/* ─────────────────────────────────────────────
   7. Si una foto no carga, no se ve rota
   ───────────────────────────────────────────── */
document.querySelectorAll("img").forEach((img) => {
  img.addEventListener("error", () => {
    img.style.visibility = "hidden";
    const box = img.closest(".prueba__f, .hito");
    if (box) box.style.background = "linear-gradient(200deg,#D9DDE4,#8E97A6)";
  });
});

/* ─────────────────────────────────────────────
   8. Lista de espera
   ───────────────────────────────────────────── */
const form = document.getElementById("waitlist");
const email = document.getElementById("email");
const uni = document.getElementById("uni");
const btn = document.getElementById("submit");
const err = document.getElementById("err");
const ok = document.getElementById("ok");

const valido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function fallar(msg) {
  err.textContent = msg;
  err.hidden = false;
  email.setAttribute("aria-invalid", "true");
  email.focus();
}

async function enviar(datos) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[NEXA] Supabase sin configurar. Datos capturados:", datos);
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

form.addEventListener("submit", async (e) => {
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
    btn.textContent = "Entrar en la lista";
    fallar("No ha entrado. Prueba otra vez en un momento.");
  }
});

document.getElementById("y").textContent = new Date().getFullYear();
