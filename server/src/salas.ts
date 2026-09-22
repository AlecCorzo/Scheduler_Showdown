import type { ConfigPartida } from '@showdown/engine';
import { Sala } from './sala.js';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0 ni 1
export const MAX_JUGADORES = 60;

const registro = new Map<string, Sala>();

function generarCodigo(): string {
  let codigo: string;
  do {
    codigo = Array.from({ length: 5 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join('');
  } while (registro.has(codigo));
  return codigo;
}

export function crearSala(config: ConfigPartida): Sala {
  const sala = new Sala(generarCodigo(), config);
  registro.set(sala.codigo, sala);
  return sala;
}

export function obtenerSala(codigo: string): Sala | undefined {
  return registro.get(codigo);
}

export function eliminarSala(codigo: string): boolean {
  return registro.delete(codigo);
}

export function contarSalas(): number {
  return registro.size;
}

const DIEZ_MINUTOS = 10 * 60 * 1000;
const TREINTA_MINUTOS = 30 * 60 * 1000;
const DOS_HORAS = 2 * 60 * 60 * 1000;

export function iniciarLimpiezaPeriodica(): ReturnType<typeof setInterval> {
  const intervalo = setInterval(() => {
    const ahora = Date.now();
    for (const [codigo, sala] of registro) {
      const finHaceRato = sala.fase === 'FIN' && sala.finEnMs !== null && ahora - sala.finEnMs > TREINTA_MINUTOS;
      const inactiva = ahora - sala.ultimaActividadMs > DOS_HORAS;
      if (finHaceRato || inactiva) registro.delete(codigo);
    }
  }, DIEZ_MINUTOS);
  intervalo.unref?.();
  return intervalo;
}
