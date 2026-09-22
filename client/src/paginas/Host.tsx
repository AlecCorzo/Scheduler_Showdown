import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALGORITMOS, NOMBRE_ALGORITMO } from '@showdown/engine';
import type { Categoria } from '@showdown/engine';
import { useStore } from '../store.js';
import { socket } from '../socket.js';
import type { Ack, EstadoHost } from '../tipos.js';
import { TablaProcesos } from '../componentes/TablaProcesos.js';
import { Botones } from '../componentes/Botones.js';
import { Cronometro } from '../componentes/Cronometro.js';
import { Gantt } from '../componentes/Gantt.js';
import { GanttModoB } from '../componentes/GanttModoB.js';
import { Ranking } from '../componentes/Ranking.js';
import { Resumen } from '../componentes/Resumen.js';
import { MatrizModoB } from '../componentes/MatrizModoB.js';

const CATEGORIAS: Categoria[] = [...ALGORITMOS, 'COMPARACION'];

export function Host() {
  const navigate = useNavigate();
  const estado = useStore((s) => s.estado) as EstadoHost | null;
  const recibidoEn = useStore((s) => s.recibidoEn);
  const conectado = useStore((s) => s.conectado);
  const [porQue, setPorQue] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem('codigo') || !sessionStorage.getItem('tokenHost')) navigate('/');
  }, [navigate]);

  useEffect(() => {
    setPorQue(false);
  }, [estado?.numeroRonda]);

  const conectados = estado?.jugadores.filter((j) => j.conectado) ?? [];

  useEffect(() => {
    function accionPrincipal(fase: EstadoHost['fase']) {
      if (fase === 'LOBBY' && conectados.length > 0) socket.emit('host:iniciar', {}, () => {});
      else if (fase === 'CERRADA') socket.emit('host:revelar', {}, () => {});
      else if (fase === 'REVELADO' || fase === 'RANKING') socket.emit('host:siguiente', {}, () => {});
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!estado) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        accionPrincipal(estado.fase);
      } else if (e.key.toLowerCase() === 'p' && estado.fase === 'REVELADO') {
        setPorQue((v) => !v);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [estado, conectados.length]);

  if (!estado) {
    return (
      <main className="host">
        <p>Conectando…</p>
      </main>
    );
  }

  const direccion = window.location.origin;
  const esLocalhost = window.location.hostname === 'localhost';

  function descargarCsv() {
    socket.emit('host:exportar', {}, (ack: Ack<{ csv: string }>) => {
      if (!ack.ok) return;
      const blob = new Blob([ack.datos.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `scheduler-showdown-${estado!.codigo}.csv`;
      enlace.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <main className="host">
      {!conectado && <p className="aviso-conexion">Reconectando…</p>}

      {estado.fase === 'LOBBY' && (
        <section className="lobby">
          <p className="codigo-sala">{estado.codigo}</p>
          <p>Esperando jugadores. Entra a {direccion} y escribe el código.</p>
          {esLocalhost && (
            <p className="aviso">
              Estás usando la app desde localhost. Abre la dirección del túnel de VS Code para que los jugadores vean
              la dirección correcta.
            </p>
          )}
          <div className="reglas">
            <p>
              Si dos procesos quedan empatados, cualquier orden es válido. Todas las respuestas que salgan de un
              orden válido cuentan como correctas.
            </p>
            <p>Si al entrar ves una advertencia de Microsoft sobre un túnel de desarrollo, pulsa Continuar.</p>
          </div>
          <ul className="jugadores">
            {estado.jugadores.map((j) => (
              <li key={j.nombre}>
                {j.nombre}
                {!j.conectado && ' (desconectado)'}
              </li>
            ))}
          </ul>
          <button type="button" disabled={conectados.length === 0} onClick={() => socket.emit('host:iniciar', {}, () => {})}>
            Empezar partida
          </button>
        </section>
      )}

      {estado.fase === 'RONDA' && estado.ronda && (
        <section className="ronda">
          <header>
            <span>
              Ronda {estado.numeroRonda} de {estado.config.rondas}
            </span>
            <Cronometro restanteMs={estado.restanteMs} recibidoEn={recibidoEn} />
          </header>
          <p className="enunciado">{estado.ronda.enunciado}</p>
          <TablaProcesos escenario={estado.ronda.escenario} objetivo={estado.ronda.objetivo} />
          <Botones opciones={estado.ronda.opciones} />
          <footer>
            <span>
              Respondieron {estado.respondidos} de {conectados.length}
            </span>
            <button type="button" onClick={() => socket.emit('host:saltar', {}, () => {})}>
              Saltar ronda
            </button>
          </footer>
        </section>
      )}

      {estado.fase === 'CERRADA' && estado.ronda && (
        <section className="cerrada">
          <p className="enunciado">{estado.ronda.enunciado}</p>
          <p>Se acabó el tiempo.</p>
          <button type="button" onClick={() => socket.emit('host:revelar', {}, () => {})}>
            Revelar
          </button>
        </section>
      )}

      {estado.fase === 'REVELADO' && estado.ronda && estado.revelado && (
        <section className="revelado">
          <p className="enunciado">{estado.ronda.enunciado}</p>
          <Botones opciones={estado.ronda.opciones} correctas={estado.revelado.correctas} />
          <p className="conteo aviso">
            {estado.revelado.conteo.map((n, i) => `${estado.ronda!.opciones[i]}: ${n}`).join(' · ')}
          </p>

          {estado.ronda.modo === 'A' && estado.ronda.algoritmo && estado.revelado.lineas[estado.ronda.algoritmo] && (
            <>
              <Gantt segmentos={estado.revelado.lineas[estado.ronda.algoritmo]!} />
              {estado.revelado.alternas.map((alt, i) => (
                <Gantt key={i} titulo="Con el otro desempate" segmentos={alt.segmentos} />
              ))}
            </>
          )}

          {estado.ronda.modo === 'B' && estado.ronda.objetivo && (
            <>
              <GanttModoB
                lineas={estado.revelado.lineas}
                objetivo={estado.ronda.objetivo}
                ganadores={ALGORITMOS.filter((_, i) => estado.revelado!.correctas.includes(i))}
              />
              {estado.revelado.alternas.map((alt, i) => (
                <Gantt key={i} titulo={`Con el otro desempate (${NOMBRE_ALGORITMO[alt.algoritmo]})`} segmentos={alt.segmentos} />
              ))}
            </>
          )}

          <button type="button" onClick={() => setPorQue((v) => !v)}>
            ¿Por qué?
          </button>
          {porQue && <p className="explicacion">{estado.revelado.explicacion}</p>}

          <button type="button" onClick={() => socket.emit('host:siguiente', {}, () => {})}>
            Siguiente
          </button>
        </section>
      )}

      {estado.fase === 'RANKING' && estado.ranking && (
        <section className="ranking-pantalla">
          <Ranking filas={estado.ranking.slice(0, 5)} />
          <button type="button" onClick={() => socket.emit('host:siguiente', {}, () => {})}>
            {estado.numeroRonda >= estado.config.rondas ? 'Ver resultados' : 'Siguiente'}
          </button>
        </section>
      )}

      {estado.fase === 'FIN' && estado.ranking && (
        <section className="fin">
          <h2>Fin de la partida</h2>
          <Ranking filas={estado.ranking.slice(0, 3)} />
          {estado.resumen && (
            <>
              <h3>Aciertos de la clase</h3>
              <Resumen filas={CATEGORIAS.map((categoria) => ({ categoria, ...estado.resumen!.clase[categoria] }))} />
              <h3>Matriz del modo B</h3>
              <MatrizModoB matriz={estado.resumen.matrizB} />
            </>
          )}
          <button type="button" onClick={descargarCsv}>
            Descargar resultados
          </button>
        </section>
      )}
    </main>
  );
}
