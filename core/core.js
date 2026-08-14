/* Weiss Core — el kit del navegador de los productos libres.
   MiCarta, MiCita, Invita y lo que venga después.

   QUÉ ES Y QUÉ NO ES. Aquí solo vive lo que es IDÉNTICO en todos los productos
   y no sabe nada del producto que lo usa. La forma del estado, el esquema del
   link y las pantallas se quedan en cada app: son el producto, no el chasís.

   LA REGLA QUE NO SE PUEDE ROMPER: el formato del link es un contrato público.
   Hay cartas, citas e invitaciones circulando por WhatsApp desde hace días y
   el código que las lee vive en el celular de quien las recibió. Por eso
   `codificar`/`decodificar` NO están aquí: cada producto tiene su esquema de
   campos y tocarlo desde un archivo compartido rompería links de gente real.

   Sin build y sin dependencias: es un <script> más, antes que app.js. Los tres
   repos son estáticos en GitHub Pages y así siguen. La copia la hace
   `Activos/weiss-core/sincronizar.mjs`; no se edita la copia, se edita este
   archivo. */
(function (raiz) {
  'use strict';

  /* ---------------------------------------------------------------
     TEXTO Y DOM
     --------------------------------------------------------------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  var toastT = null;
  function toast(msg) {
    var t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('ver');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('ver'); }, 2400);
  }

  /* El camino viejo no es paranoia: `navigator.clipboard` no existe sobre
     file:// y en varios navegadores in-app (el de Instagram, el de Facebook)
     falla en silencio, que es justo por donde entra media la gente. */
  function copiar(txt, msg) {
    function viejo() {
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      toast(msg || 'Copiado');
    }
    if (navigator.clipboard && location.protocol !== 'file:') {
      navigator.clipboard.writeText(txt).then(function () { toast(msg || 'Copiado'); }, viejo);
    } else { viejo(); }
  }

  /* ---------------------------------------------------------------
     WHATSAPP
     Todos los productos libres terminan en un wa.me: es el único canal
     de entrega que tienen.
     --------------------------------------------------------------- */

  /* Normaliza a formato internacional colombiano: 3171715071 -> 573171715071.
     Se aceptan espacios, guiones y el +57 que la gente escribe de mil formas. */
  function waNum(n) {
    var d = String(n || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 10 && d.charAt(0) === '3') return '57' + d;
    if (d.length === 12 && d.slice(0, 2) === '57') return d;
    return d;
  }

  function waLink(num, texto) {
    return 'https://wa.me/' + waNum(num) + '?text=' + encodeURIComponent(texto);
  }

  /* ---------------------------------------------------------------
     LA RAÍZ DE LA APLICACIÓN, QUE NO SIEMPRE ES LA RUTA ACTUAL

     Con dirección fija, `404.html` carga la app desde `/nombrenegocio`, así que
     `location.pathname` trae el nombre del negocio pegado. Si de ahí se arman
     los links, el crédito del pie devuelve a la página del MISMO negocio —
     que es justo el único canal por el que el producto se propaga — y el
     "volver" del login aterriza en la página ajena en vez del editor.

     Ya pasó en MiCarta y en MiCita, con dos nombres distintos (`RAIZ` y
     `BASE`) y dos arreglos separados. Por eso vive aquí.

     `slug` es el nombre corto cuando la app se cargó desde una dirección fija;
     sin él devuelve la raíz normal. El ruteador ya lo validó contra
     [a-z0-9-], así que no puede traer metacaracteres de expresión regular.
     --------------------------------------------------------------- */
  function raizDe(slug) {
    var p = location.pathname.replace(/index\.html$/, '');
    if (slug) p = p.replace(new RegExp('/' + slug + '/?$'), '/');
    return location.origin + p;
  }

  /* ---------------------------------------------------------------
     BORRADOR EN EL NAVEGADOR

     Siempre en try/catch: en modo incógnito de Safari `localStorage` existe
     pero lanza al escribir, y perder el borrador es molesto — que se caiga
     la app, no.

     `cargar` recibe el estado nuevo y le encima lo guardado campo por campo,
     en vez de devolver lo guardado tal cual. Así, cuando el producto agrega
     un campo, el borrador viejo sigue abriendo con el campo nuevo en su
     valor por defecto en vez de quedar `undefined`.
     --------------------------------------------------------------- */
  function almacen(clave) {
    return {
      guardar: function (estado) {
        try { localStorage.setItem(clave, JSON.stringify(estado)); } catch (e) {}
      },
      cargar: function (base) {
        try {
          var x = JSON.parse(localStorage.getItem(clave) || 'null');
          if (x && typeof x === 'object') {
            for (var k in base) if (x[k] !== undefined) base[k] = x[k];
          }
        } catch (e) {}
        return base;
      },
      borrar: function () {
        try { localStorage.removeItem(clave); } catch (e) {}
      }
    };
  }

  /* ---------------------------------------------------------------
     VARIOS
     --------------------------------------------------------------- */

  function dosD(n) { return (n < 10 ? '0' : '') + n; }

  /* Hash corto y estable para desempatar cosas del mismo lote (nombres de
     archivo, ids de invitado). No es criptográfico y no debe usarse para
     nada que necesite serlo. */
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return h;
  }

  function campoArea(k, etiqueta, ph, valor) {
    return '<div class="campo"><label for="c_' + k + '">' + etiqueta + '</label>' +
      '<textarea id="c_' + k + '" data-k="' + k + '" placeholder="' + esc(ph) + '">' + esc(valor) + '</textarea></div>';
  }

  raiz.Weiss = {
    esc: esc, $: $, $$: $$, toast: toast, copiar: copiar,
    waNum: waNum, waLink: waLink,
    raizDe: raizDe, almacen: almacen,
    dosD: dosD, hash: hash, campoArea: campoArea
  };
})(window);
