import type { Proceso } from '@showdown/engine';

/**
 * Extiende el `Proceso` del motor con un campo de prioridad, solo para el
 * simulador. Se mantiene fuera de `@showdown/engine` a propósito: el motor
 * del kahoot asume exactamente 4 algoritmos en varios sitios (los 4 botones
 * de modo B, `ALGORITMOS`, etc.), así que agregar un 5to ahí tendría que
 * tocar esas asunciones. Aquí es un módulo aparte que solo lee tipos del
 * motor, sin modificar su contrato.
 */
export interface ProcesoConPrioridad extends Proceso {
  /** Mayor número = mayor prioridad (se ejecuta primero). */
  prioridad: number;
}
