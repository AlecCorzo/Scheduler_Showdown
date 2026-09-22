export interface Puntuacion {
  puntos: number;
  bono: number;
  racha: number;
}

export function puntuar(acierto: boolean, tMs: number, duracionMs: number, rachaPrevia: number): Puntuacion {
  if (!acierto) return { puntos: 0, bono: 0, racha: 0 };
  const fraccion = Math.min(Math.max(tMs / duracionMs, 0), 1);
  const puntos = Math.round(1000 * (1 - 0.5 * fraccion)); // 1000 al instante, 500 al último segundo
  const racha = rachaPrevia + 1;
  const bono = racha >= 3 ? 100 : 0;
  return { puntos, bono, racha };
}

export interface FilaRanking {
  posicion: number;
  nombre: string;
  puntos: number;
}

export function ranking(jugadores: { nombre: string; puntos: number }[]): FilaRanking[] {
  const ordenados = [...jugadores].sort(
    (a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, 'es'),
  );
  const filas: FilaRanking[] = [];
  let posicion = 0;
  let anterior: number | null = null;
  for (let i = 0; i < ordenados.length; i++) {
    const j = ordenados[i]!;
    if (anterior === null || j.puntos !== anterior) posicion = i + 1;
    anterior = j.puntos;
    filas.push({ posicion, nombre: j.nombre, puntos: j.puntos });
  }
  return filas;
}
