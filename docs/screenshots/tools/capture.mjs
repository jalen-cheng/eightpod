// Takes phone-sized screenshots of pages through Chrome's debugging port.
// Usage: node capture.mjs <port> <output folder> '<json list of {name, url, script?, waitMs?, fullPage?}>'
import { writeFileSync } from 'node:fs';

const [debugPort, outputFolder, shotsJson] = process.argv.slice(2);
const shots = JSON.parse(shotsJson);
const PHONE = { width: Number(process.env.CAPTURE_WIDTH ?? 390), height: Number(process.env.CAPTURE_HEIGHT ?? 844), deviceScaleFactor: 2, mobile: true };
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
// Sends one debugger command and waits for its reply
const send = (method, params = {}) => new Promise((resolve) => {
  const messageId = nextMessageId++;
  pendingReplies.set(messageId, resolve);
  socket.send(JSON.stringify({ id: messageId, method, params }));
});

await send('Emulation.setDeviceMetricsOverride', PHONE);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
for (const shot of shots) {
  await send('Page.navigate', { url: shot.url });
  await pause(shot.waitMs ?? 5000);
  if (shot.script) {
    const result = await send('Runtime.evaluate', { expression: shot.script, awaitPromise: true, returnByValue: true });
    console.log(shot.name, 'script ->', JSON.stringify(result?.result?.value ?? result));
    await pause(1500);
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: Boolean(shot.fullPage) });
  writeFileSync(`${outputFolder}/${shot.name}.png`, Buffer.from(data, 'base64'));
  console.log('saved', shot.name);
}
await send('Page.close');
socket.close();
