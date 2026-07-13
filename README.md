# NEXA — web pública

En producción: https://nexa-web-one.vercel.app

Estática. HTML + CSS + JS. Cero dependencias, cero build, cero cookies.

```
index.html    · las 9 secciones
styles.css    · el sistema de diseño entero
script.js     · movimiento + lista de espera
favicon.svg   · la X como cruce
vercel.json   · headers y caché
```

## 1. Conectar la lista de espera (Supabase)

En el SQL Editor de Supabase:

```sql
create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  universidad text,
  ciudad      text not null default 'valencia',
  created_at  timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Solo se puede INSERTAR desde el cliente. Nadie puede leer la lista.
create policy "waitlist_insert_anon"
  on public.waitlist for insert
  to anon
  with check (
    char_length(email) between 5 and 254
    and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'
    and ciudad = 'valencia'
  );
```

No hay policy de `select`: la anon key no puede leer nada. Es seguro exponerla.

Luego, en `script.js`, líneas 8–9:

```js
const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "eyJ...";
```

Sin configurar, el formulario funciona igual (muestra "Estás dentro") y escribe los datos en consola. Útil para enseñar la web antes de tener backend.

**Anti-spam:** si empieza a llegar basura, añade Cloudflare Turnstile o un rate limit por IP en una Edge Function. No lo metas antes de necesitarlo.

## 2. Fotos

13 fotos reales de **Pexels**, servidas desde su CDN (`images.pexels.com`). Licencia Pexels: uso libre, también comercial, sin atribución obligatoria.

**Pinterest no.** Esas imágenes son de terceros con copyright. En una web pública de una empresa, es un riesgo real y evitable.

Cuando tengas fotos reales de gente de Valencia, sustituye el `src` de cada `<img>` y quita el dominio de Pexels del `preconnect`. Los `alt` ya están escritos. Ratios:

| Sitio | Ratio | Ancho |
|---|---|---|
| Hero | 3:2 | ≥1800px |
| Tarjetas Tus 9 | 4:5 | 800px |
| Rejilla del móvil | 1:1 | 220px |
| Tira animada | 4:3 | 700px |
| Historial | 16:10 | 400px |

Si una foto falla al cargar, `script.js` la sustituye por un degradado gris. Nunca se ve una imagen rota.

Falta `og.jpg` (1200×630) para las stories y los links compartidos. Es el activo con más ROI de toda la web.

## 3. Deploy

```bash
npx vercel        # preview
npx vercel --prod
```

O arrastra la carpeta a vercel.com. No hay build step.

## 4. Reglas que no se rompen

- **Una tipografía.** Inter. La jerarquía es peso y tamaño, nunca una segunda familia.
- **Un azul: `#0A5CFF`.** Si algo es azul, se toca. No hay azul decorativo en toda la web. El gris `#9099AB` es de marca pero no tiene contraste suficiente para texto: para texto secundario usa `--gris-txt` (`#5A6377`, 6.0:1).
- **Nunca amarillo.** Nunca nada fuera de paleta.
- **Sin métricas de vanidad.** Si algún día hay una cifra, es una: experiencias vividas.
- **`text-wrap: balance`** en todos los titulares. Ninguna palabra suelta colgando.
- **`prefers-reduced-motion`** desactiva parallax, entradas y animaciones. Ya está.

## 5. El filtro

Antes de añadir una sección: *¿esto hace que alguien quiera vivir algo que no habría vivido sin NEXA?* Si no, sobra.
