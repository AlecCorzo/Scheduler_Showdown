import type { Segmento } from '@showdown/engine';
import { Gantt } from '../componentes/Gantt.js';

interface Toggle {
  etiqueta: string;
  onClick: () => void;
}

interface Props {
  titulo: string;
  /** Texto chico junto al título, ej. "mostrando SRTF". No cambia el título del cuadrante. */
  subtitulo?: string;
  acento: 'opcion-1' | 'opcion-2' | 'opcion-3' | 'opcion-4';
  segmentos: Segmento[];
  colorPorProceso: Record<string, string>;
  claveAnimacion: number;
  toggle?: Toggle;
}

export function Cuadrante({
  titulo,
  subtitulo,
  acento,
  segmentos,
  colorPorProceso,
  claveAnimacion,
  toggle,
}: Props) {
  return (
    <div className={`cuadrante ${acento}`}>
      <div className="cuadrante-cabecera">
        <span className="cuadrante-titulo">
          <h2>{titulo}</h2>
          {subtitulo && <span className="cuadrante-subtitulo">{subtitulo}</span>}
        </span>
        {toggle && (
          <button type="button" className="boton-alterna" onClick={toggle.onClick}>
            {toggle.etiqueta}
          </button>
        )}
      </div>
      <div className="cuadrante-gantt">
        {/* key={claveAnimacion} fuerza a React a recrear el SVG al pulsar "Simular",
            así se repite la animación de aparición segmento a segmento que ya
            existe en Gantt.tsx (gantt-aparecer), en vez de una animación fluida. */}
        <Gantt key={claveAnimacion} segmentos={segmentos} colorPorProceso={colorPorProceso} />
      </div>
    </div>
  );
}
