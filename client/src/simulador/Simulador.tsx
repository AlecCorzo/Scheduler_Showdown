import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { planificar } from '@showdown/engine';
import type { Escenario } from '@showdown/engine';
import { EditorProcesos } from './EditorProcesos.js';
import { Cuadrante } from './Cuadrante.js';
import { planificarPrioridad } from './algoritmoPrioridad.js';
import { coloresPorProceso } from './colores.js';
import type { ProcesoConPrioridad } from './tipos.js';
import './simulador.css';

// Mismo escenario de ejemplo que el resto del proyecto (README, docs), con
// prioridades agregadas a mano solo para que el simulador no arranque vacío.
const PROCESOS_INICIALES: ProcesoConPrioridad[] = [
  { nombre: 'Ana', llegada: 0, rafaga: 7, prioridad: 2 },
  { nombre: 'Beto', llegada: 2, rafaga: 4, prioridad: 4 },
  { nombre: 'Caro', llegada: 4, rafaga: 1, prioridad: 1 },
  { nombre: 'Dani', llegada: 5, rafaga: 4, prioridad: 3 },
];

export function Simulador() {
  const [procesos, setProcesos] = useState<ProcesoConPrioridad[]>(PROCESOS_INICIALES);
  const [quantum, setQuantum] = useState(2);
  const [variante, setVariante] = useState<'SJF' | 'SRTF'>('SJF');
  const [claveAnimacion, setClaveAnimacion] = useState(0);

  // El modal empieza abierto: lo primero que se ve es el formulario, no los
  // cuadrantes. yaSimulado controla si ya hay algo válido detrás del modal
  // (para permitir cerrarlo con Escape/backdrop) — en la primera carga no,
  // porque detrás no hay nada que valga la pena ver todavía.
  const [modalAbierto, setModalAbierto] = useState(true);
  const [yaSimulado, setYaSimulado] = useState(false);

  // Ordenados por llegada una sola vez: es el orden que espera el motor
  // (ver el comentario en engine/src/tipos.ts sobre Escenario.procesos) y
  // el que reusa planificarPrioridad para desempatar por índice original.
  const procesosOrdenados = useMemo(
    () => [...procesos].sort((a, b) => a.llegada - b.llegada),
    [procesos],
  );

  const escenario: Escenario = useMemo(
    () => ({ procesos: procesosOrdenados, quantum, mostrarQuantum: true }),
    [procesosOrdenados, quantum],
  );

  const colorPorProceso = useMemo(
    () => coloresPorProceso(procesos.map((p) => p.nombre)),
    [procesos],
  );

  const lineas = useMemo(
    () => ({
      FCFS: planificar(escenario, 'FCFS'),
      variante: planificar(escenario, variante),
      RR: planificar(escenario, 'RR'),
      PRIORIDAD: planificarPrioridad(procesosOrdenados),
    }),
    [escenario, variante, procesosOrdenados],
  );

  function simular() {
    setClaveAnimacion((c) => c + 1);
    setYaSimulado(true);
    setModalAbierto(false);
  }

  function cerrarModalSiSePuede() {
    if (yaSimulado) setModalAbierto(false);
  }

  // Escape cierra el modal, pero solo si ya hay una simulación corrida
  // (si no, no hay nada detrás que mostrar y se sentiría roto).
  useEffect(() => {
    if (!modalAbierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrarModalSiSePuede();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalAbierto, yaSimulado]);

  return (
    <main className="simulador">
      <header className="simulador-cabecera">
        <h1>Simulador de planificación</h1>
        <div className="simulador-cabecera-acciones">
          <button type="button" className="boton-secundario" onClick={() => setModalAbierto(true)}>
            Editar procesos
          </button>
          <Link to="/">← Volver al inicio</Link>
        </div>
      </header>

      <div className="cuadrantes">
        <Cuadrante
          titulo="FCFS"
          acento="opcion-1"
          segmentos={lineas.FCFS}
          colorPorProceso={colorPorProceso}
          claveAnimacion={claveAnimacion}
        />
        <Cuadrante
          titulo="Round Robin"
          acento="opcion-4"
          segmentos={lineas.RR}
          colorPorProceso={colorPorProceso}
          claveAnimacion={claveAnimacion}
        />
        <Cuadrante
          // El título cambia entre "SJF" y "SRTF" según lo que se esté mostrando.
          titulo={variante}
          acento="opcion-2"
          segmentos={lineas.variante}
          colorPorProceso={colorPorProceso}
          claveAnimacion={claveAnimacion}
          toggle={{
            etiqueta: variante === 'SJF' ? 'Ver SRTF' : 'Ver SJF',
            onClick: () => setVariante((v) => (v === 'SJF' ? 'SRTF' : 'SJF')),
          }}
        />
        <Cuadrante
          titulo="Prioridad"
          acento="opcion-3"
          segmentos={lineas.PRIORIDAD}
          colorPorProceso={colorPorProceso}
          claveAnimacion={claveAnimacion}
        />
      </div>

      {modalAbierto && (
        <div
          className="modal-fondo"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrarModalSiSePuede();
          }}
        >
          <div className="modal-caja" role="dialog" aria-modal="true" aria-label="Procesos del simulador">
            <h2>Procesos</h2>
            <EditorProcesos
              procesos={procesos}
              quantum={quantum}
              onCambiarProcesos={setProcesos}
              onCambiarQuantum={setQuantum}
            />
            <div className="modal-acciones">
              {yaSimulado && (
                <button type="button" className="boton-secundario" onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
              )}
              <button type="button" className="boton-simular" onClick={simular}>
                Simular
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
