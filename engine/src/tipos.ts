export type Algoritmo = 'FCFS' | 'SJF' | 'SRTF' | 'RR';
/** También es el orden fijo de los botones del modo B. */
export const ALGORITMOS: readonly Algoritmo[] = ['FCFS', 'SJF', 'SRTF', 'RR'];
export const NOMBRE_ALGORITMO: Record<Algoritmo, string> = {
  FCFS: 'FCFS', SJF: 'SJF', SRTF: 'SRTF', RR: 'Round Robin',
};

export interface Proceso {
  nombre: string;   // 'Ana' | 'Beto' | 'Caro' | 'Dani'
  llegada: number;  // entero >= 0
  rafaga: number;   // entero >= 1
}

export interface Escenario {
  /** Ordenados por llegada; ese orden es "el orden de la tabla" y define la variante canónica. */
  procesos: Proceso[];
  quantum: number;          // siempre existe; solo se muestra si mostrarQuantum
  mostrarQuantum: boolean;  // true en modo A con RR y en todo el modo B
}

export interface Segmento { proceso: string; inicio: number; fin: number }
export type Lineas = Record<Algoritmo, Segmento[]>;

/** Resultado de ramificar la simulación en cada empate (sección 6.2). */
export interface ResultadoVariantes {
  variantes: Segmento[][];   // todas las líneas de tiempo distintas; la primera es la canónica
  minutosEmpate: number[];   // minutos en que hubo que resolver un empate, en cualquier rama
}

export type Modo = 'A' | 'B';
export type TipoPregunta = 'CPU_EN_T' | 'MINUTO_FIN' | 'MEJOR_ALGORITMO';
export type Categoria = Algoritmo | 'COMPARACION';

/** Ronda completa. Solo existe en el servidor. */
export interface Ronda {
  id: string;                  // `${semilla}-${numero}`, único dentro de la sala
  numero: number;              // 1..config.rondas
  modo: Modo;
  tipo: TipoPregunta;
  algoritmo: Algoritmo | null; // null en modo B
  escenario: Escenario;
  objetivo: string | null;     // proceso remarcado (MINUTO_FIN y MEJOR_ALGORITMO)
  t: number | null;            // solo CPU_EN_T
  enunciado: string;
  opciones: string[];          // 3 o 4
  correctas: number[];         // índices en opciones: 1 o 2 (sección 6.2)
  lineas: Lineas;              // variante canónica de cada algoritmo
  /** Variantes no canónicas que justifican otra respuesta correcta (0 a 2). */
  alternas: { algoritmo: Algoritmo; segmentos: Segmento[] }[];
  explicacion: string;
  categoria: Categoria;        // algoritmo en modo A, 'COMPARACION' en modo B
}

/** Lo único que viaja a los clientes mientras la ronda está abierta. */
export type RondaPublica = Omit<Ronda, 'correctas' | 'lineas' | 'alternas' | 'explicacion'>;

export interface ConfigPartida {
  rondas: number;                  // 4 a 20; por defecto 10
  tiempoA: number;                 // segundos, 15 a 90; por defecto 30
  tiempoB: number;                 // segundos, 15 a 90; por defecto 60
  revelarAutomatico: boolean;      // por defecto true
  dificultad: 'normal' | 'facil';  // ráfagas de 1 a 8 o de 1 a 5
}
