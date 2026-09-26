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

const ESCALA = 40; // px por minuto en el viewBox
const ALTO = 56;

export function Gantt({ segmentos, titulo, resaltar = null, colorPorProceso, tiempoActual, procesos }: Props) {
  const colores = colorPorProceso ?? COLOR_PROCESO;
  const duracion = Math.max(...segmentos.map((s) => s.fin), 1);
  const animado = tiempoActual !== undefined;
  const t = animado ? Math.min(tiempoActual, duracion) : duracion;
  const enMarcha = animado && t < duracion;

  return (
    <div className="gantt">
      {titulo && <p className="gantt-titulo">{titulo}</p>}
      <svg viewBox={`0 0 ${duracion * ESCALA} ${ALTO}`} style={{ width: '100%', height: ALTO }} preserveAspectRatio="none">
        {segmentos.map((s, i) => {
          // En modo animado, un segmento que todavía no arrancó no se dibuja
          // — así el diagrama se construye con el tiempo en vez de aparecer
          // completo de entrada.
          if (animado && s.inicio >= t) return null;

          const x = s.inicio * ESCALA;
          const anchoTotal = (s.fin - s.inicio) * ESCALA;
          const enCurso = animado && s.fin > t;
          const ancho = enCurso ? (t - s.inicio) * ESCALA : anchoTotal;
          const resaltado = resaltar?.tipo === 'rango' && s.inicio < resaltar.fin && s.fin > resaltar.inicio;

          return (
            <g
              key={i}
              className={animado ? undefined : 'gantt-segmento'}
              style={animado ? undefined : { transformOrigin: `${x}px ${ALTO / 2}px`, animationDelay: `${i * 120}ms` }}
            >
              <rect
                x={x}
                y={4}
                width={Math.max(ancho, 0.01)}
                height={ALTO - 20}
                fill={colores[s.proceso] ?? '#a7b3d1'}
                stroke={enCurso ? '#f3f5fa' : resaltado ? '#f3f5fa' : 'none'}
                strokeWidth={enCurso ? 2 : resaltado ? 3 : 0}
                className={enCurso ? 'gantt-segmento-activo' : undefined}
              />
              {(!enCurso || ancho > ESCALA * 0.5) && (
                <text x={x + anchoTotal / 2} y={ALTO / 2 + 4} textAnchor="middle" fontSize={14} fill="#172241">
                  {anchoTotal < ESCALA * 0.6 ? s.proceso[0] : s.proceso}
                </text>
              )}
            </g>
          );
        })}

        {animado &&
          procesos?.map((p) => {
            const llegada = Math.max(0, p.llegada);
            const alcanzada = t >= llegada;
            return (
              <circle
                key={p.nombre}
                cx={llegada * ESCALA}
                cy={2.5}
                r={2.5}
                fill={colores[p.nombre] ?? '#a7b3d1'}
                opacity={alcanzada ? 1 : 0.25}
                style={{ transition: 'opacity 200ms ease-out' }}
              />
            );
          })}

        {enMarcha && (
          <line
            x1={t * ESCALA}
            x2={t * ESCALA}
            y1={0}
            y2={ALTO - 14}
            stroke="#f3f5fa"
            strokeWidth={2}
            className="gantt-cursor"
          />
        )}

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
        {Array.from({ length: duracion + 1 }, (_, m) => (
          <text key={m} x={m * ESCALA} y={ALTO - 2} fontSize={10} fill="#a7b3d1">
            {m}
          </text>
        ))}
      </svg>
    </div>
  );
}