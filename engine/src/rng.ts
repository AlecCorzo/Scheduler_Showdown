// mulberry32
export type Rng = () => number; // [0, 1)

export function crearRng(semilla: number): Rng {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const entero = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

export const elegir = <T>(rng: Rng, lista: readonly T[]): T =>
  lista[Math.floor(rng() * lista.length)]!;
