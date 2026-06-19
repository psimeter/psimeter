import type { WebSocket } from 'ws';

/** Send a JSON message only if the socket is still open (avoids throw-on-closed). */
export function safeSend(ws: WebSocket, obj: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
