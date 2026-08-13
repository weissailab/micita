/* Arma la tarjeta de vista previa (og.png) de MiCita.
   Es lo que ve el cliente en WhatsApp antes de abrir el link, así que el dibujo
   es lo que va a hacer al entrar: escoger un día y una hora.

   Necesita `sharp`. En este portátil vive en el node_modules del panel; si se
   corre en otra parte, basta con `npm i sharp` y cambiar el import. */
import sharp from 'file:///C:/Users/ASUS/Documents/Weiss-AI-Lab/Proyectos/Panel-Cliente/codigo/node_modules/sharp/lib/index.js';
import { writeFileSync } from 'fs';

const W = 1200, H = 630;
const fondo = '#F5F6F8', tinta = '#16181D', suave = '#646B7A', ac = '#4F46E5', acSuave = '#EEF0FE', linea = '#E3E6EC';

/* La tarjeta del calendario, a la izquierda */
const cx = 96, cy = 150, cw = 380, ch = 330;

/* Cuadrícula de días: 7 columnas x 3 filas, con uno marcado */
const celda = 44, gx = cx + 26, gy = cy + 108;
const marcado = 10; /* índice del día resaltado */

const dias = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const cuadricula = Array.from({ length: 21 }, (_, i) => {
  const col = i % 7, fil = Math.floor(i / 7);
  const x = gx + col * celda, y = gy + fil * celda;
  const esMarcado = i === marcado;
  return `<rect x="${x}" y="${y}" width="34" height="34" rx="9" fill="${esMarcado ? ac : '#fff'}" stroke="${esMarcado ? ac : linea}" stroke-width="1.5"/>` +
    `<text x="${x + 17}" y="${y + 23}" font-family="'Segoe UI', Arial, sans-serif" font-size="15" font-weight="${esMarcado ? '700' : '400'}" fill="${esMarcado ? '#fff' : suave}" text-anchor="middle">${i + 3}</text>`;
}).join('');

const cabDias = dias.map((d, i) =>
  `<text x="${gx + i * celda + 17}" y="${gy - 14}" font-family="'Segoe UI', Arial, sans-serif" font-size="13" fill="${suave}" text-anchor="middle">${d}</text>`
).join('');

/* Las horas, como fichas debajo del calendario */
const horas = ['9:00', '10:30', '11:00'];
const fichas = horas.map((h, i) => {
  const x = gx + i * 116, y = gy + 3 * celda + 18;
  const activa = i === 1;
  return `<rect x="${x}" y="${y}" width="104" height="44" rx="12" fill="${activa ? ac : '#fff'}" stroke="${activa ? ac : linea}" stroke-width="1.5"/>` +
    `<text x="${x + 52}" y="${y + 28}" font-family="'Segoe UI', Arial, sans-serif" font-size="17" font-weight="600" fill="${activa ? '#fff' : suave}" text-anchor="middle">${h}</text>`;
}).join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="${acSuave}"/>
    </linearGradient>
    <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#16181D" flood-opacity="0.10"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- tarjeta del calendario -->
  <g filter="url(#sombra)">
    <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="24" fill="#fff"/>
  </g>
  <rect x="${cx}" y="${cy}" width="${cw}" height="62" rx="24" fill="${ac}"/>
  <rect x="${cx}" y="${cy + 38}" width="${cw}" height="24" fill="${ac}"/>
  <text x="${cx + 26}" y="${cy + 40}" font-family="'Segoe UI', Arial, sans-serif" font-size="21" font-weight="700" fill="#fff">Agosto</text>
  ${cabDias}
  ${cuadricula}
  ${fichas}

  <!-- texto -->
  <text x="546" y="222" font-family="'Segoe UI', Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="4" fill="${ac}">PIDE TU CITA</text>
  <text x="546" y="300" font-family="'Segoe UI', Arial, sans-serif" font-size="60" font-weight="700" fill="${tinta}">Sin llamar</text>
  <text x="546" y="366" font-family="'Segoe UI', Arial, sans-serif" font-size="60" font-weight="700" fill="${tinta}">y sin esperar</text>
  <text x="546" y="424" font-family="'Segoe UI', Arial, sans-serif" font-size="25" fill="${suave}">Escoge servicio, día y hora.</text>
  <text x="546" y="460" font-family="'Segoe UI', Arial, sans-serif" font-size="25" fill="${suave}">Te toma 20 segundos.</text>
  <text x="546" y="536" font-family="'Segoe UI', Arial, sans-serif" font-size="18" letter-spacing="5" fill="${ac}">MICITA   ·   WEISS AI LAB</text>
</svg>`;

const salida = 'C:/Users/ASUS/Documents/Weiss-AI-Lab/Proyectos/MiCita/og.png';
const buf = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(salida, buf);
const meta = await sharp(buf).metadata();
console.log('og.png', meta.width + 'x' + meta.height, Math.round(buf.length / 1024) + ' KB');
