/* NYXA web · script común de todas las páginas.
   CONFIG: el único sitio donde se rellenan los enlaces reales. Lo que esté vacío muestra un aviso "en preparación". */
window.NYXA_CONFIG={
  ios:'https://apps.apple.com/es/app/nyxa/id6800325033',
  android:'',                               // Google Play: aun sin cuenta
  empresasEmail:'hola@holanyxa.com',
  contacto:'hola@holanyxa.com',
  instagram:'https://instagram.com/nyxa.app',
  tiktok:'',                                // pendiente de confirmar la cuenta
  privacidad:'/privacidad',
  terminos:'/terminos',
  cookies:'',                               // no existe todavia -> "En preparacion"
  panel:'/empresas/panel/'
};
(()=>{const C=window.NYXA_CONFIG;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const toast=t=>{const e=$('#toast');if(!e)return;e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),2600)};
window.NX={toast,C};
const nav=$('#nav');if(nav)addEventListener('scroll',()=>nav.classList.toggle('s',scrollY>20),{passive:true});
const io=new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target)}}),{threshold:.12});$$('.rv').forEach(el=>io.observe(el));
const mn=$('#mnav'),bg=$('#burger'),mc=$('#mclose');if(mn&&bg&&mc){bg.onclick=()=>{mn.classList.add('on');bg.setAttribute('aria-expanded','true')};mc.onclick=()=>{mn.classList.remove('on');bg.setAttribute('aria-expanded','false')};addEventListener('keydown',e=>{if(e.key=='Escape'){mn.classList.remove('on');bg.setAttribute('aria-expanded','false')}})}
$$('[data-store]').forEach(a=>{const u=C[a.dataset.store];if(u){a.href=u;a.target='_blank';a.rel='noopener'}else a.onclick=e=>{e.preventDefault();toast('El enlace de descarga llega en nada.')}});
$$('[data-mail]').forEach(a=>a.onclick=e=>{e.preventDefault();if(C.empresasEmail)location.href='mailto:'+C.empresasEmail+'?subject='+encodeURIComponent('Quiero publicar planes en NYXA');else toast('Escríbenos y te enseñamos cómo funciona.')});
$$('[data-link]').forEach(a=>{const u=C[a.dataset.link];if(u){a.href=u.includes('@')&&!u.startsWith('http')?'mailto:'+u:u;if(/^https?:/.test(u)){a.target='_blank';a.rel='noopener'}}else a.onclick=e=>{e.preventDefault();toast('En preparación.')}});
$$('[data-pend]').forEach(a=>a.onclick=e=>{e.preventDefault();toast('En preparación.')});
$$('.acc.lt').forEach(a=>a.style.display='block');
})();
/* Botones "Descargar": en móvil llevan directo a su tienda si el enlace existe */
document.querySelectorAll('[data-dl]').forEach(a=>a.addEventListener('click',e=>{const C=window.NYXA_CONFIG,ua=navigator.userAgent,u=/iPhone|iPad|iPod/i.test(ua)?C.ios:/Android/i.test(ua)?C.android:'';if(u){e.preventDefault();location.href=u}}));
