import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store.js';
import { socket } from '../socket.js';
import type { EstadoJugador } from '../tipos.js';
import { Botones } from '../componentes/Botones.js';
import { Cronometro } from '../componentes/Cronometro.js';
import { Ranking } from '../componentes/Ranking.js';
import { Resumen } from '../componentes/Resumen.js';

export function Jugar() {
  const navigate = useNavigate();
  const estado = useStore((s) => s.estado) as EstadoJugador | null;
  const recibidoEn = useStore((s) => s.recibidoEn);
  const conectado = useStore((s) => s.conectado);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('codigo') || !sessionStorage.getItem('token')) navigate('/');
  }, [navigate]);

  function volverAlInicio() {
    sessionStorage.removeItem('codigo');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('nombre');
    useStore.setState({ estado: null });
    navigate('/');
  }

  function responder(opcion: number) {
    if (!estado || estado.fase !== 'RONDA' || !estado.ronda || enviando || estado.miRespuesta !== null) return;
    setEnviando(true);
    socket.emit('jugador:responder', { rondaId: estado.ronda.id, opcion }, () => setEnviando(false));
  }

  // Teclas 1 a 4 para responder (sección 9.7).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!estado || estado.fase !== 'RONDA' || !estado.ronda || estado.miRespuesta !== null) return;
      const idx = Number(e.key) - 1;
      if (Number.isInteger(idx) && idx >= 0 && idx < estado.ronda.opciones.length) responder(idx);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, enviando]);

  if (!estado) {
    return (
      <main className="jugar">
        <p>Conectando…</p>
      </main>
    );
  }

  return (
    <main className="jugar">
      {!conectado && <p className="aviso-conexion">Reconectando…</p>}

      {estado.fase === 'LOBBY' && <p>Ya estás en la sala. La partida empieza cuando el docente la inicie.</p>}

      {estado.fase === 'RONDA' && estado.ronda && (
        <>
          <header>
            <span>
              Ronda {estado.numeroRonda} de {estado.totalRondas}
            </span>
            <Cronometro restanteMs={estado.restanteMs} recibidoEn={recibidoEn} />
          </header>
          <p className="enunciado">{estado.ronda.enunciado}</p>
          {estado.yo.racha >= 2 && <p className="racha">Racha: {estado.yo.racha}</p>}
          {estado.miRespuesta !== null ? (
            <p>Respuesta enviada. Espera el revelado.</p>
          ) : (
            <Botones opciones={estado.ronda.opciones} onSeleccionar={responder} deshabilitado={enviando} />
          )}
        </>
      )}

      {estado.fase === 'CERRADA' && <p>Se acabó el tiempo.</p>}

      {estado.fase === 'REVELADO' && estado.resultado && (
        <section>
          <p className="resultado">{estado.resultado.acierto ? 'Correcto' : 'Incorrecto'}</p>
          <p>
            +{estado.resultado.puntos} puntos
            {estado.resultado.bono > 0 ? ` (+${estado.resultado.bono} de racha)` : ''}
          </p>
          <p className="aviso">Posición: {estado.yo.posicion || '—'}</p>
        </section>
      )}

      {estado.fase === 'RANKING' && estado.top5 && (
        <section>
          <Ranking filas={estado.top5} resaltarNombre={estado.yo.nombre} />
          <p className="aviso">Tu posición: {estado.yo.posicion}</p>
        </section>
      )}

      {estado.fase === 'FIN' && (
        <section>
          <h2>Fin de la partida</h2>
          <p>Puntaje final: {estado.yo.puntos}</p>
          <p className="aviso">Posición: {estado.yo.posicion}</p>
          {estado.resumen && <Resumen filas={estado.resumen} />}
          <button type="button" onClick={volverAlInicio}>
            Volver al inicio
          </button>
        </section>
      )}
    </main>
  );
}