import { io, Socket } from 'socket.io-client';

// Browser builds use the same origin and rely on the host to proxy /socket.io.
// Direct/mobile builds may set VITE_SERVER_URL, but REST /api traffic still needs a reachable proxy.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

const socket: Socket = io(SERVER_URL, {
  // On mobile the connection is cross-origin; withCredentials not needed for this app
  transports: SERVER_URL ? ['websocket'] : ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('[Socket] Connected to server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Socket] Disconnected');
});

export default socket;
