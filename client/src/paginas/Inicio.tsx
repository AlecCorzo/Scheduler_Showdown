import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { socket } from '../socket.js';
import type { Ack } from '../tipos.js';
import iconoPersona from '../assets/person-em.png';
import iconoLapiz from '../assets/pencil-em.png';
import iconoComputador from '../assets/pc-em.png';

const TEXTO_ERROR: Record<string, string> = {
  SALA_NO_EXISTE: 'No hay ninguna sala con ese código. Revísalo en la pantalla del proyector.',
  NOMBRE_EN_USO: 'Ese nombre ya está en uso en esta sala. Prueba con otro.',
  NOMBRE_INVALIDO: 'Usa entre 1 y 16 letras, números o espacios.',
  SALA_LLENA: 'La sala ya tiene 60 jugadores.',
};

function fueraDeRango(valor: number, min: number, max: number): boolean {
  return !Number.isInteger(valor) || valor < min || valor > max;
}

export function Inicio() {
  const navigate = useNavigate();

  // Cuál de los dos modales está abierto, o ninguno.
  const [modalActivo, setModalActivo] = useState<'crear' | 'unirme' | null>(null);

  const [rondas, setRondas] = useState(10);
  const [tiempoA, setTiempoA] = useState(30);
  const [tiempoB, setTiempoB] = useState(60);
  const [dificultad, setDificultad] = useState<'normal' | 'facil'>('normal');
  const [revelarAutomatico, setRevelarAutomatico] = useState(true);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [errorUnirse, setErrorUnirse] = useState<string | null>(null);
  const [uniendo, setUniendo] = useState(false);

  // Escape y click afuera cierran cualquiera de los dos modales: acá, a
  // diferencia del simulador, siempre hay algo válido detrás (las 3
  // tarjetas), así que no hace falta restringirlo.
  useEffect(() => {
    if (!modalActivo) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalActivo(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalActivo]);

  function errorDeConfiguracion(): string | null {
    if (fueraDeRango(rondas, 4, 20)) return 'Las rondas deben ser un número entero entre 4 y 20.';
    if (fueraDeRango(tiempoA, 15, 90)) return 'El tiempo del modo A debe ser un número entero entre 15 y 90 segundos.';
    if (fueraDeRango(tiempoB, 15, 90)) return 'El tiempo del modo B debe ser un número entero entre 15 y 90 segundos.';
    return null;
  }

  const errorConfiguracion = errorDeConfiguracion();

  function crearSala() {
    const error = errorDeConfiguracion();
    if (error) return setErrorCrear(error);

    setErrorCrear(null);
    setCreando(true);
    socket.emit(
      'host:crear',
      { rondas, tiempoA, tiempoB, revelarAutomatico, dificultad },
      (ack: Ack<{ codigo: string; tokenHost: string }>) => {
        setCreando(false);
        if (!ack.ok) return setErrorCrear('No se pudo crear la sala. Intenta de nuevo.');
        sessionStorage.setItem('codigo', ack.datos.codigo);
        sessionStorage.setItem('tokenHost', ack.datos.tokenHost);
        navigate('/host');
      },
    );
  }

  function unirse() {
    setErrorUnirse(null);
    setUniendo(true);
    const codigoLimpio = codigo.trim().toUpperCase();
    socket.emit(
      'jugador:unirse',
      { codigo: codigoLimpio, nombre: nombre.trim() },
      (ack: Ack<{ token: string }>) => {
        setUniendo(false);
        if (!ack.ok) return setErrorUnirse(TEXTO_ERROR[ack.error] ?? 'No se pudo unir a la sala.');
        sessionStorage.setItem('codigo', codigoLimpio);
        sessionStorage.setItem('token', ack.datos.token);
        sessionStorage.setItem('nombre', nombre.trim());
        navigate('/jugar');
      },
    );
  }

  return (
    <main className="inicio">
      <div className="inicio-contenido">
        <h1>Scheduler Showdown</h1>

        <div className="tarjetas-horizontal">
          <section className="tarjeta">
            <img className="tarjeta-icono" src={iconoPersona} alt="" />
            <h2>Simulador</h2>
            <p>Compara FCFS, Round Robin, SJF/SRTF y Prioridad en paralelo.</p>
            <Link to="/simulador" className="boton-enlace">
              Abrir simulador
            </Link>
          </section>

          <section className="tarjeta">
            <img className="tarjeta-icono" src={iconoLapiz} alt="" />
            <h2>Crear sala</h2>
            <p>Crea una sala para hostear una batalla de trivia sobre algoritmos.</p>
            <button type="button" className="boton-tarjeta" onClick={() => setModalActivo('crear')}>
              Crear sala
            </button>
          </section>

          <section className="tarjeta">
            <img className="tarjeta-icono" src={iconoComputador} alt="" />
            <h2>Unirme</h2>
            <p>Únete a una sala para poner a prueba tus conocimientos.</p>
            <button type="button" className="boton-tarjeta" onClick={() => setModalActivo('unirme')}>
              Unirme
            </button>
          </section>
        </div>
      </div>

      {modalActivo === 'crear' && (
        <div className="modal-fondo" onClick={(e) => e.target === e.currentTarget && setModalActivo(null)}>
          <div className="modal-caja" role="dialog" aria-modal="true" aria-label="Crear sala">
            <h2>Crear sala</h2>
            <label>
              Rondas (4 a 20)
              <input
                type="number"
                min={4}
                max={20}
                value={rondas}
                onChange={(e) => setRondas(Number(e.target.value))}
              />
            </label>
            <label>
              Tiempo por ronda de modo A, en segundos (15 a 90)
              <input
                type="number"
                min={15}
                max={90}
                value={tiempoA}
                onChange={(e) => setTiempoA(Number(e.target.value))}
              />
            </label>
            <label>
              Tiempo por ronda de modo B, en segundos (15 a 90)
              <input
                type="number"
                min={15}
                max={90}
                value={tiempoB}
                onChange={(e) => setTiempoB(Number(e.target.value))}
              />
            </label>
            <label>
              Dificultad
              <select value={dificultad} onChange={(e) => setDificultad(e.target.value as 'normal' | 'facil')}>
                <option value="normal">Normal</option>
                <option value="facil">Fácil</option>
              </select>
            </label>
            <label className="casilla">
              <input
                type="checkbox"
                checked={revelarAutomatico}
                onChange={(e) => setRevelarAutomatico(e.target.checked)}
              />
              Revelar automáticamente al cerrarse cada ronda
            </label>
            {errorCrear && <p className="error">{errorCrear}</p>}
            <div className="modal-acciones">
              <button type="button" className="boton-secundario-claro" onClick={() => setModalActivo(null)}>
                Cancelar
              </button>
              <button type="button" onClick={crearSala} disabled={creando || Boolean(errorConfiguracion)}>
                Crear sala
              </button>
            </div>
          </div>
        </div>
      )}

      {modalActivo === 'unirme' && (
        <div className="modal-fondo" onClick={(e) => e.target === e.currentTarget && setModalActivo(null)}>
          <div className="modal-caja" role="dialog" aria-modal="true" aria-label="Unirme a sala">
            <h2>Unirme</h2>
            <label>
              Código
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={5} />
            </label>
            <label>
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={16} />
            </label>
            {errorUnirse && <p className="error">{errorUnirse}</p>}
            <div className="modal-acciones">
              <button type="button" className="boton-secundario-claro" onClick={() => setModalActivo(null)}>
                Cancelar
              </button>
              <button type="button" onClick={unirse} disabled={uniendo || !codigo || !nombre}>
                Unirme
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
