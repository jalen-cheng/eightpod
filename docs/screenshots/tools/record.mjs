// Records the demo stage through Chrome's debugging port. Copy demo-stage.html into app/public
// while recording (it must be served from the same address as the app), and remove it afterwards.
// Usage: node record.mjs <port> <frames folder>
// Frames are saved as JPEGs with a list of their durations for ffmpeg's concat reader.
import { mkdirSync, writeFileSync } from 'node:fs';

const [debugPort, framesFolder] = process.argv.slice(2);
mkdirSync(framesFolder, { recursive: true });
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const tab = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve));
let nextMessageId = 1;
const pendingReplies = new Map();
const frames = [];
let isRecording = false;
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pendingReplies.has(message.id)) {
    pendingReplies.get(message.id)(message.result ?? message.error);
    pendingReplies.delete(message.id);
  }
  if (message.method === 'Page.screencastFrame') {
    const { data, metadata, sessionId } = message.params;
    socket.send(JSON.stringify({ id: nextMessageId++, method: 'Page.screencastFrameAck', params: { sessionId } }));
    if (!isRecording) return;
    const name = `frame_${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(`${framesFolder}/${name}`, Buffer.from(data, 'base64'));
    frames.push({ name, at: metadata.timestamp });
  }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const messageId = nextMessageId++;
  pendingReplies.set(messageId, resolve);
  socket.send(JSON.stringify({ id: messageId, method, params }));
});
// Runs a line of script on the stage and waits for it
const run = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (reply?.exceptionDetails) console.log('script error:', expression, reply.exceptionDetails.exception?.description);
  return reply?.result?.value;
};

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await send('Page.navigate', { url: 'http://localhost:5199/demo-stage.html' });
await pause(7000);
// No scroll bar inside the phone
await run("(() => { const style = appDocument().createElement('style'); style.textContent = 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}'; appDocument().head.append(style); return true })()");
await run("say('Your Eight Sleep Pod, without the cloud.', 'No subscription. No account. It runs on the bed itself.')");
await pause(600);

await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
isRecording = true;
await pause(2800);

// Temperature
await run("say('Set the temperature.', 'A dial, or one degree at a time. The bed answers at once.')");
await pause(900);
for (let press = 0; press < 3; press++) {
  await run("tap(findInApp('button[aria-label*=\"armer\"], button[aria-label*=\"Increase\"], button[aria-label*=\"warmer\"]') ?? [...appDocument().querySelectorAll('button')].find(b => b.querySelector('[data-testid=\"AddIcon\"]')))");
  await pause(350);
}
await pause(1300);

// Power
await run("say('One tap for off. One tap for on.', 'The side buttons on a Pod 5 do the same.')");
await pause(700);
await run("tap(findInApp('button[aria-label=\"Turn off\"]'))");
await pause(2200);
await run("tap(findInApp('p, span', 'Tap to turn on'))");
await pause(2200);

// Schedule
await run("say('Plan the night once.', 'Bed on, changes through the night, and when you wake. A tab per day.')");
await pause(500);
await run("tap(findInApp('a[href=\"/schedules\"]'))");
await pause(2000);
await run("scrollAppTo(findInApp('p, span', 'Bed on'), 330)");
await pause(2200);

// Alarm
await run("say('Wake up warm.', 'The bed heats before the alarm, then vibrates until you are up.')");
await pause(500);
await run("tap(findInApp('button[aria-label=\"Alarm options\"]'))");
await pause(1700);
await run("tap(findInApp('button', 'Ramp up'))");
await pause(1300);
await run("tap(findInApp('button', 'Save') ?? findInApp('button', 'Close'))");
await pause(1600);

// In-bed detection
await run("say('It knows when you are in bed.', 'On when you get in, off after you get out. Pod 5.')");
await pause(500);
await run("tap(findInApp('a[href=\"/settings\"]'))");
await pause(2600);
// In-bed detection fills the bottom of the screen; the section after it stays out of view
await run("scrollAppTo([...appDocument().querySelectorAll('h2,h3,h4,h5,h6,p,span')].find(e => e.textContent.trim() === 'Features'), 740)");
await pause(3000);

// End card
await run("say('Free and open source.', 'github.com/jalen-cheng/eightpod')");
await pause(3200);

isRecording = false;
await send('Page.stopScreencast');

// Each frame is shown until the next one arrived; the last one is held for a moment
const lines = ['ffconcat version 1.0'];
frames.forEach((frame, index) => {
  const duration = index + 1 < frames.length ? frames[index + 1].at - frame.at : 1.2;
  lines.push(`file '${frame.name}'`, `duration ${Math.max(duration, 0.01).toFixed(4)}`);
});
lines.push(`file '${frames[frames.length - 1].name}'`);
writeFileSync(`${framesFolder}/frames.txt`, lines.join('\n'));
console.log(frames.length, 'frames over', (frames[frames.length - 1].at - frames[0].at).toFixed(1), 'seconds');
await send('Page.close');
socket.close();
