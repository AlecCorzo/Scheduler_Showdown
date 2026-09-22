import type { RegistroRespuesta } from './sala.js';

const ENCABEZADO = [
  'ronda',
  'modo',
  'tipo',
  'algoritmo',
  'objetivo',
  'jugador',
  'respuesta',
  'correctas',
  'acierto',
  'tiempo_ms',
  'puntos',
  'bono',
];

function escaparCampo(valor: string): string {
  if (/[;"\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

function filaCsv(campos: string[]): string {
  return campos.map(escaparCampo).join(';');
}

export function generarCsv(historial: RegistroRespuesta[]): string {
  const filas = historial.map((r) =>
    filaCsv([
      String(r.ronda),
      r.modo,
      r.tipo,
      r.algoritmo ?? '',
      r.objetivo ?? '',
      r.jugador,
      r.opcionTexto ?? '',
      r.correctasTexto.join(' / '),
      r.acierto ? 'true' : 'false',
      String(r.tMs),
      String(r.puntos),
      String(r.bono),
    ]),
  );

  const BOM = '﻿';
  return BOM + [filaCsv(ENCABEZADO), ...filas].join('\n');
}
