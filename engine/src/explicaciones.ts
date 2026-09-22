import { candidatosEn, finalizaciones, finalizacionesPosibles, segmentoEn } from './consultas.js';
import { ALGORITMOS, NOMBRE_ALGORITMO, type Algoritmo, type Escenario, type ResultadoVariantes } from './tipos.js';

function listar(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

function fraseHayEmpate(minutos: number[]): { texto: string; verbo: string } {
  if (minutos.length === 1) return { texto: `Hay un empate en el minuto ${minutos[0]}`, verbo: 'se resuelva' };
  return { texto: `Hay empates en los minutos ${listar(minutos.map(String))}`, verbo: 'se resuelvan' };
}

function fraseConEmpate(algoritmo: Algoritmo, minutos: number[]): { texto: string; verbo: string } {
  if (minutos.length === 1) {
    return { texto: `Con ${NOMBRE_ALGORITMO[algoritmo]} hay un empate en el minuto ${minutos[0]}`, verbo: 'se resuelva' };
  }
  return {
    texto: `Con ${NOMBRE_ALGORITMO[algoritmo]} hay empates en los minutos ${listar(minutos.map(String))}`,
    verbo: 'se resuelvan',
  };
}

/** correctas: nombres de proceso; si hay 2, el primero es el de la variante canónica. */
export function explicarCpuEnT(
  escenario: Escenario,
  algoritmo: Algoritmo,
  variantesAlg: ResultadoVariantes,
  t: number,
  correctas: string[],
): string {
  const canonica = variantesAlg.variantes[0]!;
  const seg = segmentoEn(canonica, t)!;
  const s = seg.inicio;
  let principal: string;

  if (algoritmo === 'RR') {
    principal = `En el minuto ${s} empieza un turno y ${seg.proceso} es el primero de la cola. Round Robin da turnos de ${escenario.quantum} min en orden de cola.`;
  } else {
    const candidatos = candidatosEn(escenario, canonica, s);
    if (algoritmo === 'FCFS') candidatos.sort((a, b) => a.llegada - b.llegada);
    else if (algoritmo === 'SJF') candidatos.sort((a, b) => a.rafaga - b.rafaga || a.llegada - b.llegada);
    else candidatos.sort((a, b) => a.restante - b.restante);

    if (candidatos.length === 1) {
      principal = `En el minuto ${s} ${candidatos[0]!.nombre} es el único proceso esperando.`;
    } else if (algoritmo === 'FCFS') {
      principal = `En el minuto ${s} la CPU queda libre y esperan ${listar(
        candidatos.map((c) => `${c.nombre} (llegó en el minuto ${c.llegada})`),
      )}. FCFS atiende en orden de llegada.`;
    } else if (algoritmo === 'SJF') {
      principal = `En el minuto ${s} la CPU queda libre y esperan ${listar(
        candidatos.map((c) => `${c.nombre} (ráfaga ${c.rafaga})`),
      )}. SJF elige la ráfaga más corta.`;
    } else {
      principal = `En el minuto ${s} compiten ${listar(
        candidatos.map((c) => `${c.nombre} (${c.restante} min restantes)`),
      )}. SRTF ejecuta al que le queda menos.`;
    }
  }

  if (correctas.length <= 1) return principal;
  const { texto, verbo } = fraseHayEmpate(variantesAlg.minutosEmpate);
  const [a, b] = correctas;
  return `${principal} ${texto}; según cómo ${verbo}, en el minuto ${t} usa la CPU ${a} o ${b}, y las dos respuestas cuentan como correctas.`;
}

/** correctas: minutos de finalización; si hay 2, el primero es el de la variante canónica. */
export function explicarMinutoFin(
  algoritmo: Algoritmo,
  variantesAlg: ResultadoVariantes,
  variantesPorAlgoritmo: Record<Algoritmo, ResultadoVariantes>,
  x: string,
  correctas: number[],
): string {
  const canonica = variantesAlg.variantes[0]!;
  const f = finalizaciones(canonica)[x]!;
  const otros = ALGORITMOS.filter((a) => a !== algoritmo);
  const listaOtros = listar(
    otros.map((a) => `${NOMBRE_ALGORITMO[a]} ${finalizaciones(variantesPorAlgoritmo[a]!.variantes[0]!)[x]}`),
  );
  const principal = `Con ${NOMBRE_ALGORITMO[algoritmo]}, ${x} termina en el minuto ${f}. Con los otros algoritmos terminaría en: ${listaOtros}.`;

  if (correctas.length <= 1) return principal;
  const { texto, verbo } = fraseHayEmpate(variantesAlg.minutosEmpate);
  const [f1, f2] = correctas;
  return `${principal} ${texto}; según cómo ${verbo}, ${x} termina en el minuto ${f1} o en el ${f2}, y las dos respuestas cuentan como correctas.`;
}

/** correctas: algoritmos correctos, en el orden fijo de ALGORITMOS. */
export function explicarMejorAlgoritmo(
  variantesPorAlgoritmo: Record<Algoritmo, ResultadoVariantes>,
  x: string,
  correctas: Algoritmo[],
): string {
  const finCanonico = {} as Record<Algoritmo, number>;
  for (const a of ALGORITMOS) finCanonico[a] = finalizaciones(variantesPorAlgoritmo[a]!.variantes[0]!)[x]!;

  const ganadores = ALGORITMOS.filter((a) => ALGORITMOS.every((b) => b === a || finCanonico[a]! <= finCanonico[b]!));
  const fin = finCanonico[ganadores[0]!]!;
  const demas = ALGORITMOS.filter((a) => !ganadores.includes(a));
  const listaDemas = listar(demas.map((a) => `${NOMBRE_ALGORITMO[a]} ${finCanonico[a]}`));

  const principal =
    ganadores.length === 1
      ? `${x} termina antes con ${NOMBRE_ALGORITMO[ganadores[0]!]}, en el minuto ${fin}. Con los demás: ${listaDemas}.`
      : `${x} termina antes con ${ganadores.map((a) => NOMBRE_ALGORITMO[a]).join(' y con ')}, los dos en el minuto ${fin}. Con los demás: ${listaDemas}.`;

  const conAlterna = correctas.filter((a) => !ganadores.includes(a));
  if (!conAlterna.length) return principal;

  const ordenCorrectas = ALGORITMOS.filter((a) => correctas.includes(a));
  const frasesEmpate = conAlterna.map((a) => {
    const { texto, verbo } = fraseConEmpate(a, variantesPorAlgoritmo[a]!.minutosEmpate);
    const finAlterno = Math.min(...finalizacionesPosibles(variantesPorAlgoritmo[a]!, x));
    return `${texto}; según cómo ${verbo}, ${x} también puede terminar en el minuto ${finAlterno}, así que ${listar(
      ordenCorrectas.map((al) => NOMBRE_ALGORITMO[al]),
    )} cuentan como correctas.`;
  });

  return `${principal} ${frasesEmpate.join(' ')}`;
}
