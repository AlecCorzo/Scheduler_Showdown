import { create } from 'zustand';
import { socket } from './socket.js';
import type { Estado } from './tipos.js';

interface EstadoStore {
  estado: Estado | null;
  recibidoEn: number;
  conectado: boolean;
}

export const useStore = create<EstadoStore>(() => ({
  estado: null,
  recibidoEn: 0,
  conectado: socket.connected,
}));

// En cada connect (incluido el primero después de un corte) se reenvían las
// credenciales guardadas, si las hay (sección 9.3). La recuperación de estado
// de Socket.IO es un extra: esta resincronización por token es la que manda.
socket.on('connect', () => {
  useStore.setState({ conectado: true });
  const codigo = sessionStorage.getItem('codigo');
  const tokenHost = sessionStorage.getItem('tokenHost');
  const token = sessionStorage.getItem('token');
  if (codigo && tokenHost) {
    socket.emit('host:reanudar', { codigo, tokenHost }, () => {});
  } else if (codigo && token) {
    socket.emit('jugador:unirse', { codigo, token }, () => {});
  }
});

socket.on('disconnect', () => useStore.setState({ conectado: false }));

socket.on('sala:estado', (estado: Estado) => {
  useStore.setState({ estado, recibidoEn: performance.now() });
});
