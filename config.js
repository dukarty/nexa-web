/* ═══════════════════════════════════════════════════
   NEXA — configuración

   Este es el ÚNICO archivo que tienes que tocar.
   Pega aquí los dos valores de Supabase y guarda.
   No hace falta abrir ningún otro archivo.
   ═══════════════════════════════════════════════════ */

window.NEXA = {

  // Proyecto: nexa-produccion (organización NEXA)
  SUPABASE_URL: "https://vjpgyxwhobshwaotmwzf.supabase.co",

  // Publishable key. Está pensada para vivir en el navegador:
  // con la RLS de la tabla waitlist solo puede AÑADIR un email.
  // No puede leer la lista, ni borrarla, ni tocar el resto de tablas.
  SUPABASE_ANON_KEY: "sb_publishable_rmJ7LK0fhSZTJsOUUzOZ3A_bnY-bQ9-",

  // 3. La tabla. Déjalo así salvo que la llames de otra forma.
  TABLA: "waitlist",

};

/* Mientras estos campos estén vacíos, el formulario sigue funcionando:
   muestra "Estás dentro" y escribe el email en la consola del navegador.
   Así puedes enseñar la web hoy, aunque no tengas backend todavía. */
