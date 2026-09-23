import type { Segmento } from '@showdown/engine';
import type { ProcesoConPrioridad } from './tipos.js';

/**
 * Planificación por prioridades, NO apropiativa: es el mismo patrón que
 * `planificarSJF` en engine/src/algoritmos.ts, pero ordena por prioridad en
 * vez de por ráfaga. Mayor número de prioridad = corre primero.
 *
 * Desempate: mayor prioridad > llegada más temprana > orden original en la
 * lista (mismo criterio que usa el resto del motor).
 *
 * Si más adelante quieren la variante apropiativa (un "SRTF pero por
 * prioridad", donde llega alguien con más prioridad y desaloja al que está
 * corriendo), es exactamente el mismo patrón minuto a minuto que
 * `planificarSRTF`, cambiando "restante" por "prioridad" en la comparación.
 * No lo agregué porque no se pidió y duplica bastante código; avisa si lo
 * quieres y lo armamos igual que el toggle de SJF/SRTF.
 */
export function planificarPrioridad(procesos: ProcesoConPrioridad[]): Segmento[] {
  let pendientes = procesos.map((_, i) => i);
  let t = 0;
  const segmentos: Segmento[] = [];

  while (pendientes.length > 0) {
    const listos = pendientes.filter((i) => procesos[i]!.llegada <= t);

    if (listos.length === 0) {
      t = Math.min(...pendientes.map((i) => procesos[i]!.llegada));
      continue;
    }

    listos.sort(
      (a, b) =>
        procesos[b]!.prioridad - procesos[a]!.prioridad ||
        procesos[a]!.llegada - procesos[b]!.llegada ||
        a - b,
    );

    const i = listos[0]!;
    const p = procesos[i]!;
    segmentos.push({ proceso: p.nombre, inicio: t, fin: t + p.rafaga });
    t += p.rafaga;
    pendientes = pendientes.filter((x) => x !== i);
  }

  return segmentos;
}
