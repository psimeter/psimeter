/**
 * PsyMeter server entry point.
 *
 * Starts the HTTP + one-way WebSocket server and serves the operator UI. Open
 * the printed URL, choose an intention, and run a session; the generation runs
 * server-side and streams to the browser one-way (spec §7, §8).
 */
import { createApp } from './app.js';

const port = Number(process.env.PSYMETER_PORT ?? 8787);

createApp().listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`PsyMeter server listening on http://localhost:${port}`);
});
