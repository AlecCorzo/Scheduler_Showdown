import { ALGORITMOS } from '@showdown/engine';
import type { Algoritmo, Categoria, ConfigPartida, Ronda, RondaPublica, Segmento } from '@showdown/engine';
import type { RegistroRespuesta, Sala } from './sala.js';

const CATEGORIAS: Categoria[] = [...ALGORITMOS, 'COMPARACION'];

export type Fase = 'LOBBY' | 'RONDA' | 'CERRADA' | 'REVELADO' | 'RANKING' | 'FIN';

export interface FilaRanking {
  posicion: number;
  nombre: string;
  puntos: number;
}

export interface Marcador {
  aciertos: number;
  total: number;
}

export interface Revelado {
  correctas: number[]; // 1 o 2
  lineas: Partial<Record<Algoritmo, Segmento[]>>; // canónicas. Modo A: solo el algoritmo de la ronda; modo B: los cuatro
  alternas: { algoritmo: Algoritmo; segmentos: Segmento[] }[]; // "Con el otro desempate"
  explicacion: string;
  conteo: number[]; // cuántos eligieron cada opción
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
  numeroRonda: number; // 0 en LOBBY
  jugadores: { nombre: string; conectado: boolean; puntos: number; respondio: boolean }[];
  ronda: RondaPublica | null;
  restanteMs: number | null; // solo en RONDA
  respondidos: number;
  revelado: Revelado | null; // desde REVELADO
  ranking: FilaRanking[] | null; // RANKING y FIN: completo
  resumen: ResumenFinal | null; // solo FIN
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
  resultado: { acierto: boolean; puntos: number; bono: number; correctas: number[] } | null; // desde REVELADO
  top5: FilaRanking[] | null; // RANKING y FIN
  resumen: { categoria: Categoria; aciertos: number; total: number }[] | null; // solo FIN
}

function marcadorVacio(): Record<Categoria, Marcador> {
  return Object.fromEntries(CATEGORIAS.map((c) => [c, { aciertos: 0, total: 0 }])) as Record<Categoria, Marcador>;
}

export function construirResumen(historial: RegistroRespuesta[]): ResumenFinal {
  const clase = marcadorVacio();
  const porJugador: Record<string, Record<Categoria, Marcador>> = {};
  const matrizB: Record<string, Record<Algoritmo | 'SIN_RESPUESTA', number>> = {};

  for (const r of historial) {
    clase[r.categoria].total++;
    if (r.acierto) clase[r.categoria].aciertos++;

    const marcadorJugador = (porJugador[r.jugador] ??= marcadorVacio());
    marcadorJugador[r.categoria].total++;
    if (r.acierto) marcadorJugador[r.categoria].aciertos++;

    if (r.modo === 'B') {
      const fila = r.correctasAlgoritmos.join(' / ');
      const filaMatriz = (matrizB[fila] ??= Object.fromEntries(
        [...ALGORITMOS, 'SIN_RESPUESTA' as const].map((a) => [a, 0]),
      ) as Record<Algoritmo | 'SIN_RESPUESTA', number>);
      const columna = r.opcionAlgoritmo ?? 'SIN_RESPUESTA';
      filaMatriz[columna]++;
    }
  }

  return { clase, porJugador, matrizB };
}

export function construirRondaPublica(ronda: Ronda): RondaPublica {
  const { correctas: _correctas, lineas: _lineas, alternas: _alternas, explicacion: _explicacion, ...resto } = ronda;
  return resto;
}

export function vistaHost(sala: Sala): EstadoHost {
  return {
    rol: 'host',
    codigo: sala.codigo,
    fase: sala.fase,
    config: sala.config,
    numeroRonda: sala.numeroRonda,
    jugadores: [...sala.jugadores.values()].map((j) => ({
      nombre: j.nombre,
      conectado: j.conectado,
      puntos: j.puntos,
      respondio: j.respuesta !== null,
    })),
    ronda: sala.rondaActual ? construirRondaPublica(sala.rondaActual) : null,
    restanteMs: sala.restanteMs,
    respondidos: [...sala.jugadores.values()].filter((j) => j.respuesta !== null).length,
    revelado: sala.fase === 'REVELADO' || sala.fase === 'RANKING' || sala.fase === 'FIN' ? sala.revelado : null,
    ranking: sala.fase === 'RANKING' || sala.fase === 'FIN' ? sala.rankingActual : null,
    resumen: sala.fase === 'FIN' ? sala.resumenFinal : null,
  };
}

export function vistaJugador(sala: Sala, token: string): EstadoJugador {
  const jugador = sala.jugadores.get(token)!;
  const enRevelado = sala.fase === 'REVELADO' || sala.fase === 'RANKING' || sala.fase === 'FIN';
  const posicion = sala.rankingActual?.find((f) => f.nombre === jugador.nombre)?.posicion ?? 0;

  return {
    rol: 'jugador',
    codigo: sala.codigo,
    fase: sala.fase,
    numeroRonda: sala.numeroRonda,
    totalRondas: sala.config.rondas,
    yo: { nombre: jugador.nombre, puntos: jugador.puntos, racha: jugador.racha, posicion },
    ronda: sala.rondaActual ? construirRondaPublica(sala.rondaActual) : null,
    restanteMs: sala.restanteMs,
    miRespuesta: jugador.respuesta?.opcion ?? null,
    resultado:
      enRevelado && sala.revelado
        ? {
            acierto: jugador.respuesta?.acierto ?? false,
            puntos: jugador.respuesta?.puntos ?? 0,
            bono: jugador.respuesta?.bono ?? 0,
            correctas: sala.revelado.correctas,
          }
        : null,
    top5: sala.rankingActual ? sala.rankingActual.slice(0, 5) : null,
    resumen:
      sala.fase === 'FIN' && sala.resumenFinal
        ? (Object.entries(sala.resumenFinal.porJugador[jugador.nombre] ?? marcadorVacio()) as [Categoria, Marcador][]).map(
            ([categoria, m]) => ({ categoria, aciertos: m.aciertos, total: m.total }),
          )
        : null,
  };
}
