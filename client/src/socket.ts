import { io } from 'socket.io-client';

export const socket = io(); // mismo origen en desarrollo y en producción
