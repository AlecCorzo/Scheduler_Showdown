import type { Segmento } from '@showdown/engine';

const COLOR_PROCESO: Record<string, string> = {
  Ana: '#9b8cff',
  Beto: '#4fd1d9',
  Caro: '#ff9f5a',
  Dani: '#f06aae',
};

type Resaltado = { tipo: 'rango'; inicio: number; fin: number } | { tipo: 'linea'; minuto: number } | null;

interface Props {
  segmentos: Segmento[];
  titulo?: string;
  resaltar?: Resaltado;
  /** Opcional: para nombres de proceso fuera de Ana/Beto/Caro/Dani (usado por el simulador). */
  colorPorProceso?: Record<string, string>;
}

const ESCALA = 40; // px por minuto en el viewBox
const ALTO = 56;

export function Gantt({ segmentos, titulo, resaltar = null, colorPorProceso }: Props) {
  const colores = colorPorProceso ?? COLOR_PROCESO;
  const duracion = Math.max(...segmentos.map((s) => s.fin), 1);

  return (
    <div className="gantt">
      {titulo && <p className="gantt-titulo">{titulo}</p>}
      <svg viewBox={`0 0 ${duracion * ESCALA} ${ALTO}`} style={{ width: '100%', height: ALTO }} preserveAspectRatio="none">
        {segmentos.map((s, i) => {
          const x = s.inicio * ESCALA;
          const ancho = (s.fin - s.inicio) * ESCALA;
          const resaltado = resaltar?.tipo === 'rango' && s.inicio < resaltar.fin && s.fin > resaltar.inicio;
          return (
            <g
              key={i}
              className="gantt-segmento"
              style={{ transformOrigin: `${x}px ${ALTO / 2}px`, animationDelay: `${i * 120}ms` }}
            >
              <rect
                x={x}
                y={4}
                width={ancho}
                height={ALTO - 20}
                fill={colores[s.proceso] ?? '#a7b3d1'}
                stroke={resaltado ? '#f3f5fa' : 'none'}
                strokeWidth={resaltado ? 3 : 0}
              />
              <text x={x + ancho / 2} y={ALTO / 2 + 4} textAnchor="middle" fontSize={14} fill="#172241">
                {ancho < ESCALA * 0.6 ? s.proceso[0] : s.proceso}
              </text>
            </g>
          );
        })}
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
