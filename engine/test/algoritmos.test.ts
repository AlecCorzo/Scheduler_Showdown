import { describe, it, expect } from 'vitest';
import { FIXTURES } from './fixtures.js';
import { planificar, planificarVariantes } from '../src/algoritmos.js';
import { candidatosEn, cpuOciosa, duracionTotal, finalizacionesPosibles, procesoEn, procesosEn } from '../src/consultas.js';
import { correctasModoB, variantesDe } from '../src/consultas.js';
import { crearRng, entero } from '../src/rng.js';
import { ALGORITMOS, type Algoritmo, type Escenario, type Segmento } from '../src/tipos.js';

function construirEscenario(nombreFixture: keyof typeof FIXTURES): Escenario {
  const fx = FIXTURES[nombreFixture]!;
  return {
    procesos: fx.procesos.map(([nombre, llegada, rafaga]) => ({ nombre, llegada, rafaga })),
    quantum: fx.quantum,
    mostrarQuantum: true,
  };
}

function comoSegmentos(tuplas: [string, number, number][]): Segmento[] {
  return tuplas.map(([proceso, inicio, fin]) => ({ proceso, inicio, fin }));
}

function segsIguales(a: Segmento[], b: Segmento[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.proceso === b[i]!.proceso && s.inicio === b[i]!.inicio && s.fin === b[i]!.fin);
}

function conjuntoDeVariantesIgual(a: Segmento[][], b: Segmento[][]): boolean {
  if (a.length !== b.length) return false;
  const restanteB = [...b];
  for (const va of a) {
    const idx = restanteB.findIndex((vb) => segsIguales(va, vb));
    if (idx === -1) return false;
    restanteB.splice(idx, 1);
  }
  return true;
}

describe('fixtures: planificar, planificarVariantes y correctasModoB', () => {
  for (const nombreFixture of Object.keys(FIXTURES) as (keyof typeof FIXTURES)[]) {
    const fx = FIXTURES[nombreFixture]!;
    const escenario = construirEscenario(nombreFixture);

    for (const alg of ALGORITMOS) {
      it(`${nombreFixture} / ${alg}: planificar devuelve la primera variante`, () => {
        const canonica = planificar(escenario, alg);
        const esperada = comoSegmentos(fx.variantes[alg][0]!);
        expect(segsIguales(canonica, esperada)).toBe(true);
      });

      it(`${nombreFixture} / ${alg}: planificarVariantes coincide en variantes y empates`, () => {
        const resultado = planificarVariantes(escenario, alg);
        const esperadas = fx.variantes[alg].map(comoSegmentos);
        expect(segsIguales(resultado.variantes[0]!, esperadas[0]!)).toBe(true);
        expect(conjuntoDeVariantesIgual(resultado.variantes, esperadas)).toBe(true);
        expect(resultado.minutosEmpate).toEqual(fx.empates[alg]);
      });
    }

    it(`${nombreFixture}: correctasModoB coincide con modoB`, () => {
      const variantes = variantesDe(escenario);
      for (const [objetivo, esperado] of Object.entries(fx.modoB)) {
        expect(correctasModoB(variantes, objetivo).sort()).toEqual([...esperado].sort());
      }
    });
  }
});

describe('consultas con el escenario ejemplo', () => {
  const escenario = construirEscenario('ejemplo');
  const canonicaSRTF = planificar(escenario, 'SRTF');

  it("procesoEn(canónica SRTF, 5) === 'Beto'", () => {
    expect(procesoEn(canonicaSRTF, 5)).toBe('Beto');
  });

  it('candidatosEn(ejemplo, canónica SRTF, 5) devuelve Beto(2), Dani(4) y Ana(5)', () => {
    const candidatos = candidatosEn(escenario, canonicaSRTF, 5);
    const porNombre = Object.fromEntries(candidatos.map((c) => [c.nombre, c.restante]));
    expect(porNombre).toEqual({ Beto: 2, Dani: 4, Ana: 5 });
  });

  it('procesosEn(variantes RR, 6) es {Ana, Beto, Caro}', () => {
    const variantesRR = planificarVariantes(escenario, 'RR');
    expect(procesosEn(variantesRR, 6)).toEqual(new Set(['Ana', 'Beto', 'Caro']));
  });

  it("finalizacionesPosibles(variantes SJF, 'Beto') es {12, 16}", () => {
    const variantesSJF = planificarVariantes(escenario, 'SJF');
    expect(finalizacionesPosibles(variantesSJF, 'Beto')).toEqual(new Set([12, 16]));
  });
});

// ---------------------------------------------------------------------------
// Invariantes sobre escenarios aleatorios
// ---------------------------------------------------------------------------

const NOMBRES = ['Ana', 'Beto', 'Caro', 'Dani'];

function escenarioAleatorioDePrueba(rng: () => number): Escenario {
  const n = entero(rng, 3, 4);
  const crudos = Array.from({ length: n }, () => ({
    llegada: entero(rng, 0, 6),
    rafaga: entero(rng, 1, 8),
  }));
  const minLlegada = Math.min(...crudos.map((c) => c.llegada));
  const desplazados = crudos.map((c) => ({ ...c, llegada: c.llegada - minLlegada }));
  const conIndice = desplazados.map((c, i) => ({ ...c, i }));
  conIndice.sort((a, b) => a.llegada - b.llegada || a.i - b.i);
  return {
    procesos: conIndice.map((c, idx) => ({ nombre: NOMBRES[idx]!, llegada: c.llegada, rafaga: c.rafaga })),
    quantum: entero(rng, 1, 4),
    mostrarQuantum: true,
  };
}

describe('invariantes del motor sobre 10.000 escenarios aleatorios', () => {
  it('cada variante respeta ráfaga, orden, llegada y fusión; sin huecos cuando cpuOciosa es falso', () => {
    const rng = crearRng(20260920);
    for (let iter = 0; iter < 10_000; iter++) {
      const escenario = escenarioAleatorioDePrueba(rng);
      const rafagaPorNombre = Object.fromEntries(escenario.procesos.map((p) => [p.nombre, p.rafaga]));
      const llegadaPorNombre = Object.fromEntries(escenario.procesos.map((p) => [p.nombre, p.llegada]));

      for (const alg of ALGORITMOS) {
        const { variantes } = planificarVariantes(escenario, alg);
        for (const segs of variantes) {
          const consumo: Record<string, number> = {};
          for (const s of segs) consumo[s.proceso] = (consumo[s.proceso] ?? 0) + (s.fin - s.inicio);
          for (const [nombre, rafaga] of Object.entries(rafagaPorNombre)) {
            expect(consumo[nombre] ?? 0).toBe(rafaga);
          }

          for (let i = 0; i < segs.length; i++) {
            expect(segs[i]!.inicio).toBeGreaterThanOrEqual(llegadaPorNombre[segs[i]!.proceso]!);
            if (i > 0) {
              expect(segs[i]!.inicio).toBeGreaterThanOrEqual(segs[i - 1]!.fin);
              const contiguos = segs[i]!.proceso === segs[i - 1]!.proceso && segs[i]!.inicio === segs[i - 1]!.fin;
              expect(contiguos).toBe(false);
            }
          }

          if (!cpuOciosa(segs)) {
            expect(segs[0]!.inicio).toBe(0);
            expect(segs[segs.length - 1]!.fin).toBe(duracionTotal(segs));
            for (let i = 1; i < segs.length; i++) expect(segs[i]!.inicio).toBe(segs[i - 1]!.fin);
          }
        }
      }
    }
  }, 60_000);

  it('un escenario sin empates tiene exactamente una variante por algoritmo', () => {
    const rng = crearRng(777);
    for (let iter = 0; iter < 10_000; iter++) {
      const escenario = escenarioAleatorioDePrueba(rng);
      for (const alg of ALGORITMOS) {
        const { variantes, minutosEmpate } = planificarVariantes(escenario, alg);
        if (minutosEmpate.length === 0) expect(variantes.length).toBe(1);
      }
    }
  }, 60_000);
});
