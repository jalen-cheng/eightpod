// Renders frame.html (screenshots inside phone frames) to PNGs with a transparent background.
// Usage: node frame.mjs <port> <output folder> <folder of captured screenshots>
import { writeFileSync } from 'node:fs';

const [debugPort, outputFolder, shotsFolder] = process.argv.slice(2);
const SHOTS = ['temperature', 'schedule', 'alarm_options', 'nights', 'settings'];
// The four that stand for the app in the README
const OVERVIEW_SHOTS = ['temperature', 'schedule', 'nights', 'settings'];
const pages = [
  { name: 'overview', query: `shots=${OVERVIEW_SHOTS.join(',')}&captions=1` },
  ...SHOTS.map(shot => ({ name: shot, query: `shots=${shot}` })),
];
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const tab = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve));
let nextMessageId = 1;
const pendingReplies = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pendingReplies.has(message.id)) {
    pendingReplies.get(message.id)(message.result ?? message.error);
    pendingReplies.delete(message.id);
  }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const messageId = nextMessageId++;
  pendingReplies.set(messageId, resolve);
  socket.send(JSON.stringify({ id: messageId, method, params }));
});

await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
for (const page of pages) {
  await send('Emulation.setDeviceMetricsOverride', { width: 2400, height: 1200, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: `file://${import.meta.dirname}/frame.html?${page.query}&folder=file://${shotsFolder}` });
  await pause(1500);
  const size = await send('Runtime.evaluate', { expression: 'JSON.stringify([document.body.offsetWidth, document.body.offsetHeight])', returnByValue: true });
  const [width, height] = JSON.parse(size.result.value);
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(`${outputFolder}/${page.name}.png`, Buffer.from(data, 'base64'));
  console.log('saved', page.name, width, height);
}
await send('Page.close');
socket.close();
