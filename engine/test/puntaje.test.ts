import { describe, it, expect } from 'vitest';
import { puntuar, ranking } from '../src/puntaje.js';

describe('puntuar', () => {
  it('acierto instantáneo: 1000 puntos, sin bono, racha 1', () => {
    expect(puntuar(true, 0, 30000, 0)).toEqual({ puntos: 1000, bono: 0, racha: 1 });
  });

  it('acierto a mitad de tiempo: 750 puntos', () => {
    expect(puntuar(true, 15000, 30000, 0)).toEqual({ puntos: 750, bono: 0, racha: 1 });
  });

  it('acierto al último segundo con racha previa de 2: 500 puntos y bono de 100', () => {
    expect(puntuar(true, 30000, 30000, 2)).toEqual({ puntos: 500, bono: 100, racha: 3 });
  });

  it('acierto pasado el tiempo (tMs > duraciónMs) se recorta a 500 puntos', () => {
    expect(puntuar(true, 45000, 30000, 0)).toEqual({ puntos: 500, bono: 0, racha: 1 });
  });

  it('fallo reinicia la racha y no da puntos', () => {
    expect(puntuar(false, 1000, 30000, 5)).toEqual({ puntos: 0, bono: 0, racha: 0 });
  });
});

describe('ranking', () => {
  it('empates comparten posición y se listan por nombre', () => {
    const filas = ranking([
      { nombre: 'Beto', puntos: 700 },
      { nombre: 'Ana', puntos: 900 },
      { nombre: 'Dani', puntos: 500 },
      { nombre: 'Caro', puntos: 700 },
    ]);
    expect(filas.map((f) => f.posicion)).toEqual([1, 2, 2, 4]);
    expect(filas.map((f) => f.puntos)).toEqual([900, 700, 700, 500]);
    expect(filas.map((f) => f.nombre)).toEqual(['Ana', 'Beto', 'Caro', 'Dani']);
  });
});
