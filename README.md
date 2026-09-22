# Scheduler Showdown

Trivia en vivo, estilo Kahoot, para repasar cuatro algoritmos de planificación de CPU: **FCFS**, **SJF**, **SRTF** y **Round Robin**.

## ¿Qué es?

El docente crea una sala desde su computador y la proyecta en clase. Los estudiantes se unen desde el navegador de su propio computador escribiendo un código de 5 caracteres, y compiten respondiendo rondas cortas mientras el profesor controla el ritmo de la partida.

Está pensado para sesiones de repaso de unos 20 minutos (10 rondas) en un primer curso de sistemas operativos.

## ¿Para qué sirve?

Cada ronda muestra un escenario de 3 o 4 procesos (nombre, minuto de llegada y ráfaga de CPU) y obliga a construir mentalmente el diagrama de Gantt del algoritmo en cuestión antes de responder. No hay atajos como "gana el que llega primero": hay que entender cómo decide cada algoritmo en cada minuto.

Al cerrarse una ronda se revela la respuesta correcta con su diagrama de Gantt, una explicación en texto de por qué esa es la respuesta, y se actualiza el ranking en vivo. Al final de la partida se muestra un resumen de aciertos por algoritmo y se puede descargar un CSV con el detalle de cada respuesta.

## ¿Cómo funciona?

### Los dos modos de pregunta

- **Modo A — "Lee el Gantt":** se fija un algoritmo y se pregunta, por ejemplo, "¿qué proceso usa la CPU entre el minuto 5 y el 6?" o "¿en qué minuto termina Beto?".
- **Modo B — "¿Con cuál termina antes?":** se pregunta con qué algoritmo un proceso en particular termina primero, comparando los cuatro a la vez.

Un generador de preguntas construye cada ronda al azar (con semilla, para que sea reproducible), filtra los escenarios ambiguos o mal balanceados, y reparte los algoritmos parejo a lo largo de la partida.

### Los empates no castigan

Si dos procesos quedan empatados en el criterio de un algoritmo (por ejemplo, llegan en el mismo minuto), el juego acepta **cualquier** orden entre ellos como válido. Cualquier respuesta que salga de un desempate razonable cuenta como correcta y recibe el puntaje completo.

### El servidor manda

Todo el cálculo — generar la ronda, medir el tiempo de respuesta y calcular el puntaje — ocurre en el servidor. El navegador de cada jugador nunca recibe la respuesta correcta antes del revelado.

### Flujo de una sala

```
LOBBY → RONDA → (CERRADA) → REVELADO → RANKING → RONDA → … → FIN
```

- **LOBBY:** el host crea la sala y los jugadores entran con el código.
- **RONDA:** se muestra la pregunta con un cronómetro; el host puede saltarla si hace falta.
- **CERRADA** *(opcional)*: si se desactiva el revelado automático, la ronda espera aquí hasta que el host pulse "Revelar".
- **REVELADO:** se muestran las respuestas correctas, el diagrama de Gantt, el conteo de respuestas por opción y una explicación en texto.
- **RANKING:** tabla de posiciones antes de pasar a la siguiente ronda.
- **FIN:** puntaje final, resumen de aciertos por categoría, matriz de resultados del modo B y descarga del CSV.

El puntaje premia la velocidad (1000 puntos si se responde al instante, 500 si se responde justo al final) y otorga un bono por racha de aciertos seguidos. Si un jugador se desconecta y vuelve a entrar con el mismo código, conserva su nombre, su puntaje y la ronda en la que va.

## Stack técnico

Monorepo en TypeScript con `npm workspaces`:

| Parte | Tecnologías |
| --- | --- |
| `engine/` | Motor de los algoritmos y el generador de preguntas — TypeScript puro, sin dependencias de Node ni del navegador, probado con Vitest |
| `server/` | Express + Socket.IO — la sala vive en memoria, sin base de datos |
| `client/` | React + Vite + Zustand + React Router, con Socket.IO en el navegador |

## Estructura del repositorio

```
scheduler-showdown/
├── engine/     # Algoritmos (FCFS, SJF, SRTF, RR), generador de rondas, puntaje
├── server/     # Sala en tiempo real (Socket.IO), API de eventos, exportación CSV
└── client/     # Interfaz del host (proyector) y de los jugadores
```

## Requisitos previos

- [Node.js](https://nodejs.org/) 22 o superior (incluye `npm`)
- Un navegador actual (Chrome, Edge o Firefox)

## Instalación paso a paso

1. **Clonar el repositorio:**

   ```bash
   git clone https://github.com/AlecCorzo/Scheduler_Showdown.git
   ```

2. **Entrar a la carpeta del proyecto** (el código vive en `scheduler-showdown/`, dentro del repositorio):

   ```bash
   cd Scheduler_Showdown/scheduler-showdown
   ```

3. **Instalar las dependencias** (instala las de los tres workspaces —`engine`, `server` y `client`— de una sola vez):

   ```bash
   npm install
   ```

## Cómo ejecutarlo

### En desarrollo (con recarga automática)

```bash
npm run dev
```

Esto levanta el servidor en `http://localhost:3000` y el cliente en `http://localhost:5173`. Abre `http://localhost:5173` en el navegador: ahí se crea la sala y se juega mientras se desarrolla.

### Para usarlo en clase (modo producción)

```bash
npm run build
npm start
```

El servidor queda escuchando en `http://localhost:3000` y sirve ahí mismo la interfaz ya compilada.

Para que los estudiantes se unan desde sus propios computadores sin depender de la red del salón, usa el reenvío de puertos de VS Code:

1. Abre la vista **Ports** en VS Code y reenvía el puerto **3000**.
2. Marca ese puerto como **Public** (así nadie necesita iniciar sesión para entrar).
3. Copia la dirección pública que te da VS Code (algo como `https://…-3000.….devtunnels.ms`) y ábrela en el navegador del proyector — **no** uses `localhost`, porque esa es la dirección que verán los jugadores en el lobby.
4. Los estudiantes entran a esa misma dirección con el código de la sala.

Si la red del salón bloquea el túnel, el mismo servidor funciona en red local abriendo `http://<IP de tu computador>:3000` desde los otros equipos.

## Cómo correr las pruebas

```bash
npm test
```

Corre las pruebas del motor (algoritmos, generador de preguntas y puntaje) y las pruebas de integración del servidor (flujo completo de una partida por Socket.IO).

## Notas

- Las salas viven solo en memoria: si el servidor se reinicia, se pierden.
- Una sala admite hasta 60 jugadores.
- No hay cuentas de usuario ni base de datos: cada partida es independiente.
