import {
  correctasModoB,
  duracionTotal,
  finalizaciones,
  finalizacionesPosibles,
  procesoEn,
  procesosEn,
} from './consultas.js';
import { explicarCpuEnT, explicarMejorAlgoritmo, explicarMinutoFin } from './explicaciones.js';
import { entero, type Rng } from './rng.js';
import {
  ALGORITMOS,
  NOMBRE_ALGORITMO,
  type Algoritmo,
  type Escenario,
  type ResultadoVariantes,
  type Segmento,
} from './tipos.js';

export interface PreguntaCandidata {
  tipo: 'CPU_EN_T' | 'MINUTO_FIN' | 'MEJOR_ALGORITMO';
  algoritmo: Algoritmo | null;
  objetivo: string | null;
  t: number | null;
  enunciado: string;
  opciones: string[];
  correctas: number[];
  alternas: { algoritmo: Algoritmo; segmentos: Segmento[] }[];
  explicacion: string;
}

function sufijoQuantum(escenario: Escenario): string {
  return escenario.mostrarQuantum ? `, quantum = ${escenario.quantum}` : '';
}

// ---------------------------------------------------------------------------
// CPU_EN_T (modo A)
// ---------------------------------------------------------------------------

export function construirCpuEnT(
  escenario: Escenario,
  algoritmo: Algoritmo,
  variantesPorAlgoritmo: Record<Algoritmo, ResultadoVariantes>,
): PreguntaCandidata[] {
  const variantesAlg = variantesPorAlgoritmo[algoritmo]!;
  const canonica = variantesAlg.variantes[0]!;
  const duracion = duracionTotal(canonica);
  const p0 = new Set(escenario.procesos.filter((p) => p.llegada === 0).map((p) => p.nombre));
  const opciones = escenario.procesos.map((p) => p.nombre);
  const resultado: PreguntaCandidata[] = [];

  for (let t = 0; t < duracion; t++) {
    const c = procesosEn(variantesAlg, t);
    if (c.size < 1 || c.size > 2) continue;
    if (algoritmo !== 'FCFS') {
      const cFCFS = procesosEn(variantesPorAlgoritmo.FCFS!, t);
      if ([...c].some((nombre) => cFCFS.has(nombre))) continue;
    } else if ([...c].some((nombre) => p0.has(nombre))) {
      continue;
    }

    const correctas = opciones.map((nombre, i) => (c.has(nombre) ? i : -1)).filter((i) => i !== -1);
    const nombreCanonico = procesoEn(canonica, t)!;
    const correctasNombres =
      c.size === 1 ? [nombreCanonico] : [nombreCanonico, [...c].find((n) => n !== nombreCanonico)!];

    const alternas: { algoritmo: Algoritmo; segmentos: Segmento[] }[] = [];
    if (c.size > 1) {
      const otroNombre = correctasNombres[1]!;
      for (let i = 1; i < variantesAlg.variantes.length; i++) {
        const v = variantesAlg.variantes[i]!;
        if (procesoEn(v, t) === otroNombre) {
          alternas.push({ algoritmo, segmentos: v });
          break;
        }
      }
    }

    resultado.push({
      tipo: 'CPU_EN_T',
      algoritmo,
      objetivo: null,
      t,
      enunciado: `Con ${NOMBRE_ALGORITMO[algoritmo]}${sufijoQuantum(escenario)}, ¿qué proceso usa la CPU entre el minuto ${t} y el ${t + 1}?`,
      opciones,
      correctas,
      alternas,
      explicacion: explicarCpuEnT(escenario, algoritmo, variantesAlg, t, correctasNombres),
    });
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// MINUTO_FIN (modo A)
// ---------------------------------------------------------------------------

export function opcionesMinuto(
  correctas: number[],
  x: { nombre: string; llegada: number; rafaga: number },
  variantesPorAlgoritmo: Record<Algoritmo, ResultadoVariantes>,
  algoritmoDeLaRonda: Algoritmo,
  rng: Rng,
): { opciones: string[]; correctas: number[] } {
  const valores = [...correctas];

  const distractores = [...new Set(
    ALGORITMOS.filter((a) => a !== algoritmoDeLaRonda)
      .map((a) => finalizaciones(variantesPorAlgoritmo[a]!.variantes[0]!)[x.nombre])
      .filter((f): f is number => f !== undefined && !valores.includes(f)),
  )];

  while (valores.length < 4 && distractores.length) {
    const idx = Math.floor(rng() * distractores.length);
    valores.push(distractores[idx]!);
    distractores.splice(idx, 1);
  }

  const minimo = x.llegada + x.rafaga;
  let maximo = duracionTotal(variantesPorAlgoritmo[algoritmoDeLaRonda]!.variantes[0]!) + 2;
  while (valores.length < 4) {
    let intentos = 0;
    let candidato: number;
    do {
      candidato = entero(rng, minimo, maximo);
      intentos++;
      if (intentos > 1000) {
        maximo += 1;
        intentos = 0;
      }
    } while (valores.includes(candidato));
    valores.push(candidato);
  }

  valores.sort((a, b) => a - b);
  const opciones = valores.map(String);
  const correctasIdx = correctas.map((c) => valores.indexOf(c));
  return { opciones, correctas: correctasIdx };
}

export function construirMinutoFin(
  escenario: Escenario,
  algoritmo: Algoritmo,
  variantesPorAlgoritmo: Record<Algoritmo, ResultadoVariantes>,
  rng: Rng,
): PreguntaCandidata[] {
  const variantesAlg = variantesPorAlgoritmo[algoritmo]!;
  const canonica = variantesAlg.variantes[0]!;
  const p0 = new Set(escenario.procesos.filter((p) => p.llegada === 0).map((p) => p.nombre));
  const resultado: PreguntaCandidata[] = [];

  for (const proceso of escenario.procesos) {
    const x = proceso.nombre;
    const c = finalizacionesPosibles(variantesAlg, x);
    if (c.size < 1 || c.size > 2) continue;
    if (algoritmo !== 'FCFS') {
      const cFCFS = finalizacionesPosibles(variantesPorAlgoritmo.FCFS!, x);
      if ([...c].some((m) => cFCFS.has(m))) continue;
    } else if (p0.has(x)) {
      continue;
    }

    const minutoCanonico = finalizaciones(canonica)[x]!;
    const correctasMinutos = c.size === 1 ? [minutoCanonico] : [minutoCanonico, [...c].find((m) => m !== minutoCanonico)!];

    const alternas: { algoritmo: Algoritmo; segmentos: Segmento[] }[] = [];
    if (c.size > 1) {
      const otroMinuto = correctasMinutos[1]!;
      for (let i = 1; i < variantesAlg.variantes.length; i++) {
        const v = variantesAlg.variantes[i]!;
        if (finalizaciones(v)[x] === otroMinuto) {
          alternas.push({ algoritmo, segmentos: v });
          break;
        }
      }
    }

    const { opciones, correctas } = opcionesMinuto(correctasMinutos, proceso, variantesPorAlgoritmo, algoritmo, rng);

    resultado.push({
      tipo: 'MINUTO_FIN',
      algoritmo,
      objetivo: x,
      t: null,
      enunciado: `Con ${NOMBRE_ALGORITMO[algoritmo]}${sufijoQuantum(escenario)}, ¿en qué minuto termina ${x}?`,
      opciones,
      correctas,
      alternas,
      explicacion: explicarMinutoFin(algoritmo, variantesAlg, variantesPorAlgoritmo, x, correctasMinutos),
    });
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// MEJOR_ALGORITMO (modo B)
// ---------------------------------------------------------------------------

export function construirMejorAlgoritmo(
  escenario: Escenario,
  variantesPorAlgoritmo: Record<Algoritmo, ResultadoVariantes>,
  objetivoBalance: Algoritmo,
): PreguntaCandidata[] {
  const resultado: PreguntaCandidata[] = [];
  const opciones = ALGORITMOS.map((a) => NOMBRE_ALGORITMO[a]);

  for (const proceso of escenario.procesos) {
    const x = proceso.nombre;
    const c = correctasModoB(variantesPorAlgoritmo, x);
    if (c.length < 1 || c.length > 2) continue;
    if (!c.includes(objetivoBalance)) continue;

    const correctas = ALGORITMOS.map((a, i) => (c.includes(a) ? i : -1)).filter((i) => i !== -1);
    const correctasOrdenadas = ALGORITMOS.filter((a) => c.includes(a));

    const finCanonico = {} as Record<Algoritmo, number>;
    for (const a of ALGORITMOS) finCanonico[a] = finalizaciones(variantesPorAlgoritmo[a]!.variantes[0]!)[x]!;
    const ganadores = ALGORITMOS.filter((a) => ALGORITMOS.every((b) => b === a || finCanonico[a]! <= finCanonico[b]!));

    const alternas: { algoritmo: Algoritmo; segmentos: Segmento[] }[] = [];
    for (const a of correctasOrdenadas) {
      if (ganadores.includes(a)) continue;
      const minPosible = Math.min(...finalizacionesPosibles(variantesPorAlgoritmo[a]!, x));
      for (const v of variantesPorAlgoritmo[a]!.variantes) {
        if (finalizaciones(v)[x] === minPosible) {
          alternas.push({ algoritmo: a, segmentos: v });
          break;
        }
      }
    }

    resultado.push({
      tipo: 'MEJOR_ALGORITMO',
      algoritmo: null,
      objetivo: x,
      t: null,
      enunciado: `¿Con qué algoritmo termina antes ${x}? (quantum = ${escenario.quantum})`,
      opciones,
      correctas,
      alternas,
      explicacion: explicarMejorAlgoritmo(variantesPorAlgoritmo, x, correctasOrdenadas),
    });
  }

  return resultado;
}
