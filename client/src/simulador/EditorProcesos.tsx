import type { ProcesoConPrioridad } from './tipos.js';

interface Props {
  procesos: ProcesoConPrioridad[];
  quantum: number;
  onCambiarProcesos: (procesos: ProcesoConPrioridad[]) => void;
  onCambiarQuantum: (quantum: number) => void;
  /** Colores actuales para mostrar una pastilla al lado de cada fila */
  colorPorProceso?: Record<string, string>;
}

// Con más de 6 los 4 cuadrantes se aprietan demasiado para caber sin scroll.
const MAX_PROCESOS = 6;

const PRIORIDAD_MIN = 1;
const PRIORIDAD_MAX = 10;

function generarNombreUnico(procesosExistentes: ProcesoConPrioridad[]): string {
  const nombresUsados = new Set(procesosExistentes.map((p) => p.nombre.trim().toLowerCase()));
  let indice = 1;
  while (nombresUsados.has(`p${indice}`)) {
    indice++;
  }
  return `P${indice}`;
}

export function EditorProcesos({
  procesos,
  quantum,
  onCambiarProcesos,
  onCambiarQuantum,
  colorPorProceso = {},
}: Props) {
  // Contar cuántas veces aparece cada nombre para detectar duplicados
  const conteoNombres = new Map<string, number>();
  for (const p of procesos) {
    const clave = p.nombre.trim().toLowerCase();
    if (clave) {
      conteoNombres.set(clave, (conteoNombres.get(clave) ?? 0) + 1);
    }
  }

  const hayNombresDuplicados = Array.from(conteoNombres.values()).some((c) => c > 1);
  const hayNombresVacios = procesos.some((p) => p.nombre.trim() === '');

  function actualizar(i: number, campo: keyof ProcesoConPrioridad, valor: string) {
    const copia = procesos.map((p) => ({ ...p }));
    if (campo === 'nombre') {
      copia[i]!.nombre = valor;
    } else if (campo === 'prioridad') {
      // Se recorta el valor real, no solo el min/max del input: así tipear
      // "50" a mano no cuela, no solo las flechitas del número.
      const num = Number(valor);
      copia[i]!.prioridad = Number.isFinite(num)
        ? Math.min(PRIORIDAD_MAX, Math.max(PRIORIDAD_MIN, num))
        : PRIORIDAD_MIN;
    } else {
      copia[i]![campo] = Number(valor);
    }
    onCambiarProcesos(copia);
  }

  function agregar() {
    if (procesos.length >= MAX_PROCESOS) return;
    onCambiarProcesos([
      ...procesos,
      { nombre: generarNombreUnico(procesos), llegada: 0, rafaga: 1, prioridad: 1 },
    ]);
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
          {procesos.map((p, i) => {
            const clave = p.nombre.trim().toLowerCase();
            const esDuplicado = clave !== '' && (conteoNombres.get(clave) ?? 0) > 1;
            const esVacio = p.nombre.trim() === '';
            const color = colorPorProceso[p.nombre];

            return (
              <tr key={i} className="con-color" style={{ borderLeft: color ? `3px solid ${color}` : '3px solid transparent' }}>
                <td>
                  <input
                    value={p.nombre}
                    className={esDuplicado || esVacio ? 'input-error' : ''}
                    title={
                      esDuplicado
                        ? 'Este nombre ya está en uso por otro proceso'
                        : esVacio
                          ? 'El nombre no puede estar vacío'
                          : undefined
                    }
                    aria-invalid={esDuplicado || esVacio}
                    onChange={(e) => actualizar(i, 'nombre', e.target.value)}
                    onBlur={() => actualizar(i, 'nombre', p.nombre.trim())}
                  />
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
                    min={PRIORIDAD_MIN}
                    max={PRIORIDAD_MAX}
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
                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hayNombresDuplicados && (
        <p className="mensaje-error" role="alert">
          ⚠️ Los nombres de los procesos no pueden ser iguales.
        </p>
      )}
      {hayNombresVacios && !hayNombresDuplicados && (
        <p className="mensaje-error" role="alert">
          ⚠️ Todos los procesos deben tener un nombre asignado.
        </p>
      )}
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
            onChange={(e) => onCambiarQuantum(Math.max(1, Number(e.target.value)))}
          />
        </label>
      </div>
      <p className="aviso">
        Prioridad de {PRIORIDAD_MIN} a {PRIORIDAD_MAX}: mayor número = se ejecuta primero.
        Máximo {MAX_PROCESOS} procesos.
      </p>
    </div>
  );
}
