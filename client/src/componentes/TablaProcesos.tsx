import type { Escenario } from '@showdown/engine';

interface Props {
  escenario: Escenario;
  objetivo?: string | null;
}

export function TablaProcesos({ escenario, objetivo }: Props) {
  return (
    <div className="tabla-procesos">
      <table>
        <thead>
          <tr>
            <th>Proceso</th>
            <th>Llegada</th>
            <th>Ráfaga</th>
          </tr>
        </thead>
        <tbody>
          {escenario.procesos.map((p) => (
            <tr key={p.nombre} className={p.nombre === objetivo ? 'objetivo' : undefined}>
              <td>{p.nombre}</td>
              <td>{p.llegada}</td>
              <td>{p.rafaga}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {escenario.mostrarQuantum && <p className="quantum">Quantum = {escenario.quantum}</p>}
    </div>
  );
}
