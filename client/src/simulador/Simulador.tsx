import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { planificar } from '@showdown/engine';
import type { Escenario } from '@showdown/engine';
import { EditorProcesos } from './EditorProcesos.js';
import { Cuadrante } from './Cuadrante.js';
import { planificarPrioridad } from './algoritmoPrioridad.js';
import { coloresPorProceso } from './colores.js';
import { EXPLICACIONES } from './explicaciones.js';
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

// La animación siempre dura entre estos dos extremos, sin importar qué tan
// larga sea la simulación en minutos — así una mesa con muchos procesos no
// tarda una eternidad en reproducirse, y una muy corta no pasa en un parpadeo.
const DURACION_ANIM_MIN_MS = 1200;
const DURACION_ANIM_MAX_MS = 6000;
const MS_POR_MINUTO_SIMULADO = 450;

export function Simulador() {
  const [procesos, setProcesos] = useState<ProcesoConPrioridad[]>(PROCESOS_INICIALES);
  const [quantum, setQuantum] = useState(2);
  const [variante, setVariante] = useState<'SJF' | 'SRTF'>('SJF');

  // Reloj compartido por los 4 cuadrantes: es lo que hace que la animación
  // se pueda comparar en vivo (a qué algoritmo le toma menos "minutos
  // simulados" terminar), en vez de cada uno animando por su cuenta.
  const [tiempoActual, setTiempoActual] = useState(0);
  const animacionRef = useRef<number | null>(null);

  // El modal empieza abierto: lo primero que se ve es el formulario, no los
  // cuadrantes. yaSimulado controla si ya hay algo válido detrás del modal
  // (para permitir cerrarlo con Escape/backdrop) — en la primera carga no,
  // porque detrás no hay nada que valga la pena ver todavía.
  const [modalAbierto, setModalAbierto] = useState(true);
  const [yaSimulado, setYaSimulado] = useState(false);
  const [ultimosValidos, setUltimosValidos] = useState<{
    procesos: ProcesoConPrioridad[];
    quantum: number;
  }>({
    procesos: PROCESOS_INICIALES,
    quantum: 2,
  });

  const hayNombresDuplicados = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const p of procesos) {
      const clave = p.nombre.trim().toLowerCase();
      if (clave) conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
    }
    return Array.from(conteo.values()).some((cant) => cant > 1);
  }, [procesos]);

  const hayNombresVacios = useMemo(
    () => procesos.some((p) => p.nombre.trim() === ''),
    [procesos],
  );

  const hayErroresProcesos = hayNombresDuplicados || hayNombresVacios;

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

  // El más largo de los 4 marca cuánto dura la animación completa: los
  // algoritmos más cortos simplemente dejan de avanzar antes que el reloj
  // llegue al final, lo cual de paso muestra a simple vista cuál terminó primero.
  const duracionMax = useMemo(() => {
    const fines = [
      ...lineas.FCFS.map((s) => s.fin),
      ...lineas.variante.map((s) => s.fin),
      ...lineas.RR.map((s) => s.fin),
      ...lineas.PRIORIDAD.map((s) => s.fin),
    ];
    return Math.max(1, ...fines);
  }, [lineas]);

  function iniciarAnimacion() {
    if (animacionRef.current !== null) cancelAnimationFrame(animacionRef.current);

    const prefiereMenosMovimiento =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefiereMenosMovimiento) {
      // Sin animar: se muestra el resultado completo de una vez.
      setTiempoActual(duracionMax);
      return;
    }

    const duracionMs = Math.min(
      DURACION_ANIM_MAX_MS,
      Math.max(DURACION_ANIM_MIN_MS, duracionMax * MS_POR_MINUTO_SIMULADO),
    );
    const inicio = performance.now();
    setTiempoActual(0);

    function tick(ahora: number) {
      const progreso = Math.min(1, (ahora - inicio) / duracionMs);
      setTiempoActual(progreso * duracionMax);
      animacionRef.current = progreso < 1 ? requestAnimationFrame(tick) : null;
    }

    animacionRef.current = requestAnimationFrame(tick);
  }

  // Cancela la animación en curso si el componente se desmonta a mitad de camino.
  useEffect(() => {
    return () => {
      if (animacionRef.current !== null) cancelAnimationFrame(animacionRef.current);
    };
  }, []);

  function simular() {
    if (hayErroresProcesos) return;
    setUltimosValidos({ procesos, quantum });
    setYaSimulado(true);
    setModalAbierto(false);
    iniciarAnimacion();
  }

  function cancelarEdicion() {
    if (yaSimulado) {
      setProcesos(ultimosValidos.procesos);
      setQuantum(ultimosValidos.quantum);
      setModalAbierto(false);
    }
  }

  function cerrarModalSiSePuede() {
    if (yaSimulado) {
      if (hayErroresProcesos) {
        cancelarEdicion();
      } else {
        setModalAbierto(false);
      }
    }
  }

  // Escape cierra el modal de procesos, pero solo si ya hay una simulación
  // corrida (si no, no hay nada detrás que mostrar y se sentiría roto).
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
          <button type="button" className="boton-secundario-claro" onClick={iniciarAnimacion}>
            ↻ Reiniciar
          </button>
          <button type="button" className="boton-secundario-claro" onClick={() => setModalAbierto(true)}>
            ⚙ Editar procesos
          </button>
          <Link to="/" className="boton-secundario-claro">
            ← Inicio
          </Link>
        </div>
      </header>

      {/* Leyenda de procesos con su color y datos */}
      {yaSimulado && (
        <div className="leyenda-procesos">
          <span className="leyenda-titulo">Procesos</span>
          <div className="leyenda-items">
            {procesosOrdenados.map((p) => (
              <div key={p.nombre} className="leyenda-item">
                <span
                  className="leyenda-pastilla"
                  style={{ background: colorPorProceso[p.nombre] }}
                />
                <span className="leyenda-nombre">{p.nombre}</span>
                <span className="leyenda-detalle">
                  t={p.llegada} r={p.rafaga} p={p.prioridad}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cuadrantes">
        <Cuadrante
          titulo="FCFS"
          acento="teal-oscuro"
          segmentos={lineas.FCFS}
          colorPorProceso={colorPorProceso}
          tiempoActual={tiempoActual}
          procesos={procesosOrdenados}
          info={EXPLICACIONES.FCFS}
          duracionMax={duracionMax}
        />
        <Cuadrante
          titulo="Round Robin"
          acento="teal-medio"
          segmentos={lineas.RR}
          colorPorProceso={colorPorProceso}
          tiempoActual={tiempoActual}
          procesos={procesosOrdenados}
          info={EXPLICACIONES.RR}
          duracionMax={duracionMax}
          subtitulo={`q=${quantum}`}
        />
        <Cuadrante
          // El título cambia entre "SJF" y "SRTF" según lo que se esté mostrando,
          // y la explicación del ícono "i" cambia con él.
          titulo={variante}
          acento="naranja"
          segmentos={lineas.variante}
          colorPorProceso={colorPorProceso}
          tiempoActual={tiempoActual}
          procesos={procesosOrdenados}
          info={EXPLICACIONES[variante]}
          duracionMax={duracionMax}
          toggle={{
            etiqueta: variante === 'SJF' ? 'Ver SRTF' : 'Ver SJF',
            onClick: () => setVariante((v) => (v === 'SJF' ? 'SRTF' : 'SJF')),
          }}
        />
        <Cuadrante
          titulo="Prioridad"
          acento="terracota"
          segmentos={lineas.PRIORIDAD}
          colorPorProceso={colorPorProceso}
          tiempoActual={tiempoActual}
          procesos={procesosOrdenados}
          info={EXPLICACIONES.PRIORIDAD}
          duracionMax={duracionMax}
          subtitulo="No apropiativa"
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
              colorPorProceso={colorPorProceso}
            />
            <div className="modal-acciones">
              {yaSimulado && (
                <button type="button" className="boton-secundario-claro" onClick={cancelarEdicion}>
                  Cancelar
                </button>
              )}
              <button
                type="button"
                className="boton-simular"
                onClick={simular}
                disabled={hayErroresProcesos}
                title={
                  hayNombresDuplicados
                    ? 'No se puede simular: hay procesos con nombres iguales'
                    : hayNombresVacios
                      ? 'No se puede simular: todos los procesos deben tener nombre'
                      : undefined
                }
              >
                ▶ Simular
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}