# MiCita 📅

La página de citas de un negocio pequeño: el cliente escoge servicio, día y
hora, y la cita le llega al negocio por WhatsApp ya escrita. Con QR para pegar
en el mostrador.

**En vivo:** https://micita.weissailab.com/
**Ejemplo:** https://micita.weissailab.com/#/ejemplo

Hecho por [Weiss AI Lab](https://weissailab.com).

---

## Qué hace

El dueño pone sus servicios (con duración y precio) y a qué horas atiende cada
día. Le queda un link y un código QR. El cliente entra, escoge en cuatro toques
y al negocio le llega:

```
¡Hola! Quiero pedir una cita 📅
• Servicio: Corte + barba (45 min, $35.000)
• Día: viernes 14 de agosto
• Hora: 10:00 a. m.
• Mi nombre: Andrés Felipe
```

La página solo ofrece horas que de verdad sirven: respeta el horario de cada
día, el almuerzo, la duración del servicio, la anticipación mínima y hasta
cuántos días adelante se puede pedir.

## La postura de producto que hay que respetar

**MiCita no reemplaza la agenda del negocio: el cliente _pide_ y el negocio
confirma.** No es una limitación que se disimula, se dice de frente en la
landing y en la pantalla de confirmación.

La razón es la misma que en MiCarta con las mesas libres: **mostrar
disponibilidad real exige estado compartido entre clientes**, y eso no se puede
hacer sin servidor. Si dos personas piden las 10:00 a. m., las dos ven la hora
libre — y está bien, porque ninguna quedó "reservada". Prometer lo contrario
sería mentir, y el día que dos clientes lleguen a la misma hora la culpa sería
nuestra.

Esa frontera es justo lo que sí puede hacer el asistente de WhatsApp del
laboratorio, que tiene Postgres detrás.

## La decisión de diseño

**La agenda viaja dentro del link.** Se comprime con LZ-string y va en el
fragmento (`#/n/…`), que nunca llega al servidor. No hay backend, ni base de
datos, ni cuentas, ni cookies. Operarlo cuesta cero para siempre y no guarda
datos de nadie — ni del negocio, ni de quien pide la cita.

Dos contrapartidas, las dos avisadas en la interfaz:

1. **Quien pierde su link de edición pierde la página.** Por eso la pantalla
   final insiste en mandárselo a uno mismo por WhatsApp.
2. **Si cambia un precio o un horario, cambia el link, y el QR impreso muere.**
   Por eso el link corto de pago se ofrece *antes* de mandar a imprimir: con
   dirección propia el QR sobrevive a los cambios.

## Cómo está armado

Sin build. Cuatro archivos y a correr.

```
index.html      metadatos y og:image (lo que ve el cliente en la vista previa)
app.css         el laboratorio (landing + editor) y la página del negocio
app.js          modelo, agenda, ruteo por hash, editor y página pública
vendor/         lz-string y qrcode
og.png          tarjeta de vista previa, generada con herramientas/og.mjs
```

- **Rutas:** `#/crear` (editor), `#/listo` (publicación con QR), `#/n/<datos>`
  (página del negocio), `#/e/<datos>` (volver a editar), `#/ejemplo`.
- **La agenda** vive en tres funciones de `app.js`: `franjas()` genera las horas
  de un día para un servicio, `diasConCupo()` arma la tira de días, y
  `horarioResumen()` agrupa los días seguidos con el mismo horario ("lun a vie
  9:00 a. m. a 12:30 p. m. y 2:00 p. m. a 6:00 p. m.").
- **Toda la aritmética de horarios se hace en minutos desde medianoche**
  (`aMin`/`aHHMM`), no con cadenas ni con `Date`: sumarle 45 minutos a las 23:30
  con cadenas es pedir un bug.
- **Rubros** (`RUBROS`): solo deciden con qué servicios arranca el editor.
  Cambiar de rubro **no pisa** los servicios si el dueño ya los tocó.
- **Temas** (`TEMAS` + bloques `.neg[data-tema=…]`): un color por tema, nada más.

Trampas ya resueltas:

1. **La anticipación mínima se mide contra AHORA**, no contra el arranque del
   día. Si son las 8:09 y el negocio pide 2 horas, la primera hora ofrecida es
   las 10:30, no las 9:00.
2. **El horario tiene que tener siempre 7 posiciones.** Un link viejo o
   manipulado con menos días dejaba `ho[dia]` en `undefined` al generar franjas;
   `decodificar()` lo rellena.
3. **GitHub Pages sirve con `Cache-Control: max-age=600`.** `index.html` carga
   `app.js?v=N`: **hay que subir ese número al tocar `app.js` o `app.css`**.

## Verificar el QR de verdad

Generar el QR y verlo bonito no prueba que escanee. Para comprobarlo: cargar
jsQR desde jsdelivr en la página, leer el canvas y comparar el texto decodificado
contra el link publicado. Así se verificó esta versión (403 caracteres, coincide
exacto).

## Desarrollo

Es estático: cualquier servidor sirve.

```bash
python -m http.server 4192
```

Hay una entrada `micita` en el `launch.json` del laboratorio (puerto 4192).

## Despliegue

GitHub Pages sobre `main` en la raíz. `git push` y listo, tarda ~1 minuto.

## Monetización

Gratis y sin publicidad. Al pie de cada página va un crédito discreto ("Hecha
con MiCita · haz la tuya gratis").

- **Aporte voluntario** a Nequi 3171715071.
- **Versión con link corto** ($20.000): dirección propia del tipo
  `…/barberiaelrey`, sin el crédito abajo, y **el QR impreso sigue sirviendo
  aunque cambien precios y horarios** — que es exactamente lo que el modo gratis
  no puede dar. Se pide por WhatsApp y se arma a mano.
- **El puente al asistente:** un negocio con página de citas empieza a recibir
  preguntas de disponibilidad a toda hora. Ese es el momento en que el asistente
  de WhatsApp deja de verse caro.
