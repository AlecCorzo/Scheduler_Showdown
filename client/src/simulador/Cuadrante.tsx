import { useEffect, useState } from 'react';
import type { Segmento } from '@showdown/engine';
import { Gantt } from '../componentes/Gantt.js';
import type { InfoAlgoritmo } from './explicaciones.js';

interface Toggle {
  etiqueta: string;
  onClick: () => void;
}

interface Props {
  titulo: string;
  acento: 'teal-oscuro' | 'teal-medio' | 'naranja' | 'terracota';
  segmentos: Segmento[];
  colorPorProceso: Record<string, string>;
  claveAnimacion: number;
  info: InfoAlgoritmo;
  toggle?: Toggle;
}

export function Cuadrante({ titulo, acento, segmentos, colorPorProceso, claveAnimacion, info, toggle }: Props) {
  const [infoAbierta, setInfoAbierta] = useState(false);

  useEffect(() => {
    if (!infoAbierta) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setInfoAbierta(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [infoAbierta]);

  return (
    <div className={`cuadrante ${acento}`}>
      <div className="cuadrante-cabecera">
        <h2>{titulo}</h2>
        <div className="cuadrante-acciones">
          {toggle && (
            <button type="button" className="boton-alterna" onClick={toggle.onClick}>
              {toggle.etiqueta}
            </button>
          )}
          <button
            type="button"
            className="boton-info"
            onClick={() => setInfoAbierta(true)}
            aria-label={`Cómo funciona ${titulo}`}
          >
            i
          </button>
        </div>
      </div>
      <div className="cuadrante-gantt">
        {/* key={claveAnimacion} fuerza a React a recrear el SVG al pulsar "Simular"
            o "Reiniciar animación", así se repite la animación de aparición
            segmento a segmento que ya existe en Gantt.tsx (gantt-aparecer),
            en vez de una animación fluida. */}
        <Gantt key={claveAnimacion} segmentos={segmentos} colorPorProceso={colorPorProceso} />
      </div>

      {infoAbierta && (
        <div className="modal-fondo" onClick={(e) => e.target === e.currentTarget && setInfoAbierta(false)}>
          <div className="modal-caja modal-info" role="dialog" aria-modal="true" aria-label={`Cómo funciona ${info.titulo}`}>
            <h2>{info.titulo}</h2>
            <div className="info-columnas">
              <div>
                <h3>Explicación</h3>
                <p>{info.explicacion}</p>
              </div>
              <div>
                <h3>Ejemplo</h3>
                <p>{info.ejemplo}</p>
              </div>
            </div>
            <div className="modal-acciones">
              <button type="button" className="boton-secundario-claro" onClick={() => setInfoAbierta(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
