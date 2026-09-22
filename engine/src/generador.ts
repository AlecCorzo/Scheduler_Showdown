import { cpuOciosa, duracionTotal, lineasDe, variantesDe } from './consultas.js';
import { construirCpuEnT, construirMejorAlgoritmo, construirMinutoFin, type PreguntaCandidata } from './preguntas.js';
import { crearRng, elegir, entero, type Rng } from './rng.js';
import { ALGORITMOS, type Algoritmo, type ConfigPartida, type Escenario, type Modo, type Ronda, type TipoPregunta } from './tipos.js';

export const NOMBRES = ['Ana', 'Beto', 'Caro', 'Dani'] as const;
export const DURACION_MAX = 20;
export const MAX_INTENTOS = 20_000;
export const MAX_VARIANTES = 8;
export const MAX_CORRECTAS = 2;
export const FASE_UNICA = 200;

const ESCENARIO_CALENTAMIENTO: Escenario = {
  procesos: [
    { nombre: 'Ana', llegada: 0, rafaga: 7 },
    { nombre: 'Beto', llegada: 2, rafaga: 4 },
    { nombre: 'Caro', llegada: 4, rafaga: 1 },
    { nombre: 'Dani', llegada: 5, rafaga: 4 },
  ],
  quantum: 2,
  mostrarQuantum: false,
};

/**
 * El pseudocódigo de 7.3 no recibe el algoritmo de la ronda, pero mostrarQuantum
 * depende de si ese algoritmo es RR (además de si el modo es B), así que se agrega
 * como parámetro para calcularlo sin un paso extra.
 */
function escenarioAleatorio(
  modo: Modo,
  dificultad: ConfigPartida['dificultad'],
  algoritmoDeLaRonda: Algoritmo | null,
  rng: Rng,
): Escenario {
  const n = modo === 'B' ? 3 : entero(rng, 3, 4);
  const rafagaMax = dificultad === 'facil' ? 5 : 8;
  const crudos = Array.from({ length: n }, () => ({
    llegada: entero(rng, 0, 6),
    rafaga: entero(rng, 1, rafagaMax),
  }));
  const minLlegada = Math.min(...crudos.map((c) => c.llegada));
  const conIndice = crudos.map((c, i) => ({ llegada: c.llegada - minLlegada, rafaga: c.rafaga, i }));
  conIndice.sort((a, b) => a.llegada - b.llegada || a.i - b.i);

  return {
    procesos: conIndice.map((c, idx) => ({ nombre: NOMBRES[idx]!, llegada: c.llegada, rafaga: c.rafaga })),
    quantum: entero(rng, 1, 4),
    mostrarQuantum: modo === 'B' || algoritmoDeLaRonda === 'RR',
  };
}

function elegirMenosUsado<K extends string>(contador: Record<K, number>, rng: Rng): K {
  const entradas = Object.entries(contador) as [K, number][];
  const min = Math.min(...entradas.map(([, v]) => v));
  const empatados = entradas.filter(([, v]) => v === min).map(([k]) => k);
  return elegir(rng, empatados);
}

interface Generado {
  escenario: Escenario;
  candidata: PreguntaCandidata;
}

function intentarGenerar(
  construir: (esc: Escenario, variantes: ReturnType<typeof variantesDe>) => PreguntaCandidata[],
  modo: Modo,
  dificultad: ConfigPartida['dificultad'],
  algoritmoDeLaRonda: Algoritmo | null,
  rng: Rng,
): Generado | null {
  let conDos: Generado | null = null;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const esc = escenarioAleatorio(modo, dificultad, algoritmoDeLaRonda, rng);
    const variantes = variantesDe(esc);
    const canonicaFCFS = variantes.FCFS.variantes[0]!;
    if (cpuOciosa(canonicaFCFS) || duracionTotal(canonicaFCFS) > DURACION_MAX) continue;
    if (ALGORITMOS.some((a) => variantes[a]!.variantes.length > MAX_VARIANTES)) continue;

    const candidatas = construir(esc, variantes);
    const unaCorrecta = candidatas.filter((c) => c.correctas.length === 1);
    if (unaCorrecta.length) return { escenario: esc, candidata: elegir(rng, unaCorrecta) };

    const dosCorrectas = candidatas.filter((c) => c.correctas.length === 2);
    if (dosCorrectas.length && !conDos) conDos = { escenario: esc, candidata: elegir(rng, dosCorrectas) };

    if (intento >= FASE_UNICA && conDos) return conDos;
  }

  return conDos;
}

type Delta =
  | { tipo: 'A'; algoritmo: Algoritmo; tipoPregunta: 'CPU_EN_T' | 'MINUTO_FIN' }
  | { tipo: 'B'; objetivo: Algoritmo };

export interface InfoDepuracionRonda {
  numero: number;
  modo: Modo;
  algoritmo: Algoritmo | null;      // modo A
  tipoPregunta: TipoPregunta | null; // modo A
  objetivoBalance: Algoritmo | null; // modo B
}

/**
 * El tercer parámetro es un enganche opcional, solo para pruebas: expone qué
 * algoritmo o tipo de pregunta fue el "menos usado" elegido en cada ronda,
 * dato que no viaja en `Ronda` pero que 10.2 necesita para verificar el balance.
 *
 * `soloModoA` es la opción temporal de la Fase 2 (sección 11): mientras el
 * modo B no tiene sala ni cliente, fuerza que toda ronda después del
 * calentamiento sea de modo A.
 */
export function crearGenerador(
  config: ConfigPartida,
  semilla: number,
  opciones?: { depurar?: (info: InfoDepuracionRonda) => void; soloModoA?: boolean },
): {
  siguiente(): Ronda;
  saltar(): void;
} {
  const depurar = opciones?.depurar;
  const soloModoA = opciones?.soloModoA ?? false;
  const rng = crearRng(semilla);
  let numero = 0;
  let ultimoDelta: Delta | null = null;

  const contadorAlgA: Record<Algoritmo, number> = { FCFS: 0, SJF: 0, SRTF: 0, RR: 0 };
  const contadorTipoA: Record<'CPU_EN_T' | 'MINUTO_FIN', number> = { CPU_EN_T: 0, MINUTO_FIN: 0 };
  const contadorObjB: Record<Algoritmo, number> = { FCFS: 0, SJF: 0, SRTF: 0, RR: 0 };

  function construirRonda(
    modo: Modo,
    tipo: TipoPregunta,
    algoritmo: Algoritmo | null,
    escenario: Escenario,
    candidata: PreguntaCandidata,
  ): Ronda {
    return {
      id: `${semilla}-${numero}`,
      numero,
      modo,
      tipo,
      algoritmo,
      escenario,
      objetivo: candidata.objetivo,
      t: candidata.t,
      enunciado: candidata.enunciado,
      opciones: candidata.opciones,
      correctas: candidata.correctas,
      lineas: lineasDe(escenario),
      alternas: candidata.alternas,
      explicacion: candidata.explicacion,
      categoria: modo === 'B' ? 'COMPARACION' : algoritmo!,
    };
  }

  function generarModoA(): Ronda {
    const algoritmo = elegirMenosUsado(contadorAlgA, rng);
    const tipoPregunta = elegirMenosUsado(contadorTipoA, rng);
    const construir =
      tipoPregunta === 'CPU_EN_T'
        ? (esc: Escenario, v: ReturnType<typeof variantesDe>) => construirCpuEnT(esc, algoritmo, v)
        : (esc: Escenario, v: ReturnType<typeof variantesDe>) => construirMinutoFin(esc, algoritmo, v, rng);

    const resultado = intentarGenerar(construir, 'A', config.dificultad, algoritmo, rng);
    if (!resultado) throw new Error(`No se pudo generar una ronda de modo A para ${algoritmo}/${tipoPregunta}`);

    contadorAlgA[algoritmo]++;
    contadorTipoA[tipoPregunta]++;
    ultimoDelta = { tipo: 'A', algoritmo, tipoPregunta };
    depurar?.({ numero, modo: 'A', algoritmo, tipoPregunta, objetivoBalance: null });
    return construirRonda('A', tipoPregunta, algoritmo, resultado.escenario, resultado.candidata);
  }

  function generarModoB(): Ronda {
    let objetivoBalance = elegirMenosUsado(contadorObjB, rng);
    let resultado = intentarGenerar(
      (esc, v) => construirMejorAlgoritmo(esc, v, objetivoBalance),
      'B',
      config.dificultad,
      null,
      rng,
    );

    if (!resultado) {
      console.warn(
        `Scheduler Showdown: se agotaron los intentos para el objetivo de balance ${objetivoBalance}; se prueba con el siguiente algoritmo menos usado.`,
      );
      const restantes = ALGORITMOS.filter((a) => a !== objetivoBalance).sort(
        (a, b) => contadorObjB[a] - contadorObjB[b],
      );
      for (const alterno of restantes) {
        resultado = intentarGenerar(
          (esc, v) => construirMejorAlgoritmo(esc, v, alterno),
          'B',
          config.dificultad,
          null,
          rng,
        );
        if (resultado) {
          objetivoBalance = alterno;
          break;
        }
      }
    }

    if (!resultado) throw new Error('No se pudo generar una ronda de modo B');

    contadorObjB[objetivoBalance]++;
    ultimoDelta = { tipo: 'B', objetivo: objetivoBalance };
    depurar?.({ numero, modo: 'B', algoritmo: null, tipoPregunta: null, objetivoBalance });
    return construirRonda('B', 'MEJOR_ALGORITMO', null, resultado.escenario, resultado.candidata);
  }

  return {
    siguiente(): Ronda {
      numero++;

      if (numero === 1) {
        const variantes = variantesDe(ESCENARIO_CALENTAMIENTO);
        const candidata = construirCpuEnT(ESCENARIO_CALENTAMIENTO, 'FCFS', variantes).find((c) => c.t === 11)!;
        contadorAlgA.FCFS++;
        contadorTipoA.CPU_EN_T++;
        ultimoDelta = { tipo: 'A', algoritmo: 'FCFS', tipoPregunta: 'CPU_EN_T' };
        depurar?.({ numero, modo: 'A', algoritmo: 'FCFS', tipoPregunta: 'CPU_EN_T', objetivoBalance: null });
        return construirRonda('A', 'CPU_EN_T', 'FCFS', ESCENARIO_CALENTAMIENTO, candidata);
      }

      const esModoA = soloModoA || numero % 2 === 1;
      return esModoA ? generarModoA() : generarModoB();
    },

    saltar(): void {
      if (!ultimoDelta) return;
      if (ultimoDelta.tipo === 'A') {
        contadorAlgA[ultimoDelta.algoritmo]--;
        contadorTipoA[ultimoDelta.tipoPregunta]--;
      } else {
        contadorObjB[ultimoDelta.objetivo]--;
      }
      ultimoDelta = null;
    },
  };
}
