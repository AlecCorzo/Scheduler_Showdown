import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as ioClient, type Socket as ClienteSocket } from 'socket.io-client';
import type { ConfigPartida } from '@showdown/engine';
import { registrarHandlers } from '../src/handlers.js';
import type { Ack } from '../src/handlers.js';

const CONFIG: ConfigPartida = { rondas: 4, tiempoA: 15, tiempoB: 15, revelarAutomatico: true, dificultad: 'normal' };

let httpServer: ReturnType<typeof createServer>;
let io: Server;
let url: string;
const socketsAbiertos: ClienteSocket[] = [];

beforeAll(async () => {
  httpServer = createServer();
  io = new Server(httpServer);
  registrarHandlers(io);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  io.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

afterEach(() => {
  for (const s of socketsAbiertos.splice(0)) s.disconnect();
});

function conectar(): ClienteSocket {
  const socket = ioClient(url, { transports: ['websocket'], forceNew: true });
  socketsAbiertos.push(socket);
  return socket;
}

function emitir<T = {}>(socket: ClienteSocket, evento: string, datos: unknown): Promise<Ack<T>> {
  return new Promise((resolve) => socket.emit(evento, datos, resolve));
}

class Rastreador {
  actual: any = null;
  private listeners: ((e: any) => void)[] = [];

  constructor(socket: ClienteSocket) {
    socket.on('sala:estado', (e: any) => {
      this.actual = e;
      for (const l of this.listeners) l(e);
    });
  }

  esperar(predicado: (e: any) => boolean, timeoutMs = 3000): Promise<any> {
    if (this.actual && predicado(this.actual)) return Promise.resolve(this.actual);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout esperando estado')), timeoutMs);
      const l = (e: any) => {
        if (predicado(e)) {
          clearTimeout(timer);
          this.listeners = this.listeners.filter((x) => x !== l);
          resolve(e);
        }
      };
      this.listeners.push(l);
    });
  }
}

async function crearPartida(nombres: string[], config: ConfigPartida = CONFIG) {
  const host = conectar();
  const rHost = new Rastreador(host);
  const ackCrear = await emitir<{ codigo: string; tokenHost: string }>(host, 'host:crear', config);
  if (!ackCrear.ok) throw new Error('no se pudo crear la sala');
  const { codigo } = ackCrear.datos;

  const jugadores: { socket: ClienteSocket; r: Rastreador; nombre: string; token: string }[] = [];
  for (const nombre of nombres) {
    const socket = conectar();
    const r = new Rastreador(socket);
    const ack = await emitir<{ token: string }>(socket, 'jugador:unirse', { codigo, nombre });
    if (!ack.ok) throw new Error(`no se pudo unir ${nombre}: ${ack.error}`);
    jugadores.push({ socket, r, nombre, token: ack.datos.token });
  }

  return { host, rHost, codigo, jugadores };
}

describe('partida: flujo de sala en modo A (Fase 2)', () => {
  it('host crea, dos jugadores se unen y al iniciar ambos ven RONDA sin datos de la respuesta', async () => {
    const { host, rHost, jugadores } = await crearPartida(['Ana', 'Beto']);
    const ackIniciar = await emitir(host, 'host:iniciar', {});
    expect(ackIniciar.ok).toBe(true);

    const estadoHost = await rHost.esperar((e) => e.fase === 'RONDA');
    const estados = await Promise.all(jugadores.map((j) => j.r.esperar((e) => e.fase === 'RONDA')));

    for (const estado of [estadoHost, ...estados]) {
      expect(estado.ronda).not.toBeNull();
      expect(estado.ronda.correctas).toBeUndefined();
      expect(estado.ronda.lineas).toBeUndefined();
      expect(estado.ronda.alternas).toBeUndefined();
      expect(estado.ronda.explicacion).toBeUndefined();
    }
  });

  it('ambos responden, la ronda se cierra sola y quien acertó suma puntos', async () => {
    const { host, rHost, jugadores } = await crearPartida(['Ana', 'Beto']);
    await emitir(host, 'host:iniciar', {});
    const estado1 = await jugadores[0]!.r.esperar((e) => e.fase === 'RONDA');
    const rondaId = estado1.ronda.id;

    const ack1 = await emitir(jugadores[0]!.socket, 'jugador:responder', { rondaId, opcion: 0 });
    const ack2 = await emitir(jugadores[1]!.socket, 'jugador:responder', { rondaId, opcion: 1 });
    expect(ack1.ok).toBe(true);
    expect(ack2.ok).toBe(true);

    const estHost = await rHost.esperar((e) => e.fase === 'REVELADO');
    expect(estHost.revelado).not.toBeNull();
    expect(estHost.revelado.correctas.length).toBeGreaterThanOrEqual(1);

    const opciones = [0, 1];
    for (let i = 0; i < jugadores.length; i++) {
      const estado = await jugadores[i]!.r.esperar((e) => e.fase === 'REVELADO');
      expect(estado.resultado).not.toBeNull();
      const debeAcertar = estado.resultado.correctas.includes(opciones[i]);
      expect(estado.resultado.acierto).toBe(debeAcertar);
      expect(estado.yo.puntos).toBe(debeAcertar ? estado.resultado.puntos + estado.resultado.bono : 0);
    }
  });

  it('segunda respuesta del mismo jugador da YA_RESPONDIO; responder a una ronda vieja da RONDA_CERRADA', async () => {
    const { host, jugadores } = await crearPartida(['Ana', 'Beto', 'Caro']);
    await emitir(host, 'host:iniciar', {});
    const estado1 = await jugadores[0]!.r.esperar((e) => e.fase === 'RONDA');
    const rondaId = estado1.ronda.id;

    const ackOk = await emitir(jugadores[0]!.socket, 'jugador:responder', { rondaId, opcion: 0 });
    expect(ackOk.ok).toBe(true);

    const ackRepetida = await emitir(jugadores[0]!.socket, 'jugador:responder', { rondaId, opcion: 0 });
    expect(ackRepetida).toEqual({ ok: false, error: 'YA_RESPONDIO' });

    // Caro nunca responde; el host salta la ronda para forzar que quede vieja.
    const ackSaltar = await emitir(host, 'host:saltar', {});
    expect(ackSaltar.ok).toBe(true);

    const ackTardia = await emitir(jugadores[2]!.socket, 'jugador:responder', { rondaId, opcion: 0 });
    expect(ackTardia).toEqual({ ok: false, error: 'RONDA_CERRADA' });
  });

  it('un socket que no es el host recibe NO_AUTORIZADO al enviar un evento host:*', async () => {
    const intruso = conectar();
    const ack = await emitir(intruso, 'host:siguiente', {});
    expect(ack).toEqual({ ok: false, error: 'NO_AUTORIZADO' });
  });

  it('nombre repetido con otras mayúsculas da NOMBRE_EN_USO', async () => {
    const host = conectar();
    const ackCrear = await emitir<{ codigo: string }>(host, 'host:crear', CONFIG);
    if (!ackCrear.ok) throw new Error('no se pudo crear la sala');
    const { codigo } = ackCrear.datos;

    const j1 = conectar();
    const ack1 = await emitir(j1, 'jugador:unirse', { codigo, nombre: 'Ana' });
    expect(ack1.ok).toBe(true);

    const j2 = conectar();
    const ack2 = await emitir(j2, 'jugador:unirse', { codigo, nombre: 'ANA' });
    expect(ack2).toEqual({ ok: false, error: 'NOMBRE_EN_USO' });
  });

  it('host:saltar no suma puntos ni reinicia rachas', async () => {
    const { host, rHost, jugadores } = await crearPartida(['Ana', 'Beto']);
    await emitir(host, 'host:iniciar', {});

    // Ronda 1: ambos responden normalmente.
    const estado1 = await jugadores[0]!.r.esperar((e) => e.fase === 'RONDA');
    await emitir(jugadores[0]!.socket, 'jugador:responder', { rondaId: estado1.ronda.id, opcion: 0 });
    await emitir(jugadores[1]!.socket, 'jugador:responder', { rondaId: estado1.ronda.id, opcion: 1 });
    await rHost.esperar((e) => e.fase === 'REVELADO');

    const antes0 = await jugadores[0]!.r.esperar((e) => e.fase === 'REVELADO');
    const antes1 = await jugadores[1]!.r.esperar((e) => e.fase === 'REVELADO');
    const puntosAntes = [antes0.yo.puntos, antes1.yo.puntos];
    const rachaAntes = [antes0.yo.racha, antes1.yo.racha];

    // Avanza a la ronda 2 y la salta sin que nadie responda.
    await emitir(host, 'host:siguiente', {}); // REVELADO -> RANKING
    await rHost.esperar((e) => e.fase === 'RANKING');
    await emitir(host, 'host:siguiente', {}); // RANKING -> RONDA 2
    await rHost.esperar((e) => e.fase === 'RONDA' && e.numeroRonda === 2);
    await emitir(host, 'host:saltar', {});

    const despues0 = await jugadores[0]!.r.esperar((e) => e.numeroRonda === 3);
    const despues1 = await jugadores[1]!.r.esperar((e) => e.numeroRonda === 3);

    expect(despues0.yo.puntos).toBe(puntosAntes[0]);
    expect(despues1.yo.puntos).toBe(puntosAntes[1]);
    expect(despues0.yo.racha).toBe(rachaAntes[0]);
    expect(despues1.yo.racha).toBe(rachaAntes[1]);
  });

  it('una partida completa de rondas llega a FIN', async () => {
    const { host, rHost, jugadores } = await crearPartida(['Ana', 'Beto']);
    await emitir(host, 'host:iniciar', {});

    for (let numero = 1; numero <= CONFIG.rondas; numero++) {
      const estado1 = await jugadores[0]!.r.esperar((e) => e.fase === 'RONDA' && e.numeroRonda === numero);
      const rondaId = estado1.ronda.id;
      await emitir(jugadores[0]!.socket, 'jugador:responder', { rondaId, opcion: 0 });
      await emitir(jugadores[1]!.socket, 'jugador:responder', { rondaId, opcion: 1 });
      await rHost.esperar((e) => e.fase === 'REVELADO');
      await emitir(host, 'host:siguiente', {});
      await rHost.esperar((e) => e.fase === 'RANKING');
      await emitir(host, 'host:siguiente', {});
    }

    const estadoFinal = await rHost.esperar((e) => e.fase === 'FIN');
    expect(estadoFinal.fase).toBe('FIN');
  });
});

describe('partida: modo B, revelado manual y reconexión (Fase 3)', () => {
  it('en rondas con dos respuestas correctas, solo quienes eligieron una de ellas suman puntos', async () => {
    // 8 rondas: numero 1 es el calentamiento (modo A) y 2,4,6,8 son de modo B.
    // Con el balance por objetivo, SJF siempre produce dos respuestas correctas (sección 7.10),
    // así que un ciclo completo de las 4 rondas de modo B garantiza al menos una con dos correctas.
    const config: ConfigPartida = { rondas: 8, tiempoA: 15, tiempoB: 15, revelarAutomatico: true, dificultad: 'normal' };
    const { host, rHost, jugadores } = await crearPartida(['Ana', 'Beto', 'Caro'], config);
    await emitir(host, 'host:iniciar', {});

    let huboRondaConDosCorrectas = false;

    for (let numero = 1; numero <= config.rondas; numero++) {
      const estado1 = await jugadores[0]!.r.esperar((e) => e.fase === 'RONDA' && e.numeroRonda === numero);
      const rondaId = estado1.ronda.id;
      const opciones = [0, 1, 2]; // en modo B: FCFS, SJF, SRTF

      await Promise.all(
        jugadores.map((j, i) => emitir(j.socket, 'jugador:responder', { rondaId, opcion: opciones[i] })),
      );

      const estHost = await rHost.esperar((e) => e.fase === 'REVELADO' && e.numeroRonda === numero);
      const correctas: number[] = estHost.revelado.correctas;
      if (correctas.length === 2) huboRondaConDosCorrectas = true;

      for (let i = 0; i < jugadores.length; i++) {
        const estado = await jugadores[i]!.r.esperar((e) => e.fase === 'REVELADO' && e.numeroRonda === numero);
        expect(estado.resultado.acierto).toBe(correctas.includes(opciones[i]!));
      }

      await emitir(host, 'host:siguiente', {});
      await rHost.esperar((e) => e.fase === 'RANKING');
      await emitir(host, 'host:siguiente', {});
    }

    expect(huboRondaConDosCorrectas).toBe(true);
  });

  it('con revelarAutomatico:false la sala espera en CERRADA hasta host:revelar', async () => {
    const config: ConfigPartida = { rondas: 4, tiempoA: 15, tiempoB: 15, revelarAutomatico: false, dificultad: 'normal' };
    const { host, rHost, jugadores } = await crearPartida(['Ana', 'Beto'], config);
    await emitir(host, 'host:iniciar', {});

    const estado1 = await jugadores[0]!.r.esperar((e) => e.fase === 'RONDA');
    const rondaId = estado1.ronda.id;
    await emitir(jugadores[0]!.socket, 'jugador:responder', { rondaId, opcion: 0 });
    await emitir(jugadores[1]!.socket, 'jugador:responder', { rondaId, opcion: 1 });

    const estCerrada = await rHost.esperar((e) => e.fase === 'CERRADA');
    expect(estCerrada.revelado).toBeNull();
    const jugCerrado = await jugadores[0]!.r.esperar((e) => e.fase === 'CERRADA');
    expect(jugCerrado.resultado).toBeNull();

    const ackRevelar = await emitir(host, 'host:revelar', {});
    expect(ackRevelar.ok).toBe(true);

    const estRevelado = await rHost.esperar((e) => e.fase === 'REVELADO');
    expect(estRevelado.revelado).not.toBeNull();
  });

  it('un jugador se desconecta y vuelve con su token: conserva nombre y puntos', async () => {
    const { host, codigo, jugadores } = await crearPartida(['Ana', 'Beto']);
    await emitir(host, 'host:iniciar', {});

    const estado1 = await jugadores[0]!.r.esperar((e) => e.fase === 'RONDA');
    const rondaId = estado1.ronda.id;
    await emitir(jugadores[0]!.socket, 'jugador:responder', { rondaId, opcion: 0 });
    await emitir(jugadores[1]!.socket, 'jugador:responder', { rondaId, opcion: 1 });
    const estadoPrevio = await jugadores[0]!.r.esperar((e) => e.fase === 'REVELADO');
    const puntosAntes = estadoPrevio.yo.puntos;

    jugadores[0]!.socket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 150));

    const nuevoSocket = conectar();
    const nuevoRastreador = new Rastreador(nuevoSocket);
    const ackReconectar = await emitir(nuevoSocket, 'jugador:unirse', { codigo, token: jugadores[0]!.token });
    expect(ackReconectar.ok).toBe(true);

    const estadoReconectado = await nuevoRastreador.esperar((e) => e.rol === 'jugador');
    expect(estadoReconectado.yo.nombre).toBe('Ana');
    expect(estadoReconectado.yo.puntos).toBe(puntosAntes);
  });
});

describe('partida: resumen final y exportación CSV (Fase 4)', () => {
  it('al llegar a FIN, el resumen del host y el de cada jugador coinciden con lo jugado', async () => {
    const config: ConfigPartida = { rondas: 4, tiempoA: 15, tiempoB: 15, revelarAutomatico: true, dificultad: 'normal' };
    const { host, rHost, jugadores } = await crearPartida(['Ana', 'Beto'], config);
    await emitir(host, 'host:iniciar', {});

    for (let numero = 1; numero <= config.rondas; numero++) {
      const estado1 = await jugadores[0]!.r.esperar((e) => e.fase === 'RONDA' && e.numeroRonda === numero);
      const rondaId = estado1.ronda.id;
      await emitir(jugadores[0]!.socket, 'jugador:responder', { rondaId, opcion: 0 });
      await emitir(jugadores[1]!.socket, 'jugador:responder', { rondaId, opcion: 1 });
      await rHost.esperar((e) => e.fase === 'REVELADO' && e.numeroRonda === numero);
      await emitir(host, 'host:siguiente', {});
      await rHost.esperar((e) => e.fase === 'RANKING');
      await emitir(host, 'host:siguiente', {});
    }

    const estadoFinal = await rHost.esperar((e) => e.fase === 'FIN');
    expect(estadoFinal.resumen).not.toBeNull();

    const totalPorCategoria = Object.values(estadoFinal.resumen.clase).reduce(
      (acc: number, m: any) => acc + m.total,
      0,
    );
    // cada ronda deja un registro por jugador conectado (2 jugadores × 4 rondas).
    expect(totalPorCategoria).toBe(config.rondas * 2);
    expect(Object.keys(estadoFinal.resumen.porJugador).sort()).toEqual(['Ana', 'Beto']);

    for (const j of jugadores) {
      const estFinalJugador = await j.r.esperar((e) => e.fase === 'FIN');
      expect(estFinalJugador.resumen).not.toBeNull();
      const totalJugador = estFinalJugador.resumen.reduce((acc: number, f: any) => acc + f.total, 0);
      expect(totalJugador).toBe(config.rondas);
    }
  });

  it('host:exportar devuelve un CSV con encabezado, BOM y una fila por respuesta; un no-host recibe NO_AUTORIZADO', async () => {
    const config: ConfigPartida = { rondas: 4, tiempoA: 15, tiempoB: 15, revelarAutomatico: true, dificultad: 'normal' };
    const { host, rHost, jugadores } = await crearPartida(['Ana', 'Beto'], config);
    await emitir(host, 'host:iniciar', {});

    for (let numero = 1; numero <= config.rondas; numero++) {
      const estado1 = await jugadores[0]!.r.esperar((e) => e.fase === 'RONDA' && e.numeroRonda === numero);
      const rondaId = estado1.ronda.id;
      await emitir(jugadores[0]!.socket, 'jugador:responder', { rondaId, opcion: 0 });
      await emitir(jugadores[1]!.socket, 'jugador:responder', { rondaId, opcion: 1 });
      await rHost.esperar((e) => e.fase === 'REVELADO' && e.numeroRonda === numero);
      await emitir(host, 'host:siguiente', {});
      await rHost.esperar((e) => e.fase === 'RANKING');
      await emitir(host, 'host:siguiente', {});
    }
    await rHost.esperar((e) => e.fase === 'FIN');

    const ackExportar = await emitir<{ csv: string }>(host, 'host:exportar', {});
    expect(ackExportar.ok).toBe(true);
    if (!ackExportar.ok) return;

    const csv = ackExportar.datos.csv;
    expect(csv.startsWith('﻿')).toBe(true);
    const lineas = csv.slice(1).split('\n');
    expect(lineas[0]).toBe(
      'ronda;modo;tipo;algoritmo;objetivo;jugador;respuesta;correctas;acierto;tiempo_ms;puntos;bono',
    );
    expect(lineas.length - 1).toBe(config.rondas * 2);

    const intruso = conectar();
    const ackIntruso = await emitir(intruso, 'host:exportar', {});
    expect(ackIntruso).toEqual({ ok: false, error: 'NO_AUTORIZADO' });
  });
});
