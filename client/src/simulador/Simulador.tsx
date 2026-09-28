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

/** Calcula el tiempo promedio de espera de un algoritmo (métrica estándar de eficiencia). */
function calcularEsperaPromedio(
  segmentos: { proceso: string; fin: number }[],
  procesos: { nombre: string; llegada: number; rafaga: number }[],
): number {
  if (procesos.length === 0) return 0;
  const finPorProceso = new Map<string, number>();
  for (const s of segmentos) {
    const act = finPorProceso.get(s.proceso) ?? 0;
    if (s.fin > act) finPorProceso.set(s.proceso, s.fin);
  }

  let sumaEspera = 0;
  for (const p of procesos) {
    const fin = finPorProceso.get(p.nombre) ?? p.llegada;
    const espera = Math.max(0, fin - p.llegada - p.rafaga);
    sumaEspera += espera;
  }

  return sumaEspera / procesos.length;
}

export function Simulador() {
  const [procesos, setProcesos] = useState<ProcesoConPrioridad[]>(PROCESOS_INICIALES);
  const [quantum, setQuantum] = useState(2);
  const [variante, setVariante] = useState<'SJF' | 'SRTF'>('SJF');

  // Reloj compartido por los 4 cuadrantes: es lo que hace que la animación
  // se pueda comparar en vivo (a qué algoritmo le toma menos "minutos
  // simulados" terminar), en vez de cada uno animando por su cuenta.
  const [tiempoActual, setTiempoActual] = useState(0);
  const [reproduciendo, setReproduciendo] = useState(false);
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

  const esperas = useMemo(() => {
    return {
      FCFS: calcularEsperaPromedio(lineas.FCFS, procesosOrdenados),
      variante: calcularEsperaPromedio(lineas.variante, procesosOrdenados),
      RR: calcularEsperaPromedio(lineas.RR, procesosOrdenados),
      PRIORIDAD: calcularEsperaPromedio(lineas.PRIORIDAD, procesosOrdenados),
    };
  }, [lineas, procesosOrdenados]);

  const masEficiente = useMemo(() => {
    const lista = [
      { id: 'FCFS', nombre: 'FCFS', espera: esperas.FCFS },
      { id: 'variante', nombre: variante, espera: esperas.variante },
      { id: 'RR', nombre: 'Round Robin', espera: esperas.RR },
      { id: 'PRIORIDAD', nombre: 'Prioridad', espera: esperas.PRIORIDAD },
    ];

    const minEspera = Math.min(...lista.map((x) => x.espera));
    const ganadores = lista.filter((x) => Math.abs(x.espera - minEspera) < 0.001);

    return {
      nombres: ganadores.map((g) => g.nombre).join(' y '),
      ids: new Set(ganadores.map((g) => g.id)),
      minEspera,
    };
  }, [esperas, variante]);

  function pausarAnimacion() {
    if (animacionRef.current !== null) {
      cancelAnimationFrame(animacionRef.current);
      animacionRef.current = null;
    }
    setReproduciendo(false);
  }

  function reproducirAnimacion(desde?: number) {
    if (animacionRef.current !== null) {
      cancelAnimationFrame(animacionRef.current);
      animacionRef.current = null;
    }

    const prefiereMenosMovimiento =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefiereMenosMovimiento) {
      setTiempoActual(duracionMax);
      setReproduciendo(false);
      return;
    }

    const tInicio = desde !== undefined ? desde : tiempoActual >= duracionMax ? 0 : tiempoActual;
    setTiempoActual(tInicio);
    setReproduciendo(true);

    const duracionMsTotal = Math.min(
      DURACION_ANIM_MAX_MS,
      Math.max(DURACION_ANIM_MIN_MS, duracionMax * MS_POR_MINUTO_SIMULADO),
    );
    const proporcionRestante = duracionMax > 0 ? (duracionMax - tInicio) / duracionMax : 1;
    const duracionMs = Math.max(200, duracionMsTotal * proporcionRestante);
    const inicio = performance.now();

    function tick(ahora: number) {
      const progreso = Math.min(1, (ahora - inicio) / duracionMs);
      const nuevoTiempo = tInicio + progreso * (duracionMax - tInicio);
      setTiempoActual(nuevoTiempo);

      if (progreso < 1) {
        animacionRef.current = requestAnimationFrame(tick);
      } else {
        animacionRef.current = null;
        setReproduciendo(false);
      }
    }

    animacionRef.current = requestAnimationFrame(tick);
  }

  function togglePlayPausa() {
    if (reproduciendo) {
      pausarAnimacion();
    } else {
      reproducirAnimacion();
    }
  }

  function pasoAnterior() {
    pausarAnimacion();
    setTiempoActual((t) => {
      const nuevo = t % 1 !== 0 ? Math.floor(t) : t - 1;
      return Math.max(0, nuevo);
    });
  }

  function pasoSiguiente() {
    pausarAnimacion();
    setTiempoActual((t) => {
      const nuevo = t % 1 !== 0 ? Math.ceil(t) : t + 1;
      return Math.min(duracionMax, nuevo);
    });
  }

  function reiniciar() {
    pausarAnimacion();
    reproducirAnimacion(0);
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
    reproducirAnimacion(0);
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

  // Atajos de teclado: Escape para modal, flechas ← y → para paso a paso, Espacio para play/pausa
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (modalAbierto) {
        if (e.key === 'Escape') cerrarModalSiSePuede();
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        pasoAnterior();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        pasoSiguiente();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlayPausa();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalAbierto, yaSimulado, duracionMax, tiempoActual, reproduciendo]);

  const minutoEntero = Math.floor(tiempoActual);

  return (
    <main className="simulador">
      <header className="simulador-cabecera">
        <h1>Simulador de planificación</h1>

        {yaSimulado && (
          <div className="controles-paso-a-paso" role="toolbar" aria-label="Controles paso a paso y reproducción">
            <span className="controles-label">Paso a paso:</span>
            <button
              type="button"
              className="boton-paso"
              onClick={pasoAnterior}
              disabled={tiempoActual <= 0}
              title="Minuto anterior (Tecla ←)"
              aria-label="Minuto anterior"
            >
              &lt;
            </button>

            <div className="indicador-minuto" title="Minuto actual / Total de la simulación">
              <span className="minuto-numero">{minutoEntero}</span>
              <span className="minuto-separador">/</span>
              <span className="minuto-total">{duracionMax} min</span>
            </div>

            <button
              type="button"
              className="boton-paso"
              onClick={pasoSiguiente}
              disabled={tiempoActual >= duracionMax}
              title="Minuto siguiente (Tecla →)"
              aria-label="Minuto siguiente"
            >
              &gt;
            </button>

            <button
              type="button"
              className="boton-play-pausa"
              onClick={togglePlayPausa}
              title={reproduciendo ? 'Pausar animación (Espacio)' : 'Reproducir continuamente (Espacio)'}
            >
              {reproduciendo ? '⏸ Pausa' : '▶ Auto'}
            </button>

            <button
              type="button"
              className="boton-control-secundario"
              onClick={reiniciar}
              title="Reiniciar desde minuto 0"
            >
              ↻ Reiniciar
            </button>
          </div>
        )}

        <div className="simulador-cabecera-acciones">
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

          {/* Insignia del algoritmo más eficiente */}
          <div
            className="leyenda-mas-eficiente"
            title="Algoritmo más eficiente según la métrica estándar de Sistemas Operativos: menor tiempo promedio de espera."
          >
            <span className="mas-eficiente-icono">🏆</span>
            <span className="mas-eficiente-texto">Más eficiente:</span>
            <strong className="mas-eficiente-nombre">{masEficiente.nombres}</strong>
            <span className="mas-eficiente-detalle">
              (espera prom: {masEficiente.minEspera.toFixed(1)} min)
            </span>
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
          esperaPromedio={esperas.FCFS}
          esMasEficiente={masEficiente.ids.has('FCFS')}
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
          esperaPromedio={esperas.RR}
          esMasEficiente={masEficiente.ids.has('RR')}
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
          esperaPromedio={esperas.variante}
          esMasEficiente={masEficiente.ids.has('variante')}
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
          esperaPromedio={esperas.PRIORIDAD}
          esMasEficiente={masEficiente.ids.has('PRIORIDAD')}
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