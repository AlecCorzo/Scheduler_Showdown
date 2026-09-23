import type { ProcesoConPrioridad } from './tipos.js';

interface Props {
  procesos: ProcesoConPrioridad[];
  quantum: number;
  onCambiarProcesos: (procesos: ProcesoConPrioridad[]) => void;
  onCambiarQuantum: (quantum: number) => void;
}

// Con más de 6 los 4 cuadrantes se aprietan demasiado para caber sin scroll.
const MAX_PROCESOS = 6;

function procesoVacio(indice: number): ProcesoConPrioridad {
  return { nombre: `P${indice}`, llegada: 0, rafaga: 1, prioridad: 1 };
}

export function EditorProcesos({ procesos, quantum, onCambiarProcesos, onCambiarQuantum }: Props) {
  function actualizar(i: number, campo: keyof ProcesoConPrioridad, valor: string) {
    const copia = procesos.map((p) => ({ ...p }));
    if (campo === 'nombre') {
      copia[i]!.nombre = valor;
    } else {
      copia[i]![campo] = Number(valor);
    }
    onCambiarProcesos(copia);
  }

  function agregar() {
    if (procesos.length >= MAX_PROCESOS) return;
    onCambiarProcesos([...procesos, procesoVacio(procesos.length + 1)]);
  }

  function quitar(i: number) {
    if (procesos.length <= 1) return;
    onCambiarProcesos(procesos.filter((_, idx) => idx !== i));
  }

  return (
    <div className="editor-procesos">
      <table>
        <thead>
          <tr>
            <th>Proceso</th>
            <th>Llegada</th>
            <th>Ráfaga</th>
            <th>Prioridad</th>
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {procesos.map((p, i) => (
            <tr key={i}>
              <td>
                <input value={p.nombre} onChange={(e) => actualizar(i, 'nombre', e.target.value)} />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  value={p.llegada}
                  onChange={(e) => actualizar(i, 'llegada', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  value={p.rafaga}
                  onChange={(e) => actualizar(i, 'rafaga', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={p.prioridad}
                  onChange={(e) => actualizar(i, 'prioridad', e.target.value)}
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  disabled={procesos.length <= 1}
                  aria-label={`Quitar ${p.nombre}`}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="editor-procesos-acciones">
        <button type="button" onClick={agregar} disabled={procesos.length >= MAX_PROCESOS}>
          + Agregar proceso
        </button>
        <label className="quantum-editor">
          Quantum (RR)
          <input
            type="number"
            min={1}
            value={quantum}
            onChange={(e) => onCambiarQuantum(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="aviso">
        Mayor número de prioridad = se ejecuta primero. Máximo {MAX_PROCESOS} procesos para que los 4 cuadros
        quepan sin desbordarse. Los nombres deben ser distintos entre sí.
      </p>
    </div>
  );
}
