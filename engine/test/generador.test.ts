import { describe, it, expect } from 'vitest';
import { FIXTURES } from './fixtures.js';
import { crearGenerador, type InfoDepuracionRonda } from '../src/generador.js';
import {
  correctasModoB,
  cpuOciosa,
  duracionTotal,
  finalizaciones,
  finalizacionesPosibles,
  procesosEn,
  variantesDe,
} from '../src/consultas.js';
import { construirCpuEnT, construirMejorAlgoritmo, construirMinutoFin } from '../src/preguntas.js';
import { crearRng } from '../src/rng.js';
import { ALGORITMOS, type Algoritmo, type ConfigPartida, type Escenario, type Ronda } from '../src/tipos.js';

const CONFIG: ConfigPartida = { rondas: 1000, tiempoA: 30, tiempoB: 60, revelarAutomatico: true, dificultad: 'normal' };

function generarSecuencia(semilla: number, n: number) {
  const rondas: Ronda[] = [];
  const infos: InfoDepuracionRonda[] = [];
  const gen = crearGenerador(CONFIG, semilla, { depurar: (info) => infos.push(info) });
  for (let i = 0; i < n; i++) rondas.push(gen.siguiente());
  return { rondas, infos };
}

function ganadoresCanonicos(variantes: ReturnType<typeof variantesDe>, x: string): Algoritmo[] {
  const fin = Object.fromEntries(ALGORITMOS.map((a) => [a, finalizaciones(variantes[a].variantes[0]!)[x]!])) as Record<
    Algoritmo,
    number
  >;
  return ALGORITMOS.filter((a) => ALGORITMOS.every((b) => b === a || fin[a]! <= fin[b]!));
}

describe('generador: 1.000 rondas con semilla 42', () => {
  const inicio = Date.now();
  const { rondas, infos } = generarSecuencia(42, 1000);
  const duracionMs = Date.now() - inicio;

  it('se generan en menos de 10 s', () => {
    expect(duracionMs).toBeLessThan(10_000);
  });

  it('la ronda 1 es el calentamiento fijo; impares modo A, pares modo B', () => {
    expect(rondas[0]!.modo).toBe('A');
    expect(rondas[0]!.algoritmo).toBe('FCFS');
    expect(rondas[0]!.tipo).toBe('CPU_EN_T');
    expect(rondas[0]!.t).toBe(11);
    expect(rondas[0]!.correctas).toEqual([2]); // Caro

    for (let i = 0; i < rondas.length; i++) {
      const numero = i + 1;
      expect(rondas[i]!.numero).toBe(numero);
      expect(rondas[i]!.modo).toBe(numero % 2 === 1 ? 'A' : 'B');
    }
  });

  it('toda ronda tiene 1 o 2 correctas, calculadas por el motor', () => {
    for (const r of rondas) {
      expect(r.correctas.length).toBeGreaterThanOrEqual(1);
      expect(r.correctas.length).toBeLessThanOrEqual(2);

      const variantes = variantesDe(r.escenario);
      let esperadas: number[];
      if (r.tipo === 'CPU_EN_T') {
        const c = procesosEn(variantes[r.algoritmo!]!, r.t!);
        esperadas = r.opciones.map((n, i) => (c.has(n) ? i : -1)).filter((i) => i !== -1);
      } else if (r.tipo === 'MINUTO_FIN') {
        const c = finalizacionesPosibles(variantes[r.algoritmo!]!, r.objetivo!);
        esperadas = r.opciones.map((n, i) => (c.has(Number(n)) ? i : -1)).filter((i) => i !== -1);
      } else {
        const c = correctasModoB(variantes, r.objetivo!);
        esperadas = ALGORITMOS.map((a, i) => (c.includes(a) ? i : -1)).filter((i) => i !== -1);
      }
      expect([...r.correctas].sort((a, b) => a - b)).toEqual(esperadas.sort((a, b) => a - b));
    }
  });

  it('modo B: correctasModoB del objetivo incluye al objetivo del balance', () => {
    for (const info of infos) {
      if (info.modo !== 'B') continue;
      const ronda = rondas[info.numero - 1]!;
      const variantes = variantesDe(ronda.escenario);
      const c = correctasModoB(variantes, ronda.objetivo!);
      expect(c).toContain(info.objetivoBalance);
    }
  });

  it('modo B: el objetivo de balance se reparte con diferencia máxima de 1', () => {
    const conteos: Record<Algoritmo, number> = { FCFS: 0, SJF: 0, SRTF: 0, RR: 0 };
    for (const info of infos) if (info.modo === 'B') conteos[info.objetivoBalance!]++;
    const valores = Object.values(conteos);
    expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
  });

  it('modo B: al menos 95% de las rondas con objetivo FCFS o SRTF tiene una sola respuesta correcta', () => {
    const relevantes = infos.filter((i) => i.modo === 'B' && (i.objetivoBalance === 'FCFS' || i.objetivoBalance === 'SRTF'));
    const conUna = relevantes.filter((i) => rondas[i.numero - 1]!.correctas.length === 1);
    expect(conUna.length / relevantes.length).toBeGreaterThanOrEqual(0.95);
  });

  it('modo A: MINUTO_FIN tiene 4 opciones distintas y ordenadas, todas >= llegada + ráfaga del objetivo', () => {
    for (const r of rondas) {
      if (r.tipo !== 'MINUTO_FIN') continue;
      const numeros = r.opciones.map(Number);
      expect(new Set(numeros).size).toBe(4);
      expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
      const proceso = r.escenario.procesos.find((p) => p.nombre === r.objetivo)!;
      const minimo = proceso.llegada + proceso.rafaga;
      for (const v of numeros) expect(v).toBeGreaterThanOrEqual(minimo);
    }
  });

  it('ninguna ronda tiene CPU ociosa, dura más de 20 min, ni un algoritmo con más de 8 variantes', () => {
    for (const r of rondas) {
      expect(cpuOciosa(r.lineas.FCFS)).toBe(false);
      expect(duracionTotal(r.lineas.FCFS)).toBeLessThanOrEqual(20);
      const variantes = variantesDe(r.escenario);
      for (const alg of ALGORITMOS) expect(variantes[alg]!.variantes.length).toBeLessThanOrEqual(8);
    }
  });

  it('si una ronda tiene dos correctas que no salen ambas de las canónicas, alternas no está vacío', () => {
    for (const r of rondas) {
      if (r.correctas.length !== 2) continue;
      if (r.modo === 'A') {
        expect(r.alternas.length).toBeGreaterThan(0);
      } else {
        const variantes = variantesDe(r.escenario);
        const ganadores = ganadoresCanonicos(variantes, r.objetivo!);
        const correctasAlgs = ALGORITMOS.filter((_, i) => r.correctas.includes(i));
        const ambasCanonicas = correctasAlgs.every((a) => ganadores.includes(a));
        if (!ambasCanonicas) expect(r.alternas.length).toBeGreaterThan(0);
      }
    }
  });

  it('dos generadores con la misma semilla producen exactamente la misma secuencia', () => {
    const otra = generarSecuencia(42, 1000).rondas;
    expect(otra).toEqual(rondas);
  });
});

// ---------------------------------------------------------------------------
// 7.7: las siete explicaciones de ejemplo, letra por letra
// ---------------------------------------------------------------------------

function construirEscenario(nombreFixture: keyof typeof FIXTURES): Escenario {
  const fx = FIXTURES[nombreFixture]!;
  return {
    procesos: fx.procesos.map(([nombre, llegada, rafaga]) => ({ nombre, llegada, rafaga })),
    quantum: fx.quantum,
    mostrarQuantum: true,
  };
}

describe('7.7: ejemplos textuales de explicaciones', () => {
  const ejemplo = construirEscenario('ejemplo');
  const variantesEjemplo = variantesDe(ejemplo);
  const rng = crearRng(1);

  it('FCFS, CPU_EN_T, t=11', () => {
    const c = construirCpuEnT(ejemplo, 'FCFS', variantesEjemplo).find((c) => c.t === 11)!;
    expect(c.explicacion).toBe(
      'En el minuto 11 la CPU queda libre y esperan Caro (llegó en el minuto 4) y Dani (llegó en el minuto 5). FCFS atiende en orden de llegada.',
    );
  });

  it('SJF, CPU_EN_T, t=7', () => {
    const c = construirCpuEnT(ejemplo, 'SJF', variantesEjemplo).find((c) => c.t === 7)!;
    expect(c.explicacion).toBe(
      'En el minuto 7 la CPU queda libre y esperan Caro (ráfaga 1), Beto (ráfaga 4) y Dani (ráfaga 4). SJF elige la ráfaga más corta.',
    );
  });

  it('SRTF, CPU_EN_T, t=5', () => {
    const c = construirCpuEnT(ejemplo, 'SRTF', variantesEjemplo).find((c) => c.t === 5)!;
    expect(c.explicacion).toBe(
      'En el minuto 5 compiten Beto (2 min restantes), Dani (4 min restantes) y Ana (5 min restantes). SRTF ejecuta al que le queda menos.',
    );
  });

  it('Round Robin, CPU_EN_T, t=9', () => {
    const c = construirCpuEnT(ejemplo, 'RR', variantesEjemplo).find((c) => c.t === 9)!;
    expect(c.explicacion).toBe(
      'En el minuto 9 empieza un turno y Dani es el primero de la cola. Round Robin da turnos de 2 min en orden de cola.',
    );
  });

  it('SJF, MINUTO_FIN, Beto', () => {
    const c = construirMinutoFin(ejemplo, 'SJF', variantesEjemplo, rng).find((c) => c.objetivo === 'Beto')!;
    expect(c.explicacion).toBe(
      'Con SJF, Beto termina en el minuto 12. Con los otros algoritmos terminaría en: FCFS 11, SRTF 7 y Round Robin 9. Hay un empate en el minuto 8; según cómo se resuelva, Beto termina en el minuto 12 o en el 16, y las dos respuestas cuentan como correctas.',
    );
  });

  it('MEJOR_ALGORITMO, escenario sjfConFCFS, Beto', () => {
    const esc = construirEscenario('sjfConFCFS');
    const variantes = variantesDe(esc);
    const c = construirMejorAlgoritmo(esc, variantes, 'FCFS').find((c) => c.objetivo === 'Beto')!;
    expect(c.explicacion).toBe(
      'Beto termina antes con SJF, en el minuto 3. Con los demás: FCFS 7, SRTF 4 y Round Robin 8. Con FCFS hay un empate en el minuto 0; según cómo se resuelva, Beto también puede terminar en el minuto 3, así que FCFS y SJF cuentan como correctas.',
    );
  });

  it('MEJOR_ALGORITMO, escenario ejemplo, Ana', () => {
    const c = construirMejorAlgoritmo(ejemplo, variantesEjemplo, 'FCFS').find((c) => c.objetivo === 'Ana')!;
    expect(c.explicacion).toBe(
      'Ana termina antes con FCFS y con SJF, los dos en el minuto 7. Con los demás: SRTF 16 y Round Robin 16.',
    );
  });
});
