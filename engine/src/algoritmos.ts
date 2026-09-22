import type { Algoritmo, Escenario, ResultadoVariantes, Segmento } from './tipos.js';

function fusionar(segs: Segmento[]): Segmento[] {
  const resultado: Segmento[] = [];
  for (const s of segs) {
    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.proceso === s.proceso && ultimo.fin === s.inicio) {
      ultimo.fin = s.fin;
    } else {
      resultado.push({ ...s });
    }
  }
  return resultado;
}

function segsIguales(a: Segmento[], b: Segmento[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const sa = a[i]!;
    const sb = b[i]!;
    if (sa.proceso !== sb.proceso || sa.inicio !== sb.inicio || sa.fin !== sb.fin) return false;
  }
  return true;
}

function finalizarVariantes(leaves: Segmento[][], empates: Set<number>): ResultadoVariantes {
  const variantes: Segmento[][] = [];
  for (const leaf of leaves) {
    if (!variantes.some((v) => segsIguales(v, leaf))) variantes.push(leaf);
  }
  return { variantes, minutosEmpate: [...empates].sort((a, b) => a - b) };
}

function permutaciones<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const resultado: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const resto = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutaciones(resto)) resultado.push([arr[i]!, ...p]);
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// FCFS
// ---------------------------------------------------------------------------

function planificarFCFS(esc: Escenario): Segmento[] {
  let t = 0;
  const segs: Segmento[] = [];
  for (const p of esc.procesos) {
    t = Math.max(t, p.llegada);
    segs.push({ proceso: p.nombre, inicio: t, fin: t + p.rafaga });
    t += p.rafaga;
  }
  return fusionar(segs);
}

function variantesFCFS(esc: Escenario): ResultadoVariantes {
  const empates = new Set<number>();
  const leaves: Segmento[][] = [];
  const procesos = esc.procesos;

  function simular(pendientes: number[], t: number, segs: Segmento[]): void {
    if (!pendientes.length) {
      leaves.push(fusionar(segs));
      return;
    }
    const minLlegada = Math.min(...pendientes.map((i) => procesos[i]!.llegada));
    const candidatos = pendientes.filter((i) => procesos[i]!.llegada === minLlegada);
    if (candidatos.length > 1) empates.add(minLlegada);
    for (const i of candidatos) {
      const p = procesos[i]!;
      const inicio = Math.max(t, p.llegada);
      const resto = pendientes.filter((x) => x !== i);
      simular(resto, inicio + p.rafaga, [...segs, { proceso: p.nombre, inicio, fin: inicio + p.rafaga }]);
    }
  }

  simular(procesos.map((_, i) => i), 0, []);
  return finalizarVariantes(leaves, empates);
}

// ---------------------------------------------------------------------------
// SJF (no apropiativo)
// ---------------------------------------------------------------------------

function planificarSJF(esc: Escenario): Segmento[] {
  const procesos = esc.procesos;
  let pendientes = procesos.map((_, i) => i);
  let t = 0;
  const segs: Segmento[] = [];
  while (pendientes.length) {
    const listos = pendientes.filter((i) => procesos[i]!.llegada <= t);
    if (!listos.length) {
      t = Math.min(...pendientes.map((i) => procesos[i]!.llegada));
      continue;
    }
    listos.sort(
      (a, b) =>
        procesos[a]!.rafaga - procesos[b]!.rafaga ||
        procesos[a]!.llegada - procesos[b]!.llegada ||
        a - b,
    );
    const i = listos[0]!;
    const p = procesos[i]!;
    segs.push({ proceso: p.nombre, inicio: t, fin: t + p.rafaga });
    t += p.rafaga;
    pendientes = pendientes.filter((x) => x !== i);
  }
  return fusionar(segs);
}

function variantesSJF(esc: Escenario): ResultadoVariantes {
  const empates = new Set<number>();
  const leaves: Segmento[][] = [];
  const procesos = esc.procesos;

  function simular(pendientes: number[], t: number, segs: Segmento[]): void {
    if (!pendientes.length) {
      leaves.push(fusionar(segs));
      return;
    }
    const listos = pendientes.filter((i) => procesos[i]!.llegada <= t);
    if (!listos.length) {
      const proximo = Math.min(...pendientes.map((i) => procesos[i]!.llegada));
      simular(pendientes, proximo, segs);
      return;
    }
    const minRafaga = Math.min(...listos.map((i) => procesos[i]!.rafaga));
    const candidatos = listos
      .filter((i) => procesos[i]!.rafaga === minRafaga)
      .sort((a, b) => procesos[a]!.llegada - procesos[b]!.llegada || a - b);
    if (candidatos.length > 1) empates.add(t);
    for (const i of candidatos) {
      const p = procesos[i]!;
      const resto = pendientes.filter((x) => x !== i);
      simular(resto, t + p.rafaga, [...segs, { proceso: p.nombre, inicio: t, fin: t + p.rafaga }]);
    }
  }

  simular(procesos.map((_, i) => i), 0, []);
  return finalizarVariantes(leaves, empates);
}

// ---------------------------------------------------------------------------
// SRTF (apropiativo, minuto a minuto)
// ---------------------------------------------------------------------------

function planificarSRTF(esc: Escenario): Segmento[] {
  const procesos = esc.procesos;
  const restante = procesos.map((p) => p.rafaga);
  let t = 0;
  let actual: number | null = null;
  const segs: Segmento[] = [];
  while (restante.some((r) => r > 0)) {
    const listos = procesos
      .map((_, i) => i)
      .filter((i) => procesos[i]!.llegada <= t && restante[i]! > 0);
    if (!listos.length) {
      t = Math.min(...procesos.map((_, i) => i).filter((i) => restante[i]! > 0).map((i) => procesos[i]!.llegada));
      actual = null;
      continue;
    }
    listos.sort((a, b) => {
      if (restante[a]! !== restante[b]!) return restante[a]! - restante[b]!;
      const aActual = a === actual ? 0 : 1;
      const bActual = b === actual ? 0 : 1;
      if (aActual !== bActual) return aActual - bActual;
      if (procesos[a]!.llegada !== procesos[b]!.llegada) return procesos[a]!.llegada - procesos[b]!.llegada;
      return a - b;
    });
    const i = listos[0]!;
    segs.push({ proceso: procesos[i]!.nombre, inicio: t, fin: t + 1 });
    restante[i] = restante[i]! - 1;
    t += 1;
    actual = restante[i]! > 0 ? i : null;
  }
  return fusionar(segs);
}

function variantesSRTF(esc: Escenario): ResultadoVariantes {
  const empates = new Set<number>();
  const leaves: Segmento[][] = [];
  const procesos = esc.procesos;
  const n = procesos.length;

  function simular(restante: number[], t: number, actual: number | null, segs: Segmento[]): void {
    if (restante.every((r) => r === 0)) {
      leaves.push(fusionar(segs));
      return;
    }
    const listos: number[] = [];
    for (let i = 0; i < n; i++) if (procesos[i]!.llegada <= t && restante[i]! > 0) listos.push(i);
    if (!listos.length) {
      let proximo = Infinity;
      for (let i = 0; i < n; i++) if (restante[i]! > 0) proximo = Math.min(proximo, procesos[i]!.llegada);
      simular(restante, proximo, null, segs);
      return;
    }
    const minRestante = Math.min(...listos.map((i) => restante[i]!));
    const candidatos = listos
      .filter((i) => restante[i] === minRestante)
      .sort((a, b) => {
        const aActual = a === actual ? 0 : 1;
        const bActual = b === actual ? 0 : 1;
        if (aActual !== bActual) return aActual - bActual;
        if (procesos[a]!.llegada !== procesos[b]!.llegada) return procesos[a]!.llegada - procesos[b]!.llegada;
        return a - b;
      });
    if (candidatos.length > 1) empates.add(t);
    for (const i of candidatos) {
      const nuevoRestante = restante.slice();
      nuevoRestante[i] = nuevoRestante[i]! - 1;
      const seg: Segmento = { proceso: procesos[i]!.nombre, inicio: t, fin: t + 1 };
      simular(nuevoRestante, t + 1, nuevoRestante[i]! > 0 ? i : null, [...segs, seg]);
    }
  }

  simular(
    procesos.map((p) => p.rafaga),
    0,
    null,
    [],
  );
  return finalizarVariantes(leaves, empates);
}

// ---------------------------------------------------------------------------
// Round Robin
// ---------------------------------------------------------------------------

function planificarRR(esc: Escenario): Segmento[] {
  const procesos = esc.procesos;
  const n = procesos.length;
  const restante = procesos.map((p) => p.rafaga);
  let cola: number[] = [];
  let t = 0;
  let siguiente = 0;
  const admitir = (u: number) => {
    while (siguiente < n && procesos[siguiente]!.llegada <= u) {
      cola.push(siguiente);
      siguiente++;
    }
  };
  admitir(0);
  const segs: Segmento[] = [];
  while (restante.some((r) => r > 0)) {
    if (!cola.length) {
      t = procesos[siguiente]!.llegada;
      admitir(t);
      continue;
    }
    const idx = cola.shift()!;
    const corre = Math.min(esc.quantum, restante[idx]!);
    segs.push({ proceso: procesos[idx]!.nombre, inicio: t, fin: t + corre });
    t += corre;
    restante[idx] = restante[idx]! - corre;
    admitir(t);
    if (restante[idx]! > 0) cola.push(idx);
  }
  return fusionar(segs);
}

function variantesRR(esc: Escenario): ResultadoVariantes {
  const empates = new Set<number>();
  const leaves: Segmento[][] = [];
  const procesos = esc.procesos;
  const n = procesos.length;

  function simular(cola: number[], siguiente: number, restante: number[], t: number, segs: Segmento[]): void {
    if (restante.every((r) => r === 0)) {
      leaves.push(fusionar(segs));
      return;
    }
    if (!cola.length) {
      const u = procesos[siguiente]!.llegada;
      admitirYSeguir([], siguiente, restante, u, segs, null);
      return;
    }
    const idx = cola[0]!;
    const restoCola = cola.slice(1);
    const p = procesos[idx]!;
    const corre = Math.min(esc.quantum, restante[idx]!);
    const fin = t + corre;
    const nuevoRestante = restante.slice();
    nuevoRestante[idx] = nuevoRestante[idx]! - corre;
    const nuevosSegs = [...segs, { proceso: p.nombre, inicio: t, fin }];
    const vuelve = nuevoRestante[idx]! > 0 ? idx : null;
    admitirYSeguir(restoCola, siguiente, nuevoRestante, fin, nuevosSegs, vuelve);
  }

  function admitirYSeguir(
    colaBase: number[],
    siguienteIn: number,
    restante: number[],
    u: number,
    segs: Segmento[],
    vuelve: number | null,
  ): void {
    const llegan: number[] = [];
    let sig = siguienteIn;
    while (sig < n && procesos[sig]!.llegada <= u) {
      llegan.push(sig);
      sig++;
    }
    const tempranos = llegan.filter((i) => procesos[i]!.llegada < u);
    const mismoMinuto = llegan.filter((i) => procesos[i]!.llegada === u);
    const grupoTie = vuelve !== null ? [...mismoMinuto, vuelve] : mismoMinuto;
    const base = [...colaBase, ...tempranos];
    if (grupoTie.length <= 1) {
      simular([...base, ...grupoTie], sig, restante, u, segs);
      return;
    }
    empates.add(u);
    for (const orden of permutaciones(grupoTie)) {
      simular([...base, ...orden], sig, restante, u, segs);
    }
  }

  admitirYSeguir(
    [],
    0,
    procesos.map((p) => p.rafaga),
    0,
    [],
    null,
  );
  return finalizarVariantes(leaves, empates);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function planificar(escenario: Escenario, algoritmo: Algoritmo): Segmento[] {
  switch (algoritmo) {
    case 'FCFS':
      return planificarFCFS(escenario);
    case 'SJF':
      return planificarSJF(escenario);
    case 'SRTF':
      return planificarSRTF(escenario);
    case 'RR':
      return planificarRR(escenario);
  }
}

export function planificarVariantes(escenario: Escenario, algoritmo: Algoritmo): ResultadoVariantes {
  switch (algoritmo) {
    case 'FCFS':
      return variantesFCFS(escenario);
    case 'SJF':
      return variantesSJF(escenario);
    case 'SRTF':
      return variantesSRTF(escenario);
    case 'RR':
      return variantesRR(escenario);
  }
}
