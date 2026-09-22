import { ALGORITMOS, NOMBRE_ALGORITMO } from '@showdown/engine';
import type { Algoritmo, Segmento } from '@showdown/engine';
import { Gantt } from './Gantt.js';

interface Props {
  lineas: Partial<Record<Algoritmo, Segmento[]>>;
  objetivo: string;
  ganadores: Algoritmo[];
}

function finDe(segmentos: Segmento[], objetivo: string): number | null {
  let fin: number | null = null;
  for (const s of segmentos) if (s.proceso === objetivo) fin = s.fin;
  return fin;
}

export function GanttModoB({ lineas, objetivo, ganadores }: Props) {
  return (
    <div className="gantt-modo-b">
      {ALGORITMOS.map((alg) => {
        const segmentos = lineas[alg];
        if (!segmentos) return null;
        const fin = finDe(segmentos, objetivo);
        return (
          <div key={alg} className={`gantt-modo-b-fila${ganadores.includes(alg) ? ' ganador' : ''}`}>
            <span className="gantt-modo-b-etiqueta">{NOMBRE_ALGORITMO[alg]}</span>
            <Gantt segmentos={segmentos} resaltar={fin !== null ? { tipo: 'linea', minuto: fin } : null} />
          </div>
        );
      })}
    </div>
  );
}
