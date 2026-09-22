import { randomInt, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { ALGORITMOS, crearGenerador, puntuar, ranking as calcularRanking } from '@showdown/engine';
import type { Algoritmo, Categoria, ConfigPartida, Modo, Ronda, TipoPregunta } from '@showdown/engine';
import { construirResumen } from './vistas.js';
import type { Fase, FilaRanking, ResumenFinal, Revelado } from './vistas.js';

export interface RegistroRespuesta {
  ronda: number;
  modo: Modo;
  tipo: TipoPregunta;
  algoritmo: Algoritmo | null;
  objetivo: string | null;
  categoria: Categoria;
  jugador: string;
  opcionTexto: string | null; // texto de la opción elegida, o null si no respondió
  correctasTexto: string[]; // texto de las respuestas correctas (1 o 2)
  opcionAlgoritmo: Algoritmo | null; // solo modo B, para la matriz de 8.6
  correctasAlgoritmos: Algoritmo[]; // solo modo B
  acierto: boolean;
  tMs: number;
  puntos: number;
  bono: number;
}

export interface RespuestaJugador {
  opcion: number | null; // null: no respondió
  tMs: number;
  acierto: boolean;
  puntos: number;
  bono: number;
}

export interface JugadorInterno {
  token: string;
  nombre: string;
  puntos: number;
  racha: number;
  conectado: boolean;
  socketId: string | null;
  respuesta: RespuestaJugador | null;
}

type ResultadoAccion = { ok: true } | { ok: false; error: 'FASE_INCORRECTA' | 'SIN_JUGADORES' };
type ResultadoResponder =
  | { ok: true }
  | { ok: false; error: 'RONDA_CERRADA' | 'YA_RESPONDIO' | 'OPCION_INVALIDA' };

export class Sala extends EventEmitter {
  readonly codigo: string;
  readonly tokenHost: string;
  readonly config: ConfigPartida;
  readonly semilla: number;

  fase: Fase = 'LOBBY';
  hostSocketId: string | null = null;
  hostConectado = false;
  jugadores = new Map<string, JugadorInterno>();

  numeroRonda = 0;
  rondaActual: Ronda | null = null;
  revelado: Revelado | null = null;
  rankingActual: FilaRanking[] | null = null;
  resumenFinal: ResumenFinal | null = null;
  historial: RegistroRespuesta[] = [];
  finEnMs: number | null = null;
  ultimaActividadMs = Date.now();

  private inicioRondaMs: number | null = null;
  private duracionRondaMs: number | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly generador: ReturnType<typeof crearGenerador>;

  constructor(codigo: string, config: ConfigPartida) {
    super();
    this.codigo = codigo;
    this.config = config;
    this.semilla = randomInt(0, 2 ** 31 - 1);
    this.tokenHost = randomUUID();
    this.generador = crearGenerador(config, this.semilla);
  }

  get restanteMs(): number | null {
    if (this.fase !== 'RONDA' || this.inicioRondaMs === null || this.duracionRondaMs === null) return null;
    return Math.max(0, this.inicioRondaMs + this.duracionRondaMs - Date.now());
  }

  private tocar(): void {
    this.ultimaActividadMs = Date.now();
  }

  agregarJugador(nombre: string): JugadorInterno {
    const jugador: JugadorInterno = {
      token: randomUUID(),
      nombre,
      puntos: 0,
      racha: 0,
      conectado: true,
      socketId: null,
      respuesta: null,
    };
    this.jugadores.set(jugador.token, jugador);
    this.tocar();
    this.emit('cambio');
    return jugador;
  }

  nombreEnUso(nombre: string): boolean {
    const buscado = nombre.toLowerCase();
    for (const j of this.jugadores.values()) if (j.nombre.toLowerCase() === buscado) return true;
    return false;
  }

  jugadoresConectados(): JugadorInterno[] {
    return [...this.jugadores.values()].filter((j) => j.conectado);
  }

  marcarDesconexion(token: string): void {
    const jugador = this.jugadores.get(token);
    if (!jugador) return;
    jugador.conectado = false;
    jugador.socketId = null;
    this.tocar();
    this.emit('cambio');
  }

  marcarDesconexionHost(): void {
    this.hostConectado = false;
    this.hostSocketId = null;
    this.tocar();
    this.emit('cambio');
  }

  /** Reconexión por token (sección 8.3): no es opcional, la recuperación de Socket.IO puede fallar. */
  reconectarJugador(token: string, socketId: string): JugadorInterno | null {
    const jugador = this.jugadores.get(token);
    if (!jugador) return null;
    jugador.conectado = true;
    jugador.socketId = socketId;
    this.tocar();
    this.emit('cambio');
    return jugador;
  }

  reconectarHost(tokenHost: string, socketId: string): boolean {
    if (tokenHost !== this.tokenHost) return false;
    this.hostSocketId = socketId;
    this.hostConectado = true;
    this.tocar();
    this.emit('cambio');
    return true;
  }

  iniciar(): ResultadoAccion {
    this.tocar();
    if (this.fase !== 'LOBBY') return { ok: false, error: 'FASE_INCORRECTA' };
    if (this.jugadoresConectados().length === 0) return { ok: false, error: 'SIN_JUGADORES' };
    this.generarRonda();
    this.emit('cambio');
    return { ok: true };
  }

  avanzar(): ResultadoAccion {
    this.tocar();
    if (this.fase === 'REVELADO') {
      this.rankingActual = calcularRanking(
        [...this.jugadores.values()].map((j) => ({ nombre: j.nombre, puntos: j.puntos })),
      );
      this.fase = 'RANKING';
      this.emit('cambio');
      return { ok: true };
    }
    if (this.fase === 'RANKING') {
      if (this.numeroRonda >= this.config.rondas) {
        this.terminar();
      } else {
        this.generarRonda();
      }
      this.emit('cambio');
      return { ok: true };
    }
    return { ok: false, error: 'FASE_INCORRECTA' };
  }

  revelar(): ResultadoAccion {
    this.tocar();
    if (this.fase !== 'CERRADA') return { ok: false, error: 'FASE_INCORRECTA' };
    this.fase = 'REVELADO';
    this.emit('cambio');
    return { ok: true };
  }

  saltar(): ResultadoAccion {
    this.tocar();
    if (this.fase !== 'RONDA') return { ok: false, error: 'FASE_INCORRECTA' };
    this.limpiarTimeout();
    this.generador.saltar();
    if (this.numeroRonda >= this.config.rondas) {
      this.terminar();
    } else {
      this.generarRonda();
    }
    this.emit('cambio');
    return { ok: true };
  }

  private terminar(): void {
    this.fase = 'FIN';
    this.finEnMs = Date.now();
    this.resumenFinal = construirResumen(this.historial);
  }

  responder(token: string, opcion: number): ResultadoResponder {
    this.tocar();
    if (this.fase !== 'RONDA' || !this.rondaActual) return { ok: false, error: 'RONDA_CERRADA' };
    const jugador = this.jugadores.get(token);
    if (!jugador) return { ok: false, error: 'RONDA_CERRADA' };
    if (jugador.respuesta) return { ok: false, error: 'YA_RESPONDIO' };
    if (!Number.isInteger(opcion) || opcion < 0 || opcion >= this.rondaActual.opciones.length) {
      return { ok: false, error: 'OPCION_INVALIDA' };
    }

    const tMs = Date.now() - this.inicioRondaMs!;
    const acierto = this.rondaActual.correctas.includes(opcion);
    const { puntos, bono, racha } = puntuar(acierto, tMs, this.duracionRondaMs!, jugador.racha);
    jugador.respuesta = { opcion, tMs, acierto, puntos, bono };
    jugador.puntos += puntos + bono;
    jugador.racha = racha;

    const conectados = this.jugadoresConectados();
    if (conectados.length > 0 && conectados.every((j) => j.respuesta !== null)) {
      this.cerrarRonda();
    }
    this.emit('cambio');
    return { ok: true };
  }

  private generarRonda(): void {
    const ronda = this.generador.siguiente();
    this.numeroRonda = ronda.numero;
    this.rondaActual = ronda;
    this.inicioRondaMs = Date.now();
    this.duracionRondaMs = (ronda.modo === 'A' ? this.config.tiempoA : this.config.tiempoB) * 1000;
    this.revelado = null;
    this.rankingActual = null;
    for (const j of this.jugadores.values()) j.respuesta = null;
    this.fase = 'RONDA';

    this.limpiarTimeout();
    this.timeoutId = setTimeout(() => {
      this.cerrarRonda();
      this.emit('cambio');
    }, this.duracionRondaMs);
  }

  private cerrarRonda(): void {
    if (this.fase !== 'RONDA' || !this.rondaActual) return;
    this.limpiarTimeout();
    const ronda = this.rondaActual;

    const correctasTexto = ronda.correctas.map((i) => ronda.opciones[i]!);
    const correctasAlgoritmos = ronda.modo === 'B' ? ronda.correctas.map((i) => ALGORITMOS[i]!) : [];

    for (const j of this.jugadores.values()) {
      if (!j.respuesta) {
        j.racha = 0;
        j.respuesta = { opcion: null, tMs: this.duracionRondaMs!, acierto: false, puntos: 0, bono: 0 };
      }
      const opcionIdx = j.respuesta.opcion;
      this.historial.push({
        ronda: ronda.numero,
        modo: ronda.modo,
        tipo: ronda.tipo,
        algoritmo: ronda.algoritmo,
        objetivo: ronda.objetivo,
        categoria: ronda.categoria,
        jugador: j.nombre,
        opcionTexto: opcionIdx !== null ? ronda.opciones[opcionIdx]! : null,
        correctasTexto,
        opcionAlgoritmo: ronda.modo === 'B' && opcionIdx !== null ? ALGORITMOS[opcionIdx]! : null,
        correctasAlgoritmos,
        acierto: j.respuesta.acierto,
        tMs: j.respuesta.tMs,
        puntos: j.respuesta.puntos,
        bono: j.respuesta.bono,
      });
    }

    const conteo = ronda.opciones.map(
      (_, i) => [...this.jugadores.values()].filter((j) => j.respuesta?.opcion === i).length,
    );
    const lineas: Partial<Record<Algoritmo, Ronda['lineas'][Algoritmo]>> =
      ronda.modo === 'B' ? { ...ronda.lineas } : { [ronda.algoritmo as Algoritmo]: ronda.lineas[ronda.algoritmo!] };

    this.revelado = {
      correctas: ronda.correctas,
      lineas,
      alternas: ronda.alternas,
      explicacion: ronda.explicacion,
      conteo,
    };
    this.fase = this.config.revelarAutomatico ? 'REVELADO' : 'CERRADA';
  }

  private limpiarTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
