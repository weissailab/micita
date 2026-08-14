/* MiCita — página de citas para negocios pequeños.
   Todo vive en el link: no hay servidor, ni base de datos, ni cuentas.
   Weiss AI Lab */
(function () {
  'use strict';

  /* El kit compartido de los productos libres. Lo carga core/core.js, que va
     antes que este archivo en index.html. */
  var W = window.Weiss;

  var NEQUI = '3171715071';
  var SOPORTE_WA = '573171715071';
  var WEB = 'https://weissailab.com';
  var API = 'https://panel.weissailab.com';
  var APP = document.getElementById('app');

  /* La dirección de esta copia de la app, sin el archivo ni el fragmento.
     De aquí sale el link que se comparte y el que codifica el QR. */
  var BASE = W.raizDe();

  /**
   * Corrige BASE cuando la app se sirvió por una dirección fija.
   *
   * En micita.weissailab.com/subarberia el 404.html carga la aplicación desde
   * una ruta que NO es su raíz, así que `location.pathname` trae el nombre del
   * negocio. Sin quitarlo, el crédito "haz la tuya gratis" de esa página
   * llevaría de vuelta a la página del mismo negocio en vez de a MiCita — que
   * es justo el enlace del que depende que el producto se propague.
   *
   * El cómo vive en el core porque este mismo fallo ya se comió a MiCarta y a
   * MiCita por separado, con dos nombres distintos. El slug ya viene validado
   * contra [a-z0-9-] por el ruteador.
   */
  function fijarBase(slug) {
    BASE = W.raizDe(slug);
  }


  /* ---------------- cuenta (modo 2: con Google) ----------------
     MiCita funciona de dos maneras y las dos son de verdad:

     ANONIMO   — la pagina viaja dentro del link. Cero registro, cero datos en
                 ningun servidor. No se degrada nunca.
     CON CUENTA — la pagina vive en el servidor y el negocio escoge su direccion
                 fija micita.weissailab.com/subarberia. Cambia precios y
                 horarios, y EL QR IMPRESO SIGUE SIRVIENDO. Que es justo lo que
                 el modo anonimo no puede dar.

     La identidad de la pagina va SEPARADA de la sesion, y esto no es un detalle:
     en MiCarta se guardo el id dentro de la sesion y al crear una segunda carta
     el QR apuntaba a la primera, con "Guardar cambios" a punto de escribirle
     encima. Aqui `cuenta` dice QUIEN eres y `edicion` dice QUE pagina tienes
     abierta; empezar de cero borra las dos. */

  var cuenta = null;   // { token, email }
  var edicion = null;  // { paginaId, nombreCorto }

  function cuentaCargar() {
    try { cuenta = JSON.parse(localStorage.getItem('micita:cuenta') || 'null'); } catch (e) { cuenta = null; }
    try { edicion = JSON.parse(localStorage.getItem('micita:edicion') || 'null'); } catch (e) { edicion = null; }
  }

  function cuentaGuardar(c) {
    cuenta = c;
    try {
      if (c) localStorage.setItem('micita:cuenta', JSON.stringify(c));
      else localStorage.removeItem('micita:cuenta');
    } catch (e) {}
  }

  function edicionGuardar(e) {
    edicion = e;
    try {
      if (e) localStorage.setItem('micita:edicion', JSON.stringify(e));
      else localStorage.removeItem('micita:edicion');
    } catch (e2) {}
  }

  function hayCuenta() { return Boolean(cuenta && cuenta.token); }
  function enServidor() { return Boolean(hayCuenta() && edicion && edicion.paginaId); }

  /** La direccion fija, si esta pagina ya la reservo. */
  function direccionFija() {
    return edicion && edicion.nombreCorto ? BASE + edicion.nombreCorto : '';
  }

  function urlEntrar(volver) {
    return API + '/micita/entrar?volver=' +
      encodeURIComponent(location.origin + location.pathname + (volver || '#/listo'));
  }

  /* El token llega en el fragmento, que no viaja al servidor. Se guarda y se
     borra de la barra de direcciones enseguida para que no quede en el historial
     ni en un pantallazo. */
  function recogerToken() {
    var m = location.hash.match(/[#&]t=([^&]+)/);
    if (!m) return;
    var token = m[1];
    var datos = {};
    try {
      datos = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {}
    cuentaGuardar({ token: token, email: datos.email || (cuenta && cuenta.email) || '' });
    var limpio = location.hash.replace(/[#&]t=[^&]*/, '');
    if (limpio === '#' || limpio === '') limpio = '#/listo';
    history.replaceState(null, '', location.pathname + limpio);
  }

  async function api(ruta, opciones) {
    opciones = opciones || {};
    var cab = { 'Content-Type': 'application/json' };
    if (hayCuenta()) cab.Authorization = 'Bearer ' + cuenta.token;
    var res = await fetch(API + ruta, {
      method: opciones.metodo || 'GET',
      headers: cab,
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
    });
    var cuerpo = null;
    try { cuerpo = await res.json(); } catch (e) {}
    // 401 = el token caduco o lo revocaron: se olvida y se vuelve a modo anonimo.
    if (res.status === 401 && cuenta) cuentaGuardar(null);
    return { estado: res.status, datos: cuerpo };
  }

  /* Un QR deja de ser escaneable de un celular más o menos a los 2.900
     caracteres. Aquí no hay fotos, así que el link nunca se acerca — pero el
     medidor avisa si alguien carga 40 servicios. */
  var TOPE_QR = 2900;

  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  /* ---------------------------------------------------------------
     RUBROS
     El rubro solo decide con qué arranca el editor: nombre de los
     servicios típicos y el rótulo. Después el dueño cambia lo que quiera.
     --------------------------------------------------------------- */
  var RUBROS = {
    barberia:   { ic: '💈', nom: 'Barbería',        rot: 'Barbería',        sv: [['Corte', 30, 25000], ['Corte + barba', 45, 35000], ['Barba', 20, 15000]] },
    unas:       { ic: '💅', nom: 'Uñas',            rot: 'Manicura y pedicura', sv: [['Manicura semipermanente', 60, 45000], ['Pedicura', 60, 40000], ['Retiro', 30, 15000]] },
    peluqueria: { ic: '💇', nom: 'Peluquería',      rot: 'Peluquería',      sv: [['Corte', 45, 35000], ['Tinte', 120, 120000], ['Cepillado', 45, 30000]] },
    spa:        { ic: '🧖', nom: 'Spa y masajes',   rot: 'Spa',             sv: [['Masaje relajante', 60, 90000], ['Limpieza facial', 60, 80000]] },
    odonto:     { ic: '🦷', nom: 'Odontología',     rot: 'Consultorio odontológico', sv: [['Valoración', 30, 0], ['Limpieza dental', 45, 90000], ['Control', 20, 0]] },
    salud:      { ic: '🩺', nom: 'Salud y terapias', rot: 'Consultorio',    sv: [['Consulta', 40, 0], ['Control', 25, 0]] },
    vet:        { ic: '🐾', nom: 'Veterinaria',     rot: 'Veterinaria',     sv: [['Consulta', 30, 0], ['Baño y peluquería', 90, 45000], ['Vacunación', 20, 0]] },
    taller:     { ic: '🔧', nom: 'Taller / mecánica', rot: 'Taller',        sv: [['Diagnóstico', 45, 0], ['Cambio de aceite', 60, 0], ['Revisión general', 90, 0]] },
    otro:       { ic: '📅', nom: 'Otro',            rot: '',                sv: [['Servicio', 30, 0]] }
  };

  var TEMAS = {
    indigo:    { nom: 'Índigo',    c: '#4F46E5' },
    esmeralda: { nom: 'Esmeralda', c: '#0E9F6E' },
    naranja:   { nom: 'Naranja',   c: '#EA580C' },
    rosa:      { nom: 'Rosa',      c: '#DB2777' },
    negro:     { nom: 'Negro',     c: '#18181B' }
  };

  /* ---------------------------------------------------------------
     UTILIDADES
     Lo que no sabe nada de citas vive en el core (core/core.js, copia de
     Activos/weiss-core/web/core.js en el repo del Lab). Aquí solo se le
     pone nombre corto para no tocar los sitios donde se usa.
     --------------------------------------------------------------- */

  var esc = W.esc, $ = W.$, $$ = W.$$;
  var toast = W.toast, copiar = W.copiar;
  var waNum = W.waNum, waLink = W.waLink;
  var dosD = W.dosD, hash = W.hash;

  /* 'HH:MM' -> minutos desde medianoche, y al revés. Toda la aritmética de
     horarios se hace en minutos: sumar 45 a las 23:30 con cadenas es pedir un
     bug, y con Date hay que preocuparse por el cambio de día. */
  function aMin(hhmm) {
    var p = String(hhmm || '').split(':');
    return (+p[0] || 0) * 60 + (+p[1] || 0);
  }

  function aHHMM(min) {
    return dosD(Math.floor(min / 60) % 24) + ':' + dosD(min % 60);
  }

  function hora12(hhmm) {
    var m = aMin(hhmm);
    var hh = Math.floor(m / 60), mm = m % 60;
    var suf = hh < 12 ? 'a. m.' : 'p. m.';
    var h = hh % 12; if (h === 0) h = 12;
    return h + ':' + dosD(mm) + ' ' + suf;
  }

  function duracionBonita(min) {
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }

  function pesos(n) {
    n = +n || 0;
    if (!n) return '';
    return '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  /* Medianoche del día de `d` desplazado `n` días. Se construye con números
     para no arrastrar la hora ni depender de Date.parse. */
  function diaSuma(base, n) {
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n, 0, 0, 0, 0);
  }

  function mismaFecha(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function fechaLarga(d) {
    return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }

  /* ---------------------------------------------------------------
     EL MODELO
     Claves cortas: cada letra que se ahorra aquí es un módulo menos en
     el QR que el negocio va a pegar en el mostrador.
     --------------------------------------------------------------- */

  function nueva() {
    return {
      v: 1,
      t: 'barberia',
      th: 'indigo',
      n: '',                   /* nombre del negocio */
      fr: '',                  /* frase corta */
      sv: [],                  /* servicios: [nombre, minutos, precio] */
      ho: [[], [], [], [], [], [], []],  /* horario por día, 0 = domingo; cada día es una lista de turnos ['09:00','18:00'] */
      gr: 30,                  /* cada cuánto arranca una cita, en minutos */
      an: 2,                   /* anticipación mínima, en horas */
      dd: 21,                  /* hasta cuántos días adelante se puede pedir */
      di: '',                  /* dirección */
      w: '',                   /* WhatsApp del negocio */
      no: '',                  /* nota o políticas */
      ab: 0,                   /* monto del abono para separar (0 = no se pide) */
      nq: '',                  /* Nequi del negocio para ese abono */
      cr: 1                    /* mostrar el crédito de MiCita */
    };
  }

  var S = nueva();
  var borrador = W.almacen('micita:borrador');

  function guardar() { borrador.guardar(S); }
  function cargar() { S = borrador.cargar(nueva()); }

  function codificar(d) { return LZString.compressToEncodedURIComponent(JSON.stringify(d)); }

  function decodificar(c) {
    try {
      var j = LZString.decompressFromEncodedURIComponent(c);
      if (!j) return null;
      var d = JSON.parse(j);
      var base = nueva();
      for (var k in base) if (d[k] !== undefined) base[k] = d[k];
      /* El horario tiene que tener siempre 7 posiciones: si un link viejo o
         manipulado trae menos, `ho[dia]` sería undefined al generar franjas. */
      if (!Array.isArray(base.ho)) base.ho = [[], [], [], [], [], [], []];
      while (base.ho.length < 7) base.ho.push([]);
      return base;
    } catch (e) { return null; }
  }

  function linkNegocio(d) { return BASE + '#/n/' + codificar(d); }
  function linkEdicion(d) { return BASE + '#/e/' + codificar(d); }

  function completo(d) {
    var hay = (d.ho || []).some(function (t) { return t && t.length; });
    return !!((d.n || '').trim() && (d.sv || []).length && hay && d.w);
  }

  /* ---------------------------------------------------------------
     LA AGENDA
     Lo único con algo de matemática del producto. Genera las horas a
     las que se puede empezar un servicio en un día dado.
     --------------------------------------------------------------- */

  /** Horas disponibles de `fecha` para un servicio de `dur` minutos. */
  function franjas(d, fecha, dur) {
    var turnos = (d.ho && d.ho[fecha.getDay()]) || [];
    var paso = Math.max(5, +d.gr || 30);
    /* El mínimo de anticipación se mide contra AHORA, no contra el arranque
       del día: si son las 3 p. m. y el negocio pide 2 horas, las 4 p. m. de
       hoy no puede aparecer. */
    var noAntes = Date.now() + (+d.an || 0) * 3600000;
    var out = [];

    turnos.forEach(function (t) {
      if (!t || !t[0] || !t[1]) return;
      var ini = aMin(t[0]), fin = aMin(t[1]);
      if (fin <= ini) return; /* un turno que cierra antes de abrir no genera nada */
      for (var m = ini; m + dur <= fin; m += paso) {
        var cuando = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, m, 0, 0);
        if (cuando.getTime() >= noAntes) out.push(aHHMM(m));
      }
    });

    /* Dos turnos pueden solaparse si el dueño se equivoca al escribirlos. */
    return out.filter(function (h, i) { return out.indexOf(h) === i; }).sort();
  }

  /** Los próximos días que tienen al menos una hora libre. */
  function diasConCupo(d, dur) {
    var hoy = new Date();
    var tope = Math.min(90, Math.max(1, +d.dd || 21));
    var out = [];
    for (var i = 0; i <= tope; i++) {
      var f = diaSuma(hoy, i);
      if (franjas(d, f, dur).length) out.push(f);
    }
    return out;
  }

  /** El horario, resumido para mostrarlo: agrupa días seguidos e iguales. */
  function horarioResumen(d) {
    var partes = [];
    var i = 0;
    var texto = function (dia) {
      var t = (d.ho[dia] || []).filter(function (x) { return x && x[0] && x[1]; });
      if (!t.length) return null;
      return t.map(function (x) { return hora12(x[0]) + ' a ' + hora12(x[1]); }).join(' y ');
    };
    /* Se recorre lunes→domingo, que es como lo lee la gente. */
    var orden = [1, 2, 3, 4, 5, 6, 0];
    while (i < orden.length) {
      var t = texto(orden[i]);
      if (!t) { i++; continue; }
      var j = i;
      while (j + 1 < orden.length && texto(orden[j + 1]) === t) j++;
      var etiqueta = i === j ? DIAS_C[orden[i]] : DIAS_C[orden[i]] + ' a ' + DIAS_C[orden[j]];
      partes.push(etiqueta + ' ' + t);
      i = j + 1;
    }
    return partes;
  }

  /* ---------------------------------------------------------------
     RUTEO
     --------------------------------------------------------------- */

  var limpiadores = [];
  function limpiar() {
    while (limpiadores.length) { try { limpiadores.pop()(); } catch (e) {} }
  }

  function ir(hash) {
    if (location.hash === hash) pintar();
    else location.hash = hash;
  }

  function pintar() {
    limpiar();
    // Se relee en cada navegacion, no solo al arrancar: si el dueno entro en
    // otra pestana, esta se entera sin tener que recargar.
    cuentaCargar();
    var h = location.hash.replace(/^#/, '');

    /* Direccion fija: micita.weissailab.com/subarberia
       GitHub Pages sirve 404.html para cualquier ruta que no exista como
       archivo, y ese archivo carga esta misma aplicacion. Asi el nombre corto es
       una URL limpia sin servidor propio y sin un archivo por negocio. */
    var ruta = location.pathname.replace(/^\/+|\/+$/g, '');
    if (ruta && /^[a-z0-9][a-z0-9-]{1,29}$/.test(ruta) && !h) {
      fijarBase(ruta);
      return vistaPorNombre(ruta);
    }

    var mn = h.match(/^\/n\/(.+)$/);
    if (mn) {
      var d = decodificar(mn[1]);
      if (!d) return vistaError();
      return vistaNegocio(d);
    }

    var me = h.match(/^\/e\/(.+)$/);
    if (me) {
      var e = decodificar(me[1]);
      if (e) { S = e; guardar(); }
      return ir('#/crear');
    }

    if (h === '/crear') return vistaEditor();
    if (h === '/listo') return vistaListo();
    if (h === '/ejemplo') return vistaNegocio(ejemplo());
    if (h === '/mis-paginas') {
      if (!hayCuenta()) { location.href = urlEntrar('#/mis-paginas'); return; }
      return vistaMisPaginas();
    }
    if (h === '/lleno') return vistaLleno();
    return vistaLanding();
  }

  function vistaError() {
    document.title = 'Página no encontrada — MiCita';
    APP.className = '';
    APP.innerHTML = '<div class="wrap centro">' +
      '<div class="card"><h2>Este link no se pudo abrir 😕</h2>' +
      '<p class="cs">Puede que se haya cortado al copiarlo o al pegarlo. Pídele al negocio que te lo mande otra vez completo.</p>' +
      '<a class="btn" href="' + esc(BASE) + '">Ir a MiCita</a></div></div>';
  }

  /* ---------------------------------------------------------------
     LANDING
     --------------------------------------------------------------- */

  function vistaLanding() {
    document.title = 'MiCita — que te pidan cita sin llamarte, gratis';
    APP.className = '';
    var hay = !!(S.n || (S.sv || []).length);

    APP.innerHTML =
      '<div class="wrap">' +
        '<div class="hero">' +
          '<div class="kicker">Weiss AI Lab</div>' +
          '<h1>Que te pidan cita<br><em>sin llamarte</em></h1>' +
          '<p>Barberías, uñas, spa, consultorios, veterinarias y talleres. Tu cliente escoge servicio, día y hora, y a ti te llega la cita por WhatsApp ya escrita.</p>' +
          '<div class="btns">' +
            '<button class="btn" data-act="crear">' + (hay ? 'Seguir con la mía' : 'Crear mi página de citas') + '</button>' +
            '<a class="btn ghost" href="#/ejemplo">Ver un ejemplo</a>' +
            (hayCuenta() ? '<a class="btn ghost" href="#/mis-paginas">Mis páginas</a>' : '') +
          '</div>' +
          '<p class="cs" style="margin-top:14px">Gratis · sin registro · sin instalar nada</p>' +
        '</div>' +

        '<div class="card">' +
          '<ul class="puntos">' +
            '<li><span class="ic">📅</span><div><b>Tus horarios, tus reglas</b><span class="cs">Pones a qué horas abres cada día y cuánto dura cada servicio. La página solo ofrece horas que de verdad te sirven.</span></div></li>' +
            '<li><span class="ic">💬</span><div><b>La cita llega por WhatsApp, ya escrita</b><span class="cs">«Corte + barba, sábado 10:30 a. m. — Andrés». Sin transcribir nada y sin que se pierda en la conversación.</span></div></li>' +
            '<li><span class="ic">📱</span><div><b>Con QR para el mostrador</b><span class="cs">Lo pegas en el espejo o en la vitrina. Quien pasa, escanea y pide su cita sin hablar con nadie.</span></div></li>' +
            '<li><span class="ic">⏰</span><div><b>Nada de citas a última hora</b><span class="cs">Le pones cuánta anticipación necesitas y hasta cuántos días adelante te pueden pedir.</span></div></li>' +
            '<li><span class="ic">💵</span><div><b>Abono para separar, si quieres</b><span class="cs">Muestras tu Nequi y el monto. El dinero te llega directo: MiCita no toca un peso.</span></div></li>' +
            '<li><span class="ic">📌</span><div><b>Y una dirección que no se muere</b><span class="cs">Entrando con Google escoges algo como <code>' + esc(BASE.replace(/^https?:\/\//, '')) + 'tunegocio</code>. Cambias precios y horarios, y el QR que ya imprimiste sigue sirviendo. Gratis también.</span></div></li>' +
          '</ul>' +
        '</div>' +

        '<div class="card">' +
          '<h2>Cómo funciona</h2>' +
          '<ol class="pasos">' +
            '<li>Pones tus servicios y a qué horas atiendes.</li>' +
            '<li>Te queda un link y un QR. Nada se guarda en ningún servidor: tu agenda viaja dentro del link.</li>' +
            '<li>Lo pones en tu bio de Instagram o lo pegas en el mostrador. Las citas te llegan al WhatsApp.</li>' +
          '</ol>' +
          '<div class="aviso amb" style="margin-top:14px"><b>Para que quede claro:</b> MiCita no reemplaza tu agenda. El cliente te <i>pide</i> la cita y tú confirmas — así nadie te aparta un cupo que ya tenías ocupado.</div>' +
        '</div>' +

        '<div class="card nequi">' +
          '<h3>¿Por qué es gratis?</h3>' +
          '<p class="cs">Porque no cuesta nada operarlo: no hay servidor detrás. Si te sirvió y quieres que siga así para el que viene detrás, me mandas lo que consideres a Nequi.</p>' +
          '<div class="num">Nequi ' + NEQUI + '</div>' +
          '<div class="btns"><button class="btn ghost chico" data-act="copiar-nequi">Copiar el número</button></div>' +
        '</div>' +

        pie() +
      '</div>';

    APP.onclick = function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'crear') {
        if (!(S.sv || []).length) {
          /* Empezar de cero borra el contenido Y la identidad. Si se olvidara la
             identidad, "Guardar cambios" escribiria encima de la página anterior
             y su QR terminaría apuntando al negocio equivocado. */
          S = conRubro(nueva(), 'barberia');
          edicionGuardar(null);
          guardar();
        }
        return ir('#/crear');
      }
      if (a === 'copiar-nequi') copiar(NEQUI, 'Número de Nequi copiado 🙏');
    };
  }

  /** Rellena servicios y horario típicos del rubro. */
  function conRubro(d, rubro) {
    var R = RUBROS[rubro] || RUBROS.otro;
    d.t = rubro;
    d.sv = R.sv.map(function (s) { return s.slice(); });
    /* Lunes a viernes 9-6 con almuerzo, sábado 9-2, domingo cerrado: el
       horario más común del comercio pequeño en Colombia. */
    d.ho = [
      [],
      [['09:00', '12:30'], ['14:00', '18:00']],
      [['09:00', '12:30'], ['14:00', '18:00']],
      [['09:00', '12:30'], ['14:00', '18:00']],
      [['09:00', '12:30'], ['14:00', '18:00']],
      [['09:00', '12:30'], ['14:00', '18:00']],
      [['09:00', '14:00']]
    ];
    return d;
  }

  function ejemplo() {
    var d = conRubro(nueva(), 'barberia');
    d.n = 'Barbería El Rey';
    d.fr = 'Cortes clásicos y barba caliente, en el centro de Cali.';
    d.di = 'Calle 12 #5-40, Cali';
    d.w = '3001234567';
    d.no = 'Llega 5 minutos antes.\nSi no puedes venir, avísame con 2 horas y liberamos el cupo.';
    d.th = 'negro';
    d.ab = 10000;
    d.nq = '3001234567';
    return d;
  }

  /* ---------------------------------------------------------------
     EDITOR
     --------------------------------------------------------------- */

  function vistaEditor() {
    document.title = 'Armando tu página de citas — MiCita';
    APP.className = '';

    APP.innerHTML =
      '<div class="barra">' +
        '<div class="marca"><span>📅</span> MiCita</div>' +
        (hayCuenta() ? '<a class="btn ghost chico" href="#/mis-paginas">Mis páginas</a>' : '') +
        '<button class="btn ghost chico" data-act="inicio">Salir</button>' +
        '<button class="btn chico" data-act="listo">' + (enServidor() ? 'Guardar →' : 'Ya está lista →') + '</button>' +
      '</div>' +
      '<div class="wrap ancho"><div class="col2">' +
        '<div class="principal">' +

          '<div class="card">' +
            '<h3>¿Qué tipo de negocio tienes?</h3>' +
            '<p class="cs">Solo sirve para arrancar con servicios de ejemplo. Después cambias lo que quieras.</p>' +
            '<div class="chips">' + Object.keys(RUBROS).map(function (k) {
              return '<button class="chip" data-rubro="' + k + '" aria-pressed="' + (S.t === k) + '">' +
                RUBROS[k].ic + ' ' + esc(RUBROS[k].nom) + '</button>';
            }).join('') + '</div>' +
          '</div>' +

          '<div class="card">' +
            '<h3>Tu negocio</h3>' +
            campo('n', 'Nombre', 'Barbería El Rey', 'text') +
            campo('fr', 'Frase corta <span class="pista">opcional</span>', 'Cortes clásicos, en el centro de Cali.', 'text') +
            campo('di', 'Dirección <span class="pista">con esto se arma el botón «cómo llegar»</span>', 'Calle 12 #5-40, Cali', 'text') +
            campo('w', 'Tu WhatsApp <span class="pista">a este número te llegan las citas</span>', '3001234567', 'tel') +
          '</div>' +

          '<div class="card">' +
            '<h3>Tus servicios</h3>' +
            '<p class="cs">La duración es lo que hace que las horas ofrecidas te cuadren. Deja el precio en cero si prefieres no mostrarlo.</p>' +
            '<div class="lista" id="servicios">' + S.sv.map(function (s, i) {
              return '<div class="it" data-i="' + i + '">' +
                '<input class="nom" data-sv="0" type="text" placeholder="Corte" value="' + esc(s[0]) + '">' +
                '<input class="min" data-sv="1" type="number" min="5" step="5" inputmode="numeric" placeholder="30" value="' + esc(s[1]) + '" aria-label="Minutos">' +
                '<input class="pre" data-sv="2" type="number" min="0" step="1000" inputmode="numeric" placeholder="Precio" value="' + esc(s[2] || '') + '" aria-label="Precio">' +
                '<button class="quitar" data-act="quitar-sv" aria-label="Quitar">✕</button></div>';
            }).join('') + '</div>' +
            '<div class="cs" style="margin:6px 0 10px">nombre · minutos · precio</div>' +
            '<button class="btn ghost chico" data-act="mas-sv">+ Agregar un servicio</button>' +
          '</div>' +

          '<div class="card">' +
            '<h3>¿A qué horas atiendes?</h3>' +
            '<div id="horario">' + [1, 2, 3, 4, 5, 6, 0].map(filaDia).join('') + '</div>' +
            '<button class="btn ghost chico" data-act="copiar-lunes" style="margin-top:10px">Copiar el lunes a los demás días</button>' +
          '</div>' +

          '<div class="card">' +
            '<h3>Reglas</h3>' +
            '<div class="campo"><label for="c_gr">Las citas empiezan cada</label>' +
              '<select id="c_gr" data-k="gr">' + [15, 20, 30, 45, 60].map(function (n) {
                return '<option value="' + n + '"' + (+S.gr === n ? ' selected' : '') + '>' + n + ' minutos</option>';
              }).join('') + '</select></div>' +
            '<div class="campo"><label for="c_an">Necesito al menos</label>' +
              '<select id="c_an" data-k="an">' + [[0, 'Sin mínimo: pueden pedir para ya'], [1, '1 hora de anticipación'], [2, '2 horas de anticipación'], [12, '12 horas de anticipación'], [24, 'Un día de anticipación']].map(function (o) {
                return '<option value="' + o[0] + '"' + (+S.an === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
              }).join('') + '</select></div>' +
            '<div class="campo"><label for="c_dd">Me pueden pedir cita hasta</label>' +
              '<select id="c_dd" data-k="dd">' + [[7, 'Una semana adelante'], [15, 'Quince días adelante'], [21, 'Tres semanas adelante'], [30, 'Un mes adelante'], [60, 'Dos meses adelante']].map(function (o) {
                return '<option value="' + o[0] + '"' + (+S.dd === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
              }).join('') + '</select></div>' +
            campoArea('no', 'Nota para tus clientes <span class="pista">opcional: políticas, cómo llegar, qué llevar</span>', 'Llega 5 minutos antes.\nSi no puedes venir, avísame con 2 horas.') +
          '</div>' +

          '<div class="card">' +
            '<h3>Abono para separar <span class="cs">(opcional)</span></h3>' +
            '<p class="cs">Si cobras algo por adelantado para que no te dejen colgado, aquí se lo muestras. El dinero le llega directo a tu Nequi.</p>' +
            '<div class="fila">' +
              campo('ab', 'Monto', '10000', 'number') +
              campo('nq', 'Tu Nequi', '3001234567', 'tel') +
            '</div>' +
          '</div>' +

          '<div class="card">' +
            '<h3>Color</h3>' +
            '<div class="temas">' + Object.keys(TEMAS).map(function (k) {
              return '<button class="tema-op" data-tema="' + k + '" aria-pressed="' + (S.th === k) + '" ' +
                'style="background:' + TEMAS[k].c + '" title="' + esc(TEMAS[k].nom) + '" aria-label="' + esc(TEMAS[k].nom) + '"></button>';
            }).join('') + '</div>' +
          '</div>' +

          '<div class="btns" style="margin-bottom:26px"><button class="btn ancho" data-act="listo">Ya está lista →</button></div>' +
        '</div>' +

        '<div class="lado">' +
          '<div class="card" style="padding:14px">' +
            '<h3 style="margin-bottom:4px">Así la ven tus clientes</h3>' +
            '<p class="cs" style="margin-bottom:12px">Puedes probarla aquí mismo.</p>' +
            '<div class="marco"><div class="pantalla previa-envoltorio" id="previa"></div></div>' +
            '<div id="peso" style="margin-top:12px"></div>' +
          '</div>' +
        '</div>' +
      '</div></div>';

    APP.oninput = function (ev) {
      var el = ev.target;
      var k = el.getAttribute('data-k');
      if (k) {
        S[k] = (el.type === 'number' || el.tagName === 'SELECT') ? (+el.value || 0) : el.value;
        if (k === 'nq' || k === 'w') S[k] = el.value;
        guardar(); return previa();
      }
      var isv = el.getAttribute('data-sv');
      if (isv !== null) {
        var i = +el.closest('.it').getAttribute('data-i');
        if (S.sv[i]) {
          S.sv[i][+isv] = +isv === 0 ? el.value : (+el.value || 0);
          guardar(); previa();
        }
        return;
      }
      var t = el.getAttribute('data-turno');
      if (t) {
        var p = t.split(':');   /* dia:indiceTurno:0|1 */
        var lista = S.ho[+p[0]];
        if (lista && lista[+p[1]]) {
          lista[+p[1]][+p[2]] = el.value;
          guardar(); previa();
        }
      }
    };

    APP.onchange = APP.oninput;

    APP.onclick = function (ev) {
      var el = ev.target.closest('[data-rubro],[data-tema],[data-act]');
      if (!el) return;

      if (el.hasAttribute('data-rubro')) {
        var r = el.getAttribute('data-rubro');
        /* Solo se pisan los servicios si el dueño no los ha tocado: cambiar de
           rubro por curiosidad no puede borrarle media hora de trabajo. */
        var vacio = !S.sv.length || S.sv.every(function (s) { return !s[0]; });
        var iguales = JSON.stringify(S.sv) === JSON.stringify((RUBROS[S.t] || RUBROS.otro).sv);
        S.t = r;
        if (vacio || iguales) S.sv = (RUBROS[r] || RUBROS.otro).sv.map(function (s) { return s.slice(); });
        guardar();
        return vistaEditor();
      }
      if (el.hasAttribute('data-tema')) {
        S.th = el.getAttribute('data-tema');
        guardar();
        $$('.tema-op').forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-tema') === S.th));
        });
        return previa();
      }

      var a = el.getAttribute('data-act');
      if (a === 'inicio') return ir('#/');
      if (a === 'listo') {
        if (!completo(S)) return toast('Faltan el nombre, un servicio, el horario o tu WhatsApp');
        return ir('#/listo');
      }
      if (a === 'mas-sv') { S.sv.push(['', 30, 0]); guardar(); return vistaEditor(); }
      if (a === 'quitar-sv') {
        S.sv.splice(+el.closest('.it').getAttribute('data-i'), 1);
        guardar(); return vistaEditor();
      }
      if (a === 'dia-toggle') {
        var dia = +el.getAttribute('data-dia');
        S.ho[dia] = S.ho[dia] && S.ho[dia].length ? [] : [['09:00', '18:00']];
        guardar(); return vistaEditor();
      }
      if (a === 'mas-turno') {
        var d2 = +el.getAttribute('data-dia');
        S.ho[d2].push(['14:00', '18:00']);
        guardar(); return vistaEditor();
      }
      if (a === 'quitar-turno') {
        var p = el.getAttribute('data-turno-i').split(':');
        S.ho[+p[0]].splice(+p[1], 1);
        guardar(); return vistaEditor();
      }
      if (a === 'copiar-lunes') {
        var base = (S.ho[1] || []).map(function (t) { return t.slice(); });
        if (!base.length) return toast('Primero abre el lunes');
        [2, 3, 4, 5, 6].forEach(function (i) { S.ho[i] = base.map(function (t) { return t.slice(); }); });
        guardar();
        vistaEditor();
        return toast('Copiado de martes a sábado');
      }
    };

    previa();
  }

  function filaDia(dia) {
    var turnos = S.ho[dia] || [];
    var abierto = turnos.length > 0;
    return '<div class="dia-fila">' +
      '<div class="dia-cab">' +
        '<button class="interruptor" data-act="dia-toggle" data-dia="' + dia + '" aria-pressed="' + abierto + '" aria-label="' + DIAS[dia] + '"></button>' +
        '<span class="nom">' + DIAS[dia].charAt(0).toUpperCase() + DIAS[dia].slice(1) + '</span>' +
        (abierto ? '' : '<span class="cerrado">Cerrado</span>') +
      '</div>' +
      (abierto ? '<div class="turnos">' + turnos.map(function (t, i) {
        return '<div class="turno">' +
          '<input type="time" data-turno="' + dia + ':' + i + ':0" value="' + esc(t[0]) + '" aria-label="Abre">' +
          '<span class="a">a</span>' +
          '<input type="time" data-turno="' + dia + ':' + i + ':1" value="' + esc(t[1]) + '" aria-label="Cierra">' +
          (turnos.length > 1 ? '<button class="quitar" data-act="quitar-turno" data-turno-i="' + dia + ':' + i + '" aria-label="Quitar turno">✕</button>' : '') +
        '</div>';
      }).join('') +
        (turnos.length < 3 ? '<button class="btn ghost chico" data-act="mas-turno" data-dia="' + dia + '">+ Otro turno (almuerzo)</button>' : '') +
      '</div>' : '') +
    '</div>';
  }

  function campo(k, etiqueta, ph, tipo) {
    return '<div class="campo"><label for="c_' + k + '">' + etiqueta + '</label>' +
      '<input id="c_' + k + '" data-k="' + k + '" type="' + tipo + '" placeholder="' + esc(ph) + '" value="' + esc(S[k] || '') + '"' +
      (tipo === 'tel' || tipo === 'number' ? ' inputmode="numeric"' : '') + '></div>';
  }

  function campoArea(k, etiqueta, ph) { return W.campoArea(k, etiqueta, ph, S[k]); }

  var previaT = null;
  function previa() {
    clearTimeout(previaT);
    previaT = setTimeout(function () {
      var cont = $('#previa');
      if (!cont) return;
      var arriba = cont.scrollTop;
      pintarNegocio(cont, S, { previa: true });
      cont.scrollTop = arriba;
      pintarPeso();
    }, 180);
  }

  function pintarPeso() {
    var caja = $('#peso');
    if (!caja) return;
    var n = linkNegocio(S).length;
    var pct = Math.min(100, Math.round(n / TOPE_QR * 100));
    var texto = pct > 90
      ? 'Con tantos servicios el QR queda muy denso y cuesta escanearlo. Quita algunos.'
      : 'El link es corto, así que el QR va a escanear de una 👌';
    caja.innerHTML = '<div class="cs">' + esc(texto) + ' <span style="opacity:.6">(' + n + ' caracteres)</span></div>';
  }

  /* ---------------------------------------------------------------
     PANTALLA DE «YA ESTÁ LISTA»
     --------------------------------------------------------------- */

  function vistaListo() {
    if (!completo(S)) return ir('#/crear');
    document.title = 'Tu página de citas está lista — MiCita';
    APP.className = '';

    /* El link que se comparte y el que codifica el QR es el CORTO en cuanto
       exista: es el único que sobrevive a que el dueño cambie un precio. */
    var fija = direccionFija();
    var link = fija || linkNegocio(S);
    var edic = linkEdicion(S);

    APP.innerHTML =
      '<div class="barra">' +
        '<div class="marca"><span>📅</span> MiCita</div>' +
        (hayCuenta() ? '<a class="btn ghost chico" href="#/mis-paginas">Mis páginas</a>' : '') +
        '<button class="btn ghost chico" data-act="volver">← Seguir editando</button>' +
      '</div>' +
      '<div class="wrap">' +
        '<div class="centro" style="padding:14px 0 6px">' +
          '<h1>¡Tu página de citas está lista!</h1>' +
          '<p class="cs">Ponla donde tus clientes la vean: la bio de Instagram, tu estado de WhatsApp y el mostrador.</p>' +
        '</div>' +

        bloqueDireccion(fija) +

        '<div class="card">' +
          '<h3>Tu link</h3>' +
          '<div class="linkbox" style="margin-bottom:12px">' + esc(link) + '</div>' +
          '<div class="btns">' +
            '<button class="btn" data-act="compartir">Compartir</button>' +
            '<button class="btn ghost" data-act="copiar-link">Copiar el link</button>' +
            '<a class="btn ghost" href="' + esc(link) + '" target="_blank" rel="noopener">Abrirla</a>' +
          '</div>' +
        '</div>' +

        '<div class="card qr-caja">' +
          '<h3>Tu código QR</h3>' +
          '<p class="cs">Imprímelo y pégalo en el espejo, la vitrina o el mostrador.</p>' +
          '<div id="qr"></div>' +
          '<div class="btns" style="justify-content:center">' +
            '<button class="btn ghost chico" data-act="bajar-qr">Descargar el QR</button>' +
          '</div>' +
        '</div>' +

        (fija ? '' :
        '<div class="card">' +
          '<h3>Guarda esto para después</h3>' +
          '<p class="cs">Sin dirección fija no hay cuenta ni contraseña, así que <b>este es el único modo de volver a editar tu página</b>. Mándatelo a ti mismo por WhatsApp ahora y no lo pierdas.</p>' +
          '<div class="btns">' +
            '<a class="btn wa" target="_blank" rel="noopener" href="' + esc(waLink(SOPORTE_WA, 'Guardo aquí mi link de edición de MiCita (no lo pierdas): ' + edic)) + '">Mandármelo por WhatsApp</a>' +
            '<button class="btn ghost" data-act="copiar-edicion">Copiar el link de edición</button>' +
          '</div>' +
        '</div>') +

        '<div class="card nequi">' +
          '<h3>¿Te sirvió? 🙏</h3>' +
          '<p class="cs">MiCita es gratis y sin publicidad. Si te ahorra las llamadas de «¿tienes cupo?», mándame lo que consideres a Nequi. Con eso sigue siendo gratis para el que viene detrás.</p>' +
          '<div class="num">Nequi ' + NEQUI + '</div>' +
          '<div class="btns">' +
            '<button class="btn" data-act="copiar-nequi">Copiar el número</button>' +
            '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(waLink(SOPORTE_WA, '¡Hola! Ya armé mi página con MiCita y te acabo de enviar un aporte a Nequi 🙌')) + '">Ya lo hice ✅</a>' +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<h3>¿Prefieres que te la deje lista?</h3>' +
          '<p class="cs">Por <b>$20.000</b> te la armo yo: tus servicios con las duraciones reales, tus horarios y el aviso del QR listo para imprimir y pegar. Te la entrego el mismo día.</p>' +
          '<a class="btn plano" target="_blank" rel="noopener" href="' + esc(waLink(SOPORTE_WA, 'Hola, quiero que me dejes lista mi página de MiCita. Esta es la mía: ' + link)) + '">Pedirlo por WhatsApp</a>' +
        '</div>' +

        pie() +
      '</div>';

    dibujarQR(link);

    APP.onclick = function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'volver') return ir('#/crear');
      if (a === 'copiar-link') return copiar(link, 'Link copiado ✨');
      if (a === 'copiar-edicion') return copiar(edic, 'Link de edición copiado 🔐');
      if (a === 'copiar-nequi') return copiar(NEQUI, 'Número de Nequi copiado 🙏');
      if (a === 'entrar') { location.href = urlEntrar('#/listo'); return; }
      if (a === 'reservar') return reservarDireccion(b);
      if (a === 'guardar-cambios') return guardarCambios(b);
      if (a === 'bajar-qr') {
        var c = $('#qr canvas');
        if (c) bajarCanvas(c, 'qr-citas.png');
        return;
      }
      if (a === 'compartir') {
        var texto = 'Pide tu cita en ' + (S.n || 'mi negocio') + ' 👇\n' + link;
        if (navigator.share) navigator.share({ text: texto }).catch(function () {});
        else copiar(texto, 'Mensaje copiado, ya puedes pegarlo ✨');
      }
    };
  }

  /**
   * El bloque que convierte un QR desechable en uno que dura.
   *
   * Es la diferencia real entre los dos modos, así que se explica por la
   * consecuencia y no por la funcionalidad: sin dirección fija, cambiar un
   * precio mata todo lo que ya mandaste a imprimir.
   */
  function bloqueDireccion(fija) {
    var dominio = BASE.replace(/^https?:\/\//, '');

    if (fija) {
      return '<div class="card" style="border-color:#C7F0DD;background:linear-gradient(160deg,#ECFAF3,#fff)">' +
        '<h3>Tu dirección fija ✅</h3>' +
        '<div class="linkbox" style="margin-bottom:10px">' + esc(fija) + '</div>' +
        '<p class="cs">Esta dirección es tuya para siempre. Cambia precios y horarios las veces que quieras: <b>el QR que imprimiste sigue sirviendo</b>.</p>' +
        '<div class="btns"><button class="btn" data-act="guardar-cambios">Guardar cambios</button></div>' +
      '</div>';
    }

    if (!hayCuenta()) {
      return '<div class="card" style="border-color:#DDDAFB;background:linear-gradient(160deg,#F2F1FE,#fff)">' +
        '<h3>Que tu QR no se muera 📌</h3>' +
        '<p class="cs">Tal como está, <b>si cambias un precio o un horario el link cambia</b> y el código que imprimiste deja de servir.</p>' +
        '<p class="cs">Con una dirección fija del tipo <code>' + esc(dominio) + 'tunegocio</code> eso no pasa: editas cuando quieras y el QR pegado en el espejo sigue funcionando. Es gratis, solo entras con Google.</p>' +
        '<div class="btns"><button class="btn" data-act="entrar">Entrar con Google</button></div>' +
      '</div>';
    }

    return '<div class="card" style="border-color:#DDDAFB;background:linear-gradient(160deg,#F2F1FE,#fff)">' +
      '<h3>Escoge tu dirección fija 📌</h3>' +
      '<p class="cs">Con esto el QR impreso te sirve para siempre. <b>Se escoge una sola vez y no se puede cambiar</b>, porque queda pegado en tu mostrador.</p>' +
      '<div class="campo"><label for="corto">' + esc(dominio) + '</label>' +
        '<input id="corto" type="text" placeholder="subarberia" autocapitalize="off" autocorrect="off" spellcheck="false" value="' + esc(sugerirNombre(S.n)) + '"></div>' +
      '<div class="btns"><button class="btn" data-act="reservar">Reservar esta dirección</button></div>' +
    '</div>';
  }

  /** De "Barbería El Rey" sale "barberiaelrey". */
  function sugerirNombre(nombre) {
    return String(nombre || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 30);
  }

  function dibujarQR(link) {
    var caja = $('#qr');
    if (!caja) return;
    var cv = qrCanvas(link, 260);
    if (cv) caja.appendChild(cv);
    else caja.innerHTML = '<p class="cs">El link quedó muy largo para un QR. Quita algunos servicios.</p>';
  }

  function ocupado(boton, texto) {
    if (!boton) return;
    boton.setAttribute('data-antes', boton.textContent);
    boton.textContent = texto;
    boton.disabled = true;
  }

  function libre(boton) {
    if (!boton) return;
    var antes = boton.getAttribute('data-antes');
    if (antes) boton.textContent = antes;
    boton.disabled = false;
  }

  /* ---------------------------------------------------------------
     MODO CUENTA: guardar en el servidor
     --------------------------------------------------------------- */

  async function reservarDireccion(boton) {
    var campo = $('#corto');
    var n = (campo ? campo.value : '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(n)) {
      return toast('Solo letras, números y guiones. Entre 2 y 30 caracteres.');
    }

    ocupado(boton, 'Reservando…');
    /* Si esta página ya existe en el servidor pero todavía no tiene dirección,
       hay que ponérsela A ELLA: sin el pagina_id se crearía una duplicada. */
    var r = await api('/api/micita/pagina', {
      metodo: 'POST',
      cuerpo: {
        pagina_id: enServidor() ? edicion.paginaId : undefined,
        datos: S,
        nombre_corto: n,
      },
    });
    libre(boton);

    if (r.estado === 401) { toast('Se cerró tu sesión, entra otra vez'); return vistaListo(); }
    if (r.estado === 409 && r.datos && r.datos.error === 'demasiadas_paginas') return toast(r.datos.mensaje);
    if (r.estado === 409) return toast('Esa dirección ya la tiene otro negocio. Prueba con otra.');
    if (r.estado === 429) return toast('Vas muy rápido. Espera un momento.');
    if (r.estado === 400) return toast((r.datos && r.datos.mensaje) || 'Esa dirección está reservada. Escoge otra.');
    if (r.estado !== 200 && r.estado !== 201) return toast('No se pudo guardar. Revisa tu conexión.');

    var pg = r.datos.pagina;
    edicionGuardar({ paginaId: pg.pagina_id, nombreCorto: pg.nombre_corto });
    toast('Listo: tu dirección quedó fija 🎉');
    vistaListo();
  }

  async function guardarCambios(boton) {
    if (!enServidor()) return toast('Primero escoge tu dirección fija');
    ocupado(boton, 'Guardando…');
    var r = await api('/api/micita/pagina', {
      metodo: 'POST',
      cuerpo: { pagina_id: edicion.paginaId, datos: S },
    });
    libre(boton);
    if (r.estado === 401) { toast('Se cerró tu sesión, entra otra vez'); return vistaListo(); }
    if (r.estado !== 200 && r.estado !== 201) return toast('No se pudo guardar. Revisa tu conexión.');
    toast('Guardado. Tus clientes ya ven los cambios ✅');
  }

  /* ---------------------------------------------------------------
     MIS PÁGINAS (modo cuenta)
     --------------------------------------------------------------- */

  async function vistaMisPaginas() {
    document.title = 'Mis páginas — MiCita';
    APP.className = '';
    APP.innerHTML = '<div class="wrap"><p class="cs">Cargando tus páginas…</p></div>';

    var r = await api('/api/micita/pagina');
    if (r.estado === 401) { location.href = urlEntrar('#/mis-paginas'); return; }
    if (r.estado !== 200) {
      APP.innerHTML = '<div class="wrap"><div class="card"><h2>No se pudieron cargar</h2>' +
        '<p class="cs">Puede ser tu conexión. Vuelve a intentarlo en un momento.</p>' +
        '<button class="btn" onclick="location.reload()">Reintentar</button></div></div>';
      return;
    }

    var paginas = r.datos.paginas || [];
    APP.innerHTML =
      '<div class="barra">' +
        '<div class="marca"><span>📅</span> MiCita</div>' +
        '<a class="btn ghost chico" href="#/crear">Editor</a>' +
        '<a class="btn chico" target="_blank" rel="noopener" href="' + esc(API) + '/micita">Ver mis números</a>' +
      '</div>' +
      '<div class="wrap">' +
        '<h1>Mis páginas</h1>' +
        '<p class="cs">' + esc(r.datos.email || '') + '</p>' +
        (paginas.length ? '' : '<div class="card"><p>Todavía no has guardado ninguna página en tu cuenta.</p>' +
          '<a class="btn" href="#/crear">Crear una</a></div>') +
        paginas.map(function (p) {
          var d = p.datos || {};
          return '<div class="card">' +
            '<h3>' + esc(p.negocio || d.n || 'Sin nombre') + '</h3>' +
            (p.nombre_corto
              ? '<div class="linkbox" style="margin-bottom:10px">' + esc(BASE + p.nombre_corto) + '</div>'
              : '<p class="cs">Sin dirección fija todavía.</p>') +
            '<div class="btns">' +
              '<button class="btn ghost chico" data-abrir="' + esc(p.pagina_id) + '">Editar</button>' +
              (p.nombre_corto ? '<a class="btn ghost chico" target="_blank" rel="noopener" href="' + esc(BASE + p.nombre_corto) + '">Ver</a>' : '') +
              '<button class="btn ghost chico" data-baja="' + esc(p.pagina_id) + '">Dar de baja</button>' +
            '</div>' +
          '</div>';
        }).join('') +
        pie() +
      '</div>';

    APP.onclick = function (ev) {
      var b = ev.target.closest('[data-abrir],[data-baja]');
      if (!b) return;
      if (b.hasAttribute('data-abrir')) {
        var id = b.getAttribute('data-abrir');
        var pg = paginas.filter(function (x) { return x.pagina_id === id; })[0];
        if (!pg) return;
        S = normalizar(pg.datos);
        guardar();
        edicionGuardar({ paginaId: pg.pagina_id, nombreCorto: pg.nombre_corto });
        return ir('#/crear');
      }
      if (b.hasAttribute('data-baja')) return darDeBaja(b.getAttribute('data-baja'), b);
    };
  }

  async function darDeBaja(id, boton) {
    if (!confirm('¿Dar de baja esta página? El QR impreso dejará de funcionar y la dirección no se puede volver a usar.')) return;
    ocupado(boton, 'Dando de baja…');
    var r = await api('/api/micita/pagina', { metodo: 'DELETE', cuerpo: { pagina_id: id } });
    libre(boton);
    if (r.estado !== 200) return toast('No se pudo dar de baja.');
    if (edicion && edicion.paginaId === id) edicionGuardar(null);
    toast('Dada de baja.');
    vistaMisPaginas();
  }

  function vistaLleno() {
    document.title = 'Vuelve en un rato — MiCita';
    APP.className = '';
    APP.innerHTML = '<div class="wrap centro"><div class="card">' +
      '<h2>Estamos recibiendo muchas cuentas nuevas 😅</h2>' +
      '<p class="cs">Espera un rato y vuelve a intentar entrar con Google. Mientras tanto tu página sigue funcionando con su link, que no depende de nada.</p>' +
      '<a class="btn" href="#/listo">Volver</a></div></div>';
  }

  /* ---------------------------------------------------------------
     LA PÁGINA VIVA (dirección fija)

     GitHub Pages sirve 404.html para cualquier ruta que no exista como archivo,
     y ese archivo carga esta misma aplicación. Así micita.weissailab.com/barberia
     funciona sin servidor propio, sin tocar el DNS y sin generar un archivo por
     negocio: aquí se le pide la página viva a la API.
     --------------------------------------------------------------- */

  async function vistaPorNombre(slug) {
    document.title = 'Abriendo…';
    APP.className = '';
    APP.innerHTML = '<div class="wrap centro"><p class="cs">Abriendo la página de citas…</p></div>';

    var res;
    try {
      res = await fetch(API + '/api/micita/publica/' + encodeURIComponent(slug));
    } catch (e) {
      return errorPublico('No pudimos abrir la página', 'Puede ser tu conexión. Vuelve a intentarlo en un momento.', true);
    }
    if (res.status === 404) {
      document.title = 'Aquí no hay ninguna página — MiCita';
      return errorPublico('Aquí no hay ninguna página de citas',
        'La dirección ' + location.host + '/' + slug + ' no le pertenece a ningún negocio. Puede estar mal escrita.', false);
    }
    if (!res.ok) {
      return errorPublico('No pudimos abrir la página', 'Puede ser tu conexión. Vuelve a intentarlo en un momento.', true);
    }

    var cuerpo = await res.json();
    var d = normalizar(cuerpo.datos);
    document.title = (d.n || 'Pedir cita') + ' — Pide tu cita';
    pintarNegocio(APP, d, { previa: false, paginaId: cuerpo.pagina_id });
  }

  /**
   * Le suma uno al contador del negocio. NO manda quien pide, ni el telefono,
   * ni el servicio: con saber que la pagina esta sirviendo basta, y lo que no
   * se guarda no se puede filtrar. La cita de verdad va por el WhatsApp del
   * negocio, que es donde el dueno ya la maneja.
   *
   * Con sendBeacon porque el navegador se va a WhatsApp en ese mismo instante y
   * un fetch normal se cancelaria a mitad de camino. Si falla, no pasa nada:
   * es un contador, no la cita.
   */
  function reportarSolicitud(paginaId) {
    try {
      var cuerpo = JSON.stringify({ pagina_id: paginaId });
      var url = API + '/api/micita/solicitud';

      /* EL TIPO TIENE QUE SER text/plain, NO application/json.
         sendBeacon manda siempre con las credenciales incluidas, y un blob de
         application/json convierte la petición en "no simple": el navegador
         pide un preflight que exige Access-Control-Allow-Credentials: true.
         Ponerlo abriría el envío de cookies entre subdominios, que es
         justamente lo que esta API evita usando Bearer. Con text/plain la
         petición es simple, no hay preflight y llega. El servidor lee el
         cuerpo con request.text(), así que el tipo le da igual. */
      var tipo = { type: 'text/plain;charset=UTF-8' };

      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([cuerpo], tipo));
      } else {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: cuerpo,
          keepalive: true,
        }).catch(function () {});
      }
    } catch (e) { /* nunca romper la pagina por un contador */ }
  }

  function errorPublico(titulo, detalle, reintentar) {
    APP.innerHTML = '<div class="wrap centro"><div class="card">' +
      '<div style="font-size:44px">' + (reintentar ? '😕' : '🤔') + '</div>' +
      '<h2>' + esc(titulo) + '</h2>' +
      '<p class="cs">' + esc(detalle) + '</p>' +
      (reintentar
        ? '<button class="btn" onclick="location.reload()">Reintentar</button>'
        : '<a class="btn" href="' + esc(BASE) + '">Hacer mi propia página</a>') +
      '</div>' + pie() + '</div>';
  }

  /** Completa un objeto que viene del servidor con los campos que falten. */
  function normalizar(datos) {
    var base = nueva();
    if (datos && typeof datos === 'object') {
      for (var k in base) if (datos[k] !== undefined) base[k] = datos[k];
    }
    if (!Array.isArray(base.ho)) base.ho = [[], [], [], [], [], [], []];
    while (base.ho.length < 7) base.ho.push([]);
    return base;
  }

  /** El pie del laboratorio. Va en todas las pantallas propias. */
  function pie() {
    return '<div class="pie">Hecho en Colombia por ' +
      '<a href="' + WEB + '/?desde=micita" target="_blank" rel="noopener"><b>Weiss AI Lab</b></a> · ' +
      '<a target="_blank" rel="noopener" href="' + esc(waLink(SOPORTE_WA, 'Hola, vi MiCita y quiero un asistente de WhatsApp para mi negocio')) + '">' +
      '¿quieres que tu WhatsApp conteste solo?</a></div>';
  }

  function qrCanvas(texto, px) {
    var qr = null;
    ['M', 'L'].forEach(function (lvl) {
      if (qr) return;
      try { var q = qrcode(0, lvl); q.addData(texto); q.make(); qr = q; } catch (e) {}
    });
    if (!qr) return null;
    var n = qr.getModuleCount();
    var quiet = 4;
    var cell = Math.max(2, Math.floor(px / (n + quiet * 2)));
    var size = cell * (n + quiet * 2);
    var cv = document.createElement('canvas');
    cv.width = size; cv.height = size;
    var g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#000';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (qr.isDark(r, c)) g.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
    return cv;
  }

  function bajarCanvas(canvas, nombre) {
    try {
      var a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      toast('Descargado');
    } catch (e) { toast('No se pudo descargar aquí; toma un pantallazo'); }
  }

  /* ---------------------------------------------------------------
     LA PÁGINA DEL NEGOCIO (lo que ve el cliente)
     --------------------------------------------------------------- */

  function vistaNegocio(d) {
    document.title = (d.n || 'Pedir cita') + ' — Pide tu cita';
    APP.className = '';
    pintarNegocio(APP, d, { previa: false });
  }

  function pintarNegocio(cont, d, opts) {
    opts = opts || {};
    var R = RUBROS[d.t] || RUBROS.otro;
    var tema = TEMAS[d.th] ? d.th : 'indigo';
    var servicios = (d.sv || []).filter(function (s) { return s && s[0]; });

    /* Lo que el cliente lleva escogido. Vive aquí y no en el modelo: es de
       esta visita, no de la página. */
    var sel = { sv: servicios.length === 1 ? 0 : -1, dia: -1, hora: '', nombre: '' };

    var partes = [];

    partes.push('<div class="neg-cab">' +
      (R.rot ? '<div class="rubro">' + esc(R.rot) + '</div>' : '') +
      '<h1>' + esc(d.n || 'Pedir cita') + '</h1>' +
      (d.fr ? '<p class="fr">' + esc(d.fr) + '</p>' : '') +
      '<div class="meta">' +
        (d.di ? '<a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(d.di) + '">📍 Cómo llegar</a>' : '') +
        horarioResumen(d).map(function (h) { return '<span>🕒 ' + esc(h) + '</span>'; }).join('') +
      '</div>' +
    '</div>');

    partes.push('<div id="cuerpo"></div>');

    if (d.no) {
      partes.push('<div class="paso"><div class="tit"><span class="num">i</span>Antes de venir</div>' +
        '<div class="nota-neg">' + esc(d.no) + '</div></div>');
    }

    if (d.cr) {
      partes.push('<div class="creditos-neg">Hecha con <a href="' + esc(BASE) + '" target="_blank" rel="noopener">MiCita 📅</a> de ' +
        '<a href="' + WEB + '/?desde=micita" target="_blank" rel="noopener">Weiss AI Lab</a> · haz la tuya gratis</div>');
    }

    partes.push('<div class="barra-fin">' +
      '<div class="resumen" id="resumen"></div>' +
      '<button class="btn" id="pedir" disabled>Pedir mi cita</button>' +
    '</div>');

    cont.innerHTML = '<div class="neg" data-tema="' + tema + '">' + partes.join('') + '</div>';

    var raiz = cont.querySelector('.neg');
    var cuerpo = cont.querySelector('#cuerpo');
    var resumen = cont.querySelector('#resumen');
    var btn = cont.querySelector('#pedir');

    function dur() { return sel.sv >= 0 ? (+servicios[sel.sv][1] || 30) : 30; }

    /* Los días con cupo dependen de la duración del servicio, así que se
       recalculan cada vez que cambia la selección. */
    var dias = [];

    function pintarCuerpo() {
      dias = sel.sv >= 0 ? diasConCupo(d, dur()) : [];
      var horas = (sel.sv >= 0 && sel.dia >= 0 && dias[sel.dia]) ? franjas(d, dias[sel.dia], dur()) : [];
      var h = [];

      /* Paso 1: servicio */
      h.push('<div class="paso"><div class="tit' + (sel.sv >= 0 ? ' lista-ok' : '') + '"><span class="num">' + (sel.sv >= 0 ? '✓' : '1') + '</span>¿Qué te vas a hacer?</div>');
      if (!servicios.length) h.push('<div class="vacio">Este negocio todavía no ha puesto sus servicios.</div>');
      servicios.forEach(function (s, i) {
        h.push('<button class="op" data-sv="' + i + '" aria-pressed="' + (sel.sv === i) + '">' +
          '<span class="tick">✓</span>' +
          '<span class="cuerpo"><span class="n">' + esc(s[0]) + '</span>' +
          '<span class="d">' + esc(duracionBonita(+s[1] || 30)) + '</span></span>' +
          (+s[2] ? '<span class="p">' + esc(pesos(s[2])) + '</span>' : '') +
        '</button>');
      });
      h.push('</div>');

      /* Paso 2: día */
      if (sel.sv >= 0) {
        h.push('<div class="paso"><div class="tit' + (sel.dia >= 0 ? ' lista-ok' : '') + '"><span class="num">' + (sel.dia >= 0 ? '✓' : '2') + '</span>¿Qué día?</div>');
        if (!dias.length) {
          h.push('<div class="vacio">No hay cupos disponibles para este servicio en los próximos días. Escríbele al negocio por WhatsApp.</div>');
        } else {
          var hoy = new Date();
          h.push('<div class="dias">' + dias.map(function (f, i) {
            var etq = mismaFecha(f, hoy) ? 'hoy' : (mismaFecha(f, diaSuma(hoy, 1)) ? 'mañana' : DIAS_C[f.getDay()]);
            return '<button class="dia" data-dia="' + i + '" aria-pressed="' + (sel.dia === i) + '">' +
              '<span class="sem">' + esc(etq) + '</span>' +
              '<span class="num">' + f.getDate() + '</span>' +
              '<span class="mes">' + MESES_C[f.getMonth()] + '</span></button>';
          }).join('') + '</div>');
        }
        h.push('</div>');
      }

      /* Paso 3: hora */
      if (sel.sv >= 0 && sel.dia >= 0) {
        h.push('<div class="paso"><div class="tit' + (sel.hora ? ' lista-ok' : '') + '"><span class="num">' + (sel.hora ? '✓' : '3') + '</span>¿A qué hora?</div>');
        if (!horas.length) h.push('<div class="vacio">Ese día ya no quedan horas para este servicio.</div>');
        else h.push('<div class="horas">' + horas.map(function (x) {
          return '<button class="hora" data-hora="' + x + '" aria-pressed="' + (sel.hora === x) + '">' + esc(hora12(x)) + '</button>';
        }).join('') + '</div>');
        h.push('</div>');
      }

      /* Paso 4: nombre */
      if (sel.sv >= 0 && sel.dia >= 0 && sel.hora) {
        h.push('<div class="paso"><div class="tit' + (sel.nombre ? ' lista-ok' : '') + '"><span class="num">' + (sel.nombre ? '✓' : '4') + '</span>¿Cómo te llamas?</div>' +
          '<div class="campo" style="margin:0"><input id="quien" type="text" placeholder="Tu nombre" value="' + esc(sel.nombre) + '"></div>');
        if (+d.ab && d.nq) {
          h.push('<div class="abono" style="margin-top:14px"><b>Para separar el cupo</b>' +
            '<div class="m">' + esc(pesos(d.ab)) + ' a Nequi ' + esc(d.nq) + '</div>' +
            '<div class="cs">Lo mandas después de que te confirmen. <button class="btn ghost chico" data-act="copiar-nequi-neg" data-n="' + esc(d.nq) + '">Copiar el número</button></div></div>');
        }
        h.push('</div>');
      }

      cuerpo.innerHTML = h.join('');
      var q = cuerpo.querySelector('#quien');
      if (q) {
        q.oninput = function () { sel.nombre = this.value; refrescar(); };
      }
      refrescar();
    }

    function refrescar() {
      var listo = sel.sv >= 0 && sel.dia >= 0 && !!sel.hora && !!sel.nombre.trim();
      btn.disabled = !listo;

      if (sel.sv < 0) resumen.textContent = 'Escoge el servicio para empezar';
      else if (sel.dia < 0) resumen.innerHTML = '<b>' + esc(servicios[sel.sv][0]) + '</b> · escoge el día';
      else if (!sel.hora) resumen.innerHTML = '<b>' + esc(servicios[sel.sv][0]) + '</b> · ' + esc(fechaLarga(dias[sel.dia]));
      else if (!sel.nombre.trim()) resumen.innerHTML = '<b>' + esc(servicios[sel.sv][0]) + '</b> · ' + esc(fechaLarga(dias[sel.dia])) + ' · ' + esc(hora12(sel.hora)) + ' — falta tu nombre';
      else resumen.innerHTML = '<b>' + esc(servicios[sel.sv][0]) + '</b> · ' + esc(fechaLarga(dias[sel.dia])) + ' · ' + esc(hora12(sel.hora));
    }

    raiz.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-sv],[data-dia],[data-hora],[data-act]');
      if (!el) return;

      if (el.hasAttribute('data-sv')) {
        var i = +el.getAttribute('data-sv');
        /* Cambiar de servicio cambia la duración, así que el día y la hora
           escogidos pueden dejar de existir: se reinician a propósito. */
        sel.sv = (sel.sv === i ? -1 : i);
        sel.dia = -1; sel.hora = '';
        return pintarCuerpo();
      }
      if (el.hasAttribute('data-dia')) {
        sel.dia = +el.getAttribute('data-dia');
        sel.hora = '';
        return pintarCuerpo();
      }
      if (el.hasAttribute('data-hora')) {
        sel.hora = el.getAttribute('data-hora');
        return pintarCuerpo();
      }
      if (el.getAttribute('data-act') === 'copiar-nequi-neg') {
        return copiar(el.getAttribute('data-n'), 'Número copiado 💵');
      }
    });

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      var s = servicios[sel.sv];
      var f = dias[sel.dia];
      var txt = '¡Hola! Quiero pedir una cita 📅\n' +
        '• Servicio: ' + s[0] + ' (' + duracionBonita(+s[1] || 30) + (+s[2] ? ', ' + pesos(s[2]) : '') + ')\n' +
        '• Día: ' + fechaLarga(f) + '\n' +
        '• Hora: ' + hora12(sel.hora) + '\n' +
        '• Mi nombre: ' + sel.nombre.trim();
      if (+d.ab && d.nq) txt += '\n\nYa sé que debo abonar ' + pesos(d.ab) + ' a Nequi ' + d.nq + ' para separar.';

      if (!opts.previa && opts.paginaId) reportarSolicitud(opts.paginaId);
      if (!opts.previa) window.open(waLink(d.w, txt), '_blank', 'noopener');
      pintarHecho(d, s, f, sel.hora, sel.nombre.trim(), opts);
    });

    pintarCuerpo();
  }

  /** Pantalla de "ya la pediste", con el recordatorio para el calendario. */
  function pintarHecho(d, s, fecha, hora, quien, opts) {
    var cont = opts.previa ? $('#previa') : APP;
    if (!cont) return;
    var raiz = cont.querySelector('.neg');
    if (!raiz) return;

    raiz.innerHTML =
      '<div class="neg-cab">' +
        '<h1>' + esc(d.n || '') + '</h1>' +
      '</div>' +
      '<div class="hecho">' +
        '<div class="ok">✅</div>' +
        '<h3>Le mandamos tu solicitud</h3>' +
        '<p class="cs">Se abrió tu WhatsApp con la cita escrita. <b>Solo tienes que darle enviar</b> — si no se abrió, tócale al botón de abajo.</p>' +
        '<div class="abono" style="text-align:left;margin:16px 0">' +
          '<div><b>' + esc(s[0]) + '</b></div>' +
          '<div>' + esc(fechaLarga(fecha)) + ' · ' + esc(hora12(hora)) + '</div>' +
          '<div class="cs">A nombre de ' + esc(quien) + '</div>' +
        '</div>' +
        '<p class="cs">Todavía no está confirmada: te la confirma el negocio por WhatsApp.</p>' +
        '<div class="btns" style="flex-direction:column">' +
          '<a class="btn wa ancho" id="rewa" target="_blank" rel="noopener" href="#">Abrir WhatsApp otra vez</a>' +
          '<button class="btn ghost ancho" data-act="ics">Ponerla en mi calendario 📅</button>' +
          '<button class="btn ghost ancho" data-act="otra">Pedir otra cita</button>' +
        '</div>' +
      '</div>' +
      (d.cr ? '<div class="creditos-neg">Hecha con <a href="' + esc(BASE) + '" target="_blank" rel="noopener">MiCita 📅</a> de ' +
        '<a href="' + WEB + '/?desde=micita" target="_blank" rel="noopener">Weiss AI Lab</a> · haz la tuya gratis</div>' : '');

    var txt = '¡Hola! Quiero pedir una cita 📅\n' +
      '• Servicio: ' + s[0] + '\n• Día: ' + fechaLarga(fecha) + '\n• Hora: ' + hora12(hora) + '\n• Mi nombre: ' + quien;
    var re = raiz.querySelector('#rewa');
    if (re) re.href = waLink(d.w, txt);

    raiz.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-act]');
      if (!b) return;
      if (b.getAttribute('data-act') === 'otra') return pintarNegocio(cont, d, opts);
      if (b.getAttribute('data-act') === 'ics') return descargarICS(d, s, fecha, hora);
    });

    cont.scrollTop = 0;
  }

  /* Un .ics de verdad, armado en el navegador, con alarma una hora antes. Es
     el único formato que entienden a la vez Android, iPhone y Outlook. */
  function descargarICS(d, s, fecha, hora) {
    var m = aMin(hora);
    var ini = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, m, 0, 0);
    var fin = new Date(ini.getTime() + (+s[1] || 30) * 60000);
    function z(x) {
      return x.getUTCFullYear() + dosD(x.getUTCMonth() + 1) + dosD(x.getUTCDate()) + 'T' +
        dosD(x.getUTCHours()) + dosD(x.getUTCMinutes()) + '00Z';
    }
    function lim(t) { return String(t || '').replace(/[\\;,]/g, function (c) { return '\\' + c; }).replace(/\n/g, '\\n'); }

    var ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Weiss AI Lab//MiCita//ES', 'BEGIN:VEVENT',
      'UID:' + Math.abs(hash(codificar(d) + hora + fecha.getTime())) + '@micita',
      'DTSTAMP:' + z(new Date()),
      'DTSTART:' + z(ini), 'DTEND:' + z(fin),
      'SUMMARY:' + lim(s[0] + ' — ' + (d.n || '')),
      'LOCATION:' + lim(d.di || ''),
      'DESCRIPTION:' + lim('Cita pedida por MiCita. Te la confirma el negocio por WhatsApp.'),
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:' + lim('Tu cita en ' + (d.n || '')), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');

    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cita.ics';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1200);
    toast('Guardada en tu calendario 📅');
  }

  /* ---------------------------------------------------------------
     ARRANQUE
     --------------------------------------------------------------- */

  function arrancar() {
    cargar();
    cuentaCargar();
    recogerToken();
    window.addEventListener('hashchange', function () {
      APP.onclick = null;
      APP.oninput = null;
      APP.onchange = null;
      pintar();
    });
    pintar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();
})();
