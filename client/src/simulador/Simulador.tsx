import { useMemo, useState } from 'react';
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
  }

  return (
    <main className="simulador">
      <header className="simulador-cabecera">
        <h1>Simulador de planificación</h1>
        <Link to="/">← Volver al inicio</Link>
      </header>

      <EditorProcesos
        procesos={procesos}
        quantum={quantum}
        onCambiarProcesos={setProcesos}
        onCambiarQuantum={setQuantum}
      />

      <button type="button" className="boton-simular" onClick={simular}>
        ▶ Simular
      </button>

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
          titulo="SJF"
          subtitulo={variante === 'SRTF' ? 'mostrando SRTF' : undefined}
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
    </main>
  );
}
