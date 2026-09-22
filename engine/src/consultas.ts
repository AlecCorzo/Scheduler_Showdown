import { planificar, planificarVariantes } from './algoritmos.js';
import { ALGORITMOS, type Algoritmo, type Escenario, type Lineas, type Proceso, type ResultadoVariantes, type Segmento } from './tipos.js';

export function finalizaciones(segs: Segmento[]): Record<string, number> {
  const resultado: Record<string, number> = {};
  for (const s of segs) resultado[s.proceso] = s.fin;
  return resultado;
}

export function segmentoEn(segs: Segmento[], t: number): Segmento | null {
  for (const s of segs) if (t >= s.inicio && t < s.fin) return s;
  return null;
}

export function procesoEn(segs: Segmento[], t: number): string | null {
  const seg = segmentoEn(segs, t);
  return seg ? seg.proceso : null;
}

export function candidatosEn(escenario: Escenario, segs: Segmento[], s: number): (Proceso & { restante: number })[] {
  return escenario.procesos
    .filter((p) => p.llegada <= s)
    .map((p) => {
      const consumido = segs
        .filter((seg) => seg.proceso === p.nombre && seg.inicio < s)
        .reduce((acc, seg) => acc + (Math.min(seg.fin, s) - seg.inicio), 0);
      return { ...p, restante: p.rafaga - consumido };
    })
    .filter((p) => p.restante > 0);
}

export function cpuOciosa(segs: Segmento[]): boolean {
  const ordenado = [...segs].sort((a, b) => a.inicio - b.inicio);
  for (let i = 0; i < ordenado.length - 1; i++) {
    if (ordenado[i]!.fin < ordenado[i + 1]!.inicio) return true;
  }
  return false;
}

export function duracionTotal(segs: Segmento[]): number {
  return segs.reduce((max, s) => Math.max(max, s.fin), 0);
}

export function lineasDe(escenario: Escenario): Lineas {
  return {
    FCFS: planificar(escenario, 'FCFS'),
    SJF: planificar(escenario, 'SJF'),
    SRTF: planificar(escenario, 'SRTF'),
    RR: planificar(escenario, 'RR'),
  };
}

export function variantesDe(escenario: Escenario): Record<Algoritmo, ResultadoVariantes> {
  return {
    FCFS: planificarVariantes(escenario, 'FCFS'),
    SJF: planificarVariantes(escenario, 'SJF'),
    SRTF: planificarVariantes(escenario, 'SRTF'),
    RR: planificarVariantes(escenario, 'RR'),
  };
}

export function procesosEn(variantes: ResultadoVariantes, t: number): Set<string> {
  const resultado = new Set<string>();
  for (const v of variantes.variantes) {
    const nombre = procesoEn(v, t);
    if (nombre) resultado.add(nombre);
  }
  return resultado;
}

export function finalizacionesPosibles(variantes: ResultadoVariantes, x: string): Set<number> {
  const resultado = new Set<number>();
  for (const v of variantes.variantes) {
    const f = finalizaciones(v)[x];
    if (f !== undefined) resultado.add(f);
  }
  return resultado;
}

export function correctasModoB(variantesPorAlgoritmo: Record<Algoritmo, ResultadoVariantes>, x: string): Algoritmo[] {
  const posibles = {} as Record<Algoritmo, Set<number>>;
  for (const alg of ALGORITMOS) posibles[alg] = finalizacionesPosibles(variantesPorAlgoritmo[alg], x);

  const resultado: Algoritmo[] = [];
  for (const a of ALGORITMOS) {
    const minA = Math.min(...posibles[a]);
    let cumple = true;
    for (const b of ALGORITMOS) {
      if (b === a) continue;
      const maxB = Math.max(...posibles[b]);
      if (!(minA <= maxB)) {
        cumple = false;
        break;
      }
    }
    if (cumple) resultado.push(a);
  }
  return resultado;
}
