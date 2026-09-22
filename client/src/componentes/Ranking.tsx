import type { FilaRanking } from '@showdown/engine';

interface Props {
  filas: FilaRanking[];
  resaltarNombre?: string;
}

export function Ranking({ filas, resaltarNombre }: Props) {
  return (
    <ol className="ranking">
      {filas.map((f) => (
        <li key={f.nombre} className={f.nombre === resaltarNombre ? 'yo' : undefined}>
          <span className="posicion">{f.posicion}</span>
          <span className="nombre">{f.nombre}</span>
          <span className="puntos">{f.puntos}</span>
        </li>
      ))}
    </ol>
  );
}
