import { useEffect, useMemo, useState } from 'react';
import type { Segmento } from '@showdown/engine';
import { Gantt } from '../componentes/Gantt.js';
import type { InfoAlgoritmo } from './explicaciones.js';

interface Toggle {
  etiqueta: string;
  onClick: () => void;
}

interface ProcesoLlegada {
  nombre: string;
  llegada: number;
  rafaga: number;
}

interface Props {
  titulo: string;
  subtitulo?: string;
  acento: 'teal-oscuro' | 'teal-medio' | 'naranja' | 'terracota';
  segmentos: Segmento[];
  colorPorProceso: Record<string, string>;
  tiempoActual: number;
  procesos: ProcesoLlegada[];
  info: InfoAlgoritmo;
  toggle?: Toggle;
  duracionMax: number;
  esperaPromedio?: number;
  esMasEficiente?: boolean;
}

/** Calcula el tiempo de finalización (makespan) a partir de los segmentos. */
function calcularStats(segmentos: Segmento[]) {
  const makespanTotal = Math.max(...segmentos.map((s) => s.fin), 0);
  return { makespan: makespanTotal };
}

export function Cuadrante({
  titulo,
  subtitulo,
  acento,
  segmentos,
  colorPorProceso,
  tiempoActual,
  procesos,
  info,
  toggle,
  duracionMax,
  esperaPromedio,
  esMasEficiente,
}: Props) {
  const [infoAbierta, setInfoAbierta] = useState(false);

  const stats = useMemo(() => calcularStats(segmentos), [segmentos]);

  // Proceso que está usando la CPU en el minuto actual (entero)
  const procesoActual = useMemo(() => {
    const m = Math.floor(tiempoActual);
    if (m >= stats.makespan && stats.makespan > 0) return 'FIN';
    const seg = segmentos.find((s) => s.inicio <= m && m < s.fin);
    return seg ? seg.proceso : null;
  }, [segmentos, tiempoActual, stats.makespan]);

  // Progreso relativo (0..1) de este cuadrante vs el máximo global
  const progreso = duracionMax > 0 ? Math.min(tiempoActual / duracionMax, 1) : 0;

  // ¿Este cuadrante terminó antes que el reloj global?
  const esMasCorto = stats.makespan < duracionMax;
  const terminado = tiempoActual >= stats.makespan;

  useEffect(() => {
    if (!infoAbierta) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setInfoAbierta(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [infoAbierta]);

  return (
    <div className={`cuadrante ${acento}${terminado && esMasCorto ? ' terminado-rapido' : ''}`}>
      {/* Barra de progreso de la animación */}
      <div
        className="cuadrante-progreso"
        style={{ width: `${progreso * 100}%` }}
        aria-hidden="true"
      />

      <div className="cuadrante-cabecera">
        <div className="cuadrante-titulo-grupo">
          <h2>{titulo}</h2>
          {subtitulo && <span className="cuadrante-subtitulo">{subtitulo}</span>}
        </div>
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

      {/* Estadísticas: tiempo de finalización, espera promedio y proceso en CPU en el minuto actual */}
      <div className="cuadrante-stats">
        <span className="cuadrante-stat">
          Termina en{' '}
          <span className="cuadrante-stat-valor">
            {tiempoActual >= stats.makespan ? stats.makespan : '…'}
          </span>
        </span>
        {esperaPromedio !== undefined && (
          <span className="cuadrante-stat">
            Espera prom.{' '}
            <span className="cuadrante-stat-valor">
              {esperaPromedio.toFixed(1)}m
            </span>
          </span>
        )}
        <span className="cuadrante-stat">
          {procesoActual === 'FIN' ? (
            <span className="cuadrante-cpu-badge cpu-fin">✓ Completado</span>
          ) : procesoActual ? (
            <span
              className="cuadrante-cpu-badge"
              style={{
                backgroundColor: colorPorProceso[procesoActual]
                  ? `${colorPorProceso[procesoActual]}33`
                  : 'rgba(255,255,255,0.15)',
                borderColor: colorPorProceso[procesoActual] ?? 'rgba(255,255,255,0.4)',
                color: colorPorProceso[procesoActual] ?? '#ffffff',
              }}
            >
              En CPU: <strong>{procesoActual}</strong>
            </span>
          ) : (
            <span className="cuadrante-cpu-badge cpu-ociosa">CPU Ociosa</span>
          )}
        </span>
        {esMasEficiente && (
          <span className="cuadrante-badge-eficiente" title="Algoritmo con menor tiempo de espera promedio">
            🏆 Más eficiente
          </span>
        )}
        {terminado && esMasCorto && (
          <span className="cuadrante-badge-rapido">✓ más rápido</span>
        )}
      </div>

      <div className="cuadrante-gantt">
        <Gantt
          segmentos={segmentos}
          colorPorProceso={colorPorProceso}
          tiempoActual={tiempoActual}
          procesos={procesos}
        />
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