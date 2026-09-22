import { NOMBRE_ALGORITMO } from '@showdown/engine';
import type { Categoria } from '@showdown/engine';

interface Fila {
  categoria: Categoria;
  aciertos: number;
  total: number;
}

const ETIQUETA: Record<Categoria, string> = {
  FCFS: 'FCFS',
  SJF: 'SJF',
  SRTF: 'SRTF',
  RR: NOMBRE_ALGORITMO.RR,
  COMPARACION: 'Comparación',
};

export function Resumen({ filas }: { filas: Fila[] }) {
  return (
    <table className="resumen">
      <thead>
        <tr>
          <th>Categoría</th>
          <th>Aciertos</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.categoria}>
            <td>{ETIQUETA[f.categoria]}</td>
            <td>
              {f.aciertos} / {f.total}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
