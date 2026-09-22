import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { registrarHandlers } from './handlers.js';
import { iniciarLimpiezaPeriodica } from './salas.js';

const app = express();
const http = createServer(app);
const io = new Server(http, {
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
});

const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
app.use(express.static(dist));
app.use((_req, res) => res.sendFile('index.html', { root: dist })); // rutas del SPA

registrarHandlers(io);
iniciarLimpiezaPeriodica();

const PORT = Number(process.env.PORT ?? 3000);
http.listen(PORT, '0.0.0.0', () => console.log(`Scheduler Showdown en el puerto ${PORT}`));
