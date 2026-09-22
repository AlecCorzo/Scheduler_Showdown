import type { Algoritmo, Categoria, ConfigPartida, FilaRanking, RondaPublica, Segmento } from '@showdown/engine';

// Estos tipos reflejan el contrato del servidor (server/src/vistas.ts y handlers.ts).
// El cliente no importa el workspace del servidor, así que se declaran aquí.

export type Fase = 'LOBBY' | 'RONDA' | 'CERRADA' | 'REVELADO' | 'RANKING' | 'FIN';

export interface Revelado {
  correctas: number[];
  lineas: Partial<Record<Algoritmo, Segmento[]>>;
  alternas: { algoritmo: Algoritmo; segmentos: Segmento[] }[];
  explicacion: string;
  conteo: number[];
}

export interface Marcador {
  aciertos: number;
  total: number;
}

export interface ResumenFinal {
  clase: Record<Categoria, Marcador>;
  porJugador: Record<string, Record<Categoria, Marcador>>;
  matrizB: Record<string, Record<Algoritmo | 'SIN_RESPUESTA', number>>;
}

export interface EstadoHost {
  rol: 'host';
  codigo: string;
  fase: Fase;
  config: ConfigPartida;
  numeroRonda: number;
  jugadores: { nombre: string; conectado: boolean; puntos: number; respondio: boolean }[];
  ronda: RondaPublica | null;
  restanteMs: number | null;
  respondidos: number;
  revelado: Revelado | null;
  ranking: FilaRanking[] | null;
  resumen: ResumenFinal | null;
}

export interface EstadoJugador {
  rol: 'jugador';
  codigo: string;
  fase: Fase;
  numeroRonda: number;
  totalRondas: number;
  yo: { nombre: string; puntos: number; racha: number; posicion: number };
  ronda: RondaPublica | null;
  restanteMs: number | null;
  miRespuesta: number | null;
  resultado: { acierto: boolean; puntos: number; bono: number; correctas: number[] } | null;
  top5: FilaRanking[] | null;
  resumen: { categoria: Categoria; aciertos: number; total: number }[] | null;
}

export type Estado = EstadoHost | EstadoJugador;

export type CodigoError =
  | 'SALA_NO_EXISTE'
  | 'SALA_LLENA'
  | 'NOMBRE_INVALIDO'
  | 'NOMBRE_EN_USO'
  | 'TOKEN_INVALIDO'
  | 'NO_AUTORIZADO'
  | 'FASE_INCORRECTA'
  | 'SIN_JUGADORES'
  | 'RONDA_CERRADA'
  | 'YA_RESPONDIO'
  | 'OPCION_INVALIDA'
  | 'CONFIG_INVALIDA';

export type Ack<T = {}> = { ok: true; datos: T } | { ok: false; error: CodigoError };
