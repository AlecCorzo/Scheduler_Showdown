interface Props {
  opciones: string[];
  seleccionada?: number | null;
  correctas?: number[]; // si viene, resalta las correctas (revelado)
  deshabilitado?: boolean;
  onSeleccionar?: (indice: number) => void;
}

const FORMA = ['▲', '◆', '●', '■'];
const CLASE = ['opcion-1', 'opcion-2', 'opcion-3', 'opcion-4'];

export function Botones({ opciones, seleccionada, correctas, deshabilitado, onSeleccionar }: Props) {
  return (
    <div className="botones">
      {opciones.map((texto, i) => {
        const esCorrecta = correctas?.includes(i) ?? false;
        const esElegida = seleccionada === i;
        const clases = ['boton-opcion', CLASE[i], esCorrecta && 'correcta', esElegida && !esCorrecta && 'elegida']
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={texto}
            type="button"
            className={clases}
            disabled={deshabilitado || !onSeleccionar}
            onClick={() => onSeleccionar?.(i)}
          >
            <span className="forma" aria-hidden="true">
              {FORMA[i]}
            </span>
            {texto}
          </button>
        );
      })}
    </div>
  );
}
