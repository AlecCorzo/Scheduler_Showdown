export interface InfoAlgoritmo {
  titulo: string;
  explicacion: string;
  ejemplo: string;
}

export const EXPLICACIONES: Record<'FCFS' | 'SJF' | 'SRTF' | 'RR' | 'PRIORIDAD', InfoAlgoritmo> = {
  FCFS: {
    titulo: 'FCFS — First Come, First Served',
    explicacion:
      'Los procesos se atienden en el mismo orden en que llegan. El primero en llegar es el primero en usar el ' +
      'CPU, y no se le interrumpe hasta que termina. Es el algoritmo más simple de todos, pero un proceso corto ' +
      'puede quedar esperando mucho tiempo detrás de uno largo (el llamado "efecto convoy").',
    ejemplo:
      'Si A llega en el minuto 0 con una ráfaga de 5, y B llega en el minuto 1 con una ráfaga de apenas 1, A ' +
      'corre primero (0 a 5) aunque B ya esté esperando y sea mucho más corto. B tiene que esperar hasta el ' +
      'minuto 5, aunque solo necesite 1 minuto de CPU.',
  },
  SJF: {
    titulo: 'SJF — Shortest Job First',
    explicacion:
      'Cuando el CPU queda libre, se elige al proceso con la ráfaga más corta entre los que ya están esperando. ' +
      'No interrumpe al que está corriendo. Minimiza el tiempo de espera promedio, pero necesita saber de ' +
      'antemano cuánto va a durar cada proceso, algo que en la vida real solo se puede estimar.',
    ejemplo:
      'Si A(llegada 0, ráfaga 5) es el único proceso en el sistema, corre de una vez del minuto 0 al 5, aunque ' +
      'después llegue B con una ráfaga más corta. Pero si A y B llegan juntos en el minuto 0, con B de ráfaga ' +
      'más corta, el planificador elige a B primero.',
  },
  SRTF: {
    titulo: 'SRTF — Shortest Remaining Time First',
    explicacion:
      'Es la versión apropiativa de SJF. Cada vez que llega un proceso nuevo, se compara su ráfaga con lo que le ' +
      'falta al que está corriendo en ese momento; si el nuevo es más corto, el que estaba en el CPU se ' +
      'interrumpe y vuelve a la fila.',
    ejemplo:
      'Si A(0, 5) está corriendo y en el minuto 1 llega B(1, 1), a A le faltan 4 minutos y B solo necesita 1, así ' +
      'que se interrumpe a A: B corre del minuto 1 al 2, y luego A retoma justo donde quedó, del minuto 2 al 6.',
  },
  RR: {
    titulo: 'Round Robin',
    explicacion:
      'Cada proceso recibe un turno fijo, el quantum. Si no termina en ese tiempo, se le quita el CPU y vuelve al ' +
      'final de la fila. Si termina antes, el CPU pasa al siguiente de inmediato. Es el algoritmo más justo, en ' +
      'el sentido de que nadie espera demasiado para empezar a correr, aunque no siempre el más rápido en ' +
      'promedio.',
    ejemplo:
      'Con quantum = 2: si A(0, 3) y B(1, 2), A corre del minuto 0 al 2 (se acaba su turno), luego le toca a B ' +
      'del 2 al 4 (termina, su ráfaga de 2 cabía completa), y A retoma del 4 al 5 para terminar su último minuto ' +
      'pendiente.',
  },
  PRIORIDAD: {
    titulo: 'Planificación por prioridad',
    explicacion:
      'A cada proceso se le asigna un número de prioridad (en este simulador, de 1 a 10, donde el número más ' +
      'alto es la prioridad más alta). Cuando el CPU queda libre, corre el proceso en espera con la prioridad ' +
      'más alta. No es apropiativo: una vez que un proceso empieza a correr, no se le interrumpe aunque llegue ' +
      'otro con más prioridad.',
    ejemplo:
      'Si A(llegada 0, ráfaga 4, prioridad 2) ya está corriendo cuando llega B(llegada 1, ráfaga 2, prioridad 8), ' +
      'A sigue hasta terminar en el minuto 4, y recién ahí entra B, aunque tenga mucha más prioridad — porque ' +
      'este algoritmo no interrumpe al que ya está usando el CPU.',
  },
};
