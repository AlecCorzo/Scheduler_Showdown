import type { Segmento } from '@showdown/engine';

const COLOR_PROCESO: Record<string, string> = {
  Ana: '#9b8cff',
  Beto: '#4fd1d9',
  Caro: '#ff9f5a',
  Dani: '#f06aae',
};

type Resaltado = { tipo: 'rango'; inicio: number; fin: number } | { tipo: 'linea'; minuto: number } | null;

interface ProcesoLlegada {
  nombre: string;
  llegada: number;
}

interface Props {
  segmentos: Segmento[];
  titulo?: string;
  resaltar?: Resaltado;
  /** Opcional: para nombres de proceso fuera de Ana/Beto/Caro/Dani (usado por el simulador). */
  colorPorProceso?: Record<string, string>;
  /**
   * Opcional: minuto simulado actual. Sin este prop, el Gantt se comporta
   * exactamente como antes (todo dibujado de una vez, con la animación de
   * aparición por segmento que usa el revelado del kahoot). Con este prop,
   * el diagrama se "arma" en vivo a medida que el valor avanza: los
   * segmentos futuros no se dibujan, el segmento en curso se rellena
   * progresivamente, y aparece un cursor de tiempo — pensado para que el
   * simulador anime varios Gantt a la vez con un reloj compartido.
   */
  tiempoActual?: number;
  /** Junto con tiempoActual: dibuja una marca de llegada por proceso. */
  procesos?: ProcesoLlegada[];
}

const ESCALA = 44; // px por minuto en el viewBox
const ALTO = 64;   // altura del SVG
const RADIO = 5;   // radio de esquinas redondeadas de los segmentos
const Y_BARRA = 8; // Y desde donde empieza el rect
const H_BARRA = ALTO - 26; // alto de la barra

export function Gantt({ segmentos, titulo, resaltar = null, colorPorProceso, tiempoActual, procesos }: Props) {
  const colores = colorPorProceso ?? COLOR_PROCESO;
  const duracion = Math.max(...segmentos.map((s) => s.fin), 1);
  const animado = tiempoActual !== undefined;
  const t = animado ? Math.min(tiempoActual, duracion) : duracion;
  const enMarcha = animado && t < duracion;

  return (
    <div className="gantt">
      {titulo && <p className="gantt-titulo">{titulo}</p>}
      <svg
        viewBox={`0 0 ${duracion * ESCALA} ${ALTO}`}
        style={{ width: '100%', height: ALTO, minWidth: duracion * ESCALA * 0.5 }}
        preserveAspectRatio="none"
      >
        <defs>
          {/* Gradiente de brillo para cada color de proceso */}
          {Object.entries(colores).map(([nombre, color]) => (
            <linearGradient key={nombre} id={`grad-${nombre.replace(/\s/g, '_')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.95" />
              <stop offset="100%" stopColor={color} stopOpacity="0.65" />
            </linearGradient>
          ))}
          {/* Patrón de grid de fondo */}
          <pattern id="gridPattern" width={ESCALA} height={ALTO} patternUnits="userSpaceOnUse">
            <line x1={ESCALA} y1="0" x2={ESCALA} y2={ALTO - 14} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Fondo de grilla */}
        <rect width={duracion * ESCALA} height={ALTO - 14} fill="url(#gridPattern)" />

        {/* Carril base (fondo de las barras) */}
        <rect
          x={0}
          y={Y_BARRA}
          width={duracion * ESCALA}
          height={H_BARRA}
          rx={RADIO}
          fill="rgba(255,255,255,0.03)"
        />

        {/* Segmentos */}
        {segmentos.map((s, i) => {
          // En modo animado, un segmento que todavía no arrancó no se dibuja
          if (animado && s.inicio >= t) return null;

          const x = s.inicio * ESCALA;
          const anchoTotal = (s.fin - s.inicio) * ESCALA;
          const enCurso = animado && s.fin > t;
          const ancho = enCurso ? (t - s.inicio) * ESCALA : anchoTotal;
          const resaltado = resaltar?.tipo === 'rango' && s.inicio < resaltar.fin && s.fin > resaltar.inicio;
          const gradId = `url(#grad-${s.proceso.replace(/\s/g, '_')})`;
          const colorBase = colores[s.proceso] ?? '#a7b3d1';

          return (
            <g
              key={i}
              className={animado ? undefined : 'gantt-segmento'}
              style={animado ? undefined : { transformOrigin: `${x}px ${ALTO / 2}px`, animationDelay: `${i * 120}ms` }}
            >
              {/* Barra principal con gradiente */}
              <rect
                x={x + 1}
                y={Y_BARRA}
                width={Math.max(ancho - 2, 0.01)}
                height={H_BARRA}
                rx={RADIO}
                fill={colorPorProceso ? gradId : colorBase}
                className={enCurso ? 'gantt-segmento-activo' : undefined}
              />
              {/* Borde superior luminoso (brillo del color) */}
              {!enCurso && (
                <rect
                  x={x + 1}
                  y={Y_BARRA}
                  width={Math.max(anchoTotal - 2, 0.01)}
                  height={3}
                  rx={RADIO}
                  fill={colorBase}
                  opacity={0.7}
                />
              )}
              {/* Contorno de resaltado */}
              {resaltado && (
                <rect
                  x={x + 1}
                  y={Y_BARRA}
                  width={Math.max(anchoTotal - 2, 0.01)}
                  height={H_BARRA}
                  rx={RADIO}
                  fill="none"
                  stroke="#f3f5fa"
                  strokeWidth={2}
                />
              )}
              {/* Etiqueta del proceso */}
              {(!enCurso || ancho > ESCALA * 0.4) && (
                <text
                  x={x + anchoTotal / 2}
                  y={Y_BARRA + H_BARRA / 2 + 5}
                  textAnchor="middle"
                  fontSize={anchoTotal < ESCALA * 0.9 ? 10 : 13}
                  fontWeight="700"
                  fill="#ffffff"
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)', paintOrder: 'stroke' }}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {anchoTotal < ESCALA * 0.7 ? (s.proceso[0] ?? '') : s.proceso}
                </text>
              )}
            </g>
          );
        })}

        {/* Marcas de llegada de cada proceso (pequeños triángulos sobre la barra) */}
        {animado &&
          procesos?.map((p, i) => {
            const llegada = Math.max(0, p.llegada);
            const alcanzada = t >= llegada;
            return (
              <g key={`${p.nombre}-${i}`}>
                {/* Línea vertical de llegada */}
                <line
                  x1={llegada * ESCALA}
                  x2={llegada * ESCALA}
                  y1={Y_BARRA}
                  y2={Y_BARRA + H_BARRA}
                  stroke={colores[p.nombre] ?? '#a7b3d1'}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  opacity={alcanzada ? 0.6 : 0.2}
                />
                {/* Rombo / punto de llegada */}
                <circle
                  cx={llegada * ESCALA}
                  cy={Y_BARRA - 2}
                  r={3}
                  fill={colores[p.nombre] ?? '#a7b3d1'}
                  opacity={alcanzada ? 1 : 0.25}
                  style={{ transition: 'opacity 200ms ease-out' }}
                />
              </g>
            );
          })}

        {/* Cursor de tiempo animado */}
        {enMarcha && (
          <g>
            {/* Línea del cursor */}
            <line
              x1={t * ESCALA}
              x2={t * ESCALA}
              y1={Y_BARRA}
              y2={ALTO - 14}
              stroke="#ffffff"
              strokeWidth={1.5}
              className="gantt-cursor"
            />
            {/* Cabeza del cursor (triángulo) */}
            <polygon
              points={`${t * ESCALA - 4},${Y_BARRA} ${t * ESCALA + 4},${Y_BARRA} ${t * ESCALA},${Y_BARRA + 6}`}
              fill="#ffffff"
              className="gantt-cursor"
            />
          </g>
        )}

        {/* Línea de resaltado tipo "linea" */}
        {resaltar?.tipo === 'linea' && (
          <line
            x1={resaltar.minuto * ESCALA}
            x2={resaltar.minuto * ESCALA}
            y1={0}
            y2={ALTO - 14}
            stroke="#f3f5fa"
            strokeWidth={2}
          />
        )}

        {/* Etiquetas de minutos */}
        {Array.from({ length: duracion + 1 }, (_, m) => (
          <text
            key={m}
            x={m * ESCALA}
            y={ALTO - 3}
            fontSize={9}
            fill="rgba(167,179,209,0.7)"
            textAnchor="middle"
          >
            {m}
          </text>
        ))}

        {/* Línea base */}
        <line
          x1={0}
          x2={duracion * ESCALA}
          y1={ALTO - 14}
          y2={ALTO - 14}
          stroke="rgba(167,179,209,0.15)"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}