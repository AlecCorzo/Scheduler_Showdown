import type { Server, Socket } from 'socket.io';
import type { ConfigPartida } from '@showdown/engine';
import { crearSala, obtenerSala, MAX_JUGADORES } from './salas.js';
import { vistaHost, vistaJugador } from './vistas.js';
import { generarCsv } from './csv.js';
import type { Sala } from './sala.js';

export type CodigoError =
  | 'SALA_NO_EXISTE'
  | 'SALA_LLENA'
  | 'NOMBRE_INVALIDO'
  | 'NOMBRE_EN_USO'
  | 'TOKEN_INVALIDO'
  | 'NO_AUTORIZADO'
  | 'FASE_INCORRECTA'
  | 'SIN_JUGADORES'
  | 'RONDA_CERRADA'
  | 'YA_RESPONDIO'
  | 'OPCION_INVALIDA'
  | 'CONFIG_INVALIDA';

export type Ack<T = {}> = { ok: true; datos: T } | { ok: false; error: CodigoError };
type Callback<T = {}> = (ack: Ack<T>) => void;

function validarConfig(data: unknown): ConfigPartida | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  const { rondas, tiempoA, tiempoB, revelarAutomatico, dificultad } = d;
  if (typeof rondas !== 'number' || !Number.isInteger(rondas) || rondas < 4 || rondas > 20) return null;
  if (typeof tiempoA !== 'number' || !Number.isInteger(tiempoA) || tiempoA < 15 || tiempoA > 90) return null;
  if (typeof tiempoB !== 'number' || !Number.isInteger(tiempoB) || tiempoB < 15 || tiempoB > 90) return null;
  if (typeof revelarAutomatico !== 'boolean') return null;
  if (dificultad !== 'normal' && dificultad !== 'facil') return null;
  return { rondas, tiempoA, tiempoB, revelarAutomatico, dificultad };
}

function validarNombre(nombre: unknown): string | null {
  if (typeof nombre !== 'string') return null;
  const limpio = nombre.trim();
  if (!/^[\p{L}\p{N} ]{1,16}$/u.test(limpio)) return null;
  return limpio;
}

function emitirEstado(io: Server, sala: Sala): void {
  if (sala.hostSocketId) io.to(sala.hostSocketId).emit('sala:estado', vistaHost(sala));
  for (const jugador of sala.jugadores.values()) {
    if (jugador.socketId) io.to(jugador.socketId).emit('sala:estado', vistaJugador(sala, jugador.token));
  }
}

export function registrarHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    function salaDelHost(): Sala | null {
      const codigo = socket.data.codigo as string | undefined;
      if (!codigo || socket.data.rol !== 'host') return null;
      return obtenerSala(codigo) ?? null;
    }

    socket.on('host:crear', (data: unknown, cb: Callback<{ codigo: string; tokenHost: string }>) => {
      const config = validarConfig(data);
      if (!config) return cb({ ok: false, error: 'CONFIG_INVALIDA' });

      const sala = crearSala(config);
      sala.hostSocketId = socket.id;
      sala.hostConectado = true;
      socket.data.codigo = sala.codigo;
      socket.data.rol = 'host';
      sala.on('cambio', () => emitirEstado(io, sala));

      socket.on('disconnect', () => {
        if (sala.hostSocketId === socket.id) sala.marcarDesconexionHost();
      });

      cb({ ok: true, datos: { codigo: sala.codigo, tokenHost: sala.tokenHost } });
      emitirEstado(io, sala);
    });

    socket.on('host:reanudar', (data: unknown, cb: Callback) => {
      const d = (data ?? {}) as Record<string, unknown>;
      const codigo = typeof d.codigo === 'string' ? d.codigo.trim().toUpperCase() : '';
      const tokenHost = typeof d.tokenHost === 'string' ? d.tokenHost : '';
      const sala = obtenerSala(codigo);
      if (!sala) return cb({ ok: false, error: 'SALA_NO_EXISTE' });
      if (!sala.reconectarHost(tokenHost, socket.id)) return cb({ ok: false, error: 'TOKEN_INVALIDO' });

      socket.data.codigo = sala.codigo;
      socket.data.rol = 'host';
      socket.on('disconnect', () => {
        if (sala.hostSocketId === socket.id) sala.marcarDesconexionHost();
      });

      cb({ ok: true, datos: {} });
      emitirEstado(io, sala);
    });

    socket.on('host:iniciar', (_data: unknown, cb: Callback) => {
      const sala = salaDelHost();
      if (!sala) return cb({ ok: false, error: 'NO_AUTORIZADO' });
      const r = sala.iniciar();
      cb(r.ok ? { ok: true, datos: {} } : r);
    });

    socket.on('host:revelar', (_data: unknown, cb: Callback) => {
      const sala = salaDelHost();
      if (!sala) return cb({ ok: false, error: 'NO_AUTORIZADO' });
      const r = sala.revelar();
      cb(r.ok ? { ok: true, datos: {} } : r);
    });

    socket.on('host:siguiente', (_data: unknown, cb: Callback) => {
      const sala = salaDelHost();
      if (!sala) return cb({ ok: false, error: 'NO_AUTORIZADO' });
      const r = sala.avanzar();
      cb(r.ok ? { ok: true, datos: {} } : r);
    });

    socket.on('host:saltar', (_data: unknown, cb: Callback) => {
      const sala = salaDelHost();
      if (!sala) return cb({ ok: false, error: 'NO_AUTORIZADO' });
      const r = sala.saltar();
      cb(r.ok ? { ok: true, datos: {} } : r);
    });

    socket.on('host:exportar', (_data: unknown, cb: Callback<{ csv: string }>) => {
      const sala = salaDelHost();
      if (!sala) return cb({ ok: false, error: 'NO_AUTORIZADO' });
      cb({ ok: true, datos: { csv: generarCsv(sala.historial) } });
    });

    socket.on('jugador:unirse', (data: unknown, cb: Callback<{ token: string }>) => {
      const d = (data ?? {}) as Record<string, unknown>;
      const codigo = typeof d.codigo === 'string' ? d.codigo.trim().toUpperCase() : '';
      const sala = obtenerSala(codigo);
      if (!sala) return cb({ ok: false, error: 'SALA_NO_EXISTE' });

      // Reconexión (sección 8.3): mismo evento, con el token que el cliente guardó.
      const tokenExistente = typeof d.token === 'string' ? d.token : undefined;
      if (tokenExistente) {
        const jugador = sala.reconectarJugador(tokenExistente, socket.id);
        if (!jugador) return cb({ ok: false, error: 'TOKEN_INVALIDO' });

        socket.data.codigo = sala.codigo;
        socket.data.rol = 'jugador';
        socket.data.token = jugador.token;
        socket.on('disconnect', () => {
          if (jugador.socketId === socket.id) sala.marcarDesconexion(jugador.token);
        });

        cb({ ok: true, datos: { token: jugador.token } });
        emitirEstado(io, sala);
        return;
      }

      const nombre = validarNombre(d.nombre);
      if (!nombre) return cb({ ok: false, error: 'NOMBRE_INVALIDO' });
      if (sala.nombreEnUso(nombre)) return cb({ ok: false, error: 'NOMBRE_EN_USO' });
      if (sala.jugadores.size >= MAX_JUGADORES) return cb({ ok: false, error: 'SALA_LLENA' });

      const jugador = sala.agregarJugador(nombre);
      jugador.socketId = socket.id;
      socket.data.codigo = sala.codigo;
      socket.data.rol = 'jugador';
      socket.data.token = jugador.token;

      socket.on('disconnect', () => {
        if (jugador.socketId === socket.id) sala.marcarDesconexion(jugador.token);
      });

      cb({ ok: true, datos: { token: jugador.token } });
      emitirEstado(io, sala);
    });

    socket.on('jugador:responder', (data: unknown, cb: Callback) => {
      const codigo = socket.data.codigo as string | undefined;
      const token = socket.data.token as string | undefined;
      if (!codigo || !token || socket.data.rol !== 'jugador') return cb({ ok: false, error: 'NO_AUTORIZADO' });

      const sala = obtenerSala(codigo);
      if (!sala) return cb({ ok: false, error: 'SALA_NO_EXISTE' });

      const d = (data ?? {}) as Record<string, unknown>;
      if (typeof d.rondaId !== 'string' || !sala.rondaActual || d.rondaId !== sala.rondaActual.id) {
        return cb({ ok: false, error: 'RONDA_CERRADA' });
      }

      const opcion = typeof d.opcion === 'number' ? d.opcion : NaN;
      const r = sala.responder(token, opcion);
      cb(r.ok ? { ok: true, datos: {} } : r);
    });
  });
}
