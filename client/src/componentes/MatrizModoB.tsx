import { ALGORITMOS, NOMBRE_ALGORITMO } from '@showdown/engine';
import type { Algoritmo } from '@showdown/engine';

type Columna = Algoritmo | 'SIN_RESPUESTA';

interface Props {
  matriz: Record<string, Record<Columna, number>>;
}

const COLUMNAS: Columna[] = [...ALGORITMOS, 'SIN_RESPUESTA'];

export function MatrizModoB({ matriz }: Props) {
  const filas = Object.keys(matriz);
  if (!filas.length) return null;

  return (
    <table className="matriz-modo-b">
      <thead>
        <tr>
          <th>Correcta(s)</th>
          {COLUMNAS.map((c) => (
            <th key={c}>{c === 'SIN_RESPUESTA' ? 'Sin responder' : NOMBRE_ALGORITMO[c]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila}>
            <td>{fila}</td>
            {COLUMNAS.map((c) => (
              <td key={c}>{matriz[fila]![c]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
