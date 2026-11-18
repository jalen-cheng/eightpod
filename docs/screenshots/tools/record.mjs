// Records the demo stage through Chrome's debugging port, as frames for ffmpeg.
// Copy demo-stage.html into app/public while recording (it must be served from the same address
// as the app), and remove it afterwards.
// Usage: node record.mjs <port> <frames folder>
// Then: ffmpeg -f concat -safe 0 -i <frames folder>/frames.txt -vf "fps=30,scale=1920:1080,format=yuv420p" -c:v libx264 -crf 18 demo.mp4
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
// Runs a line of script on the stage, waits for it, and says so if it found nothing to act on
const run = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (reply?.exceptionDetails) console.log('script error:', expression, reply.exceptionDetails.exception?.description);
  else if (reply?.result?.value === false) console.log('nothing found for:', expression);
  return reply?.result?.value;
};

const HEADINGS = "[...appDocument().querySelectorAll('h2,h3,h4,h5,h6,p,span')]";
// The card (a Paper) that holds a piece of text, so the camera can frame the whole card
const cardWith = text => `${HEADINGS}.find(element => element.textContent.trim() === '${text}')?.closest('.MuiPaper-root')`;

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await send('Page.navigate', { url: 'http://localhost:5199/demo-stage.html' });
await pause(7000);
// No scroll bar inside the window
await run("(() => { const style = appDocument().createElement('style'); style.textContent = 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}'; appDocument().head.append(style); return true })()");

await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
isRecording = true;
await pause(1400);

// Temperature: zoom in on the dial and warm it up
await run(`zoomTo(${cardWith('Bed temperature')}, 1.5)`);
await pause(700);
for (let step = 0; step < 3; step++) {
  await run("press(findInApp('button[aria-label=\"Increase temperature\"]'))");
  await pause(260);
}
await pause(1300);

// Power: off with the corner button, on again with a press anywhere on the dial
await run("press(findInApp('button[aria-label=\"Turn off\"]'))");
await pause(2100);
await run("press(findInApp('p, span', 'Tap to turn on'))");
await pause(2000);

// Schedule: one night, then the alarm's options
await run('zoomOut()');
await pause(500);
await run("press(findInApp('a[href=\"/schedules\"]'))");
await pause(1900);
await run("scrollAppTo(findInApp('p, span', 'Bed on'), 250)");
await pause(600);
await run(`zoomTo(${cardWith('Bed on')}, 1.45)`);
await pause(1500);
await run("press(findInApp('button[aria-label=\"Alarm options\"]'))");
await pause(1300);
await run("zoomTo(findInApp('.MuiDialog-paper'), 1.45)");
await pause(900);
await run("press(findInApp('button', 'Ramp up'))");
await pause(900);
await run("press(findInApp('[aria-label=\"Turn the bed off when the alarm is dismissed\"]'))");
await pause(1000);
await run("press(findInApp('button', 'Save'))");
await pause(1500);

// Settings: in-bed detection
await run('zoomOut()');
await pause(500);
await run("press(findInApp('a[href=\"/settings\"]'))");
await pause(1900);
await run(`scrollAppTo(${HEADINGS}.find(element => element.textContent.trim() === 'In-bed detection'), 150)`);
await pause(900);
await run(`zoomTo(${cardWith('In-bed detection')}, 1.4)`);
await pause(1600);
// The switch on the same row as a label: the nearest ancestor of the label that holds one
const switchBeside = label => `(() => { let node = ${HEADINGS}.find(element => element.textContent.trim() === '${label}'); `
  + "while (node && !node.querySelector('input[type=\"checkbox\"]')) node = node.parentElement; "
  + "return node?.querySelector('input[type=\"checkbox\"]'); })()";
await run(`press(${switchBeside('Alarm after a long time in bed')})`);
await pause(1700);

// End card
await run('zoomOut()');
await pause(900);
await run('showCard()');
await pause(3000);

isRecording = false;
await send('Page.stopScreencast');

// Each frame is shown until the next one arrived; the last one is held for a moment
const lines = ['ffconcat version 1.0'];
frames.forEach((frame, index) => {
  const duration = index + 1 < frames.length ? frames[index + 1].at - frame.at : 1.0;
  lines.push(`file '${frame.name}'`, `duration ${Math.max(duration, 0.01).toFixed(4)}`);
});
lines.push(`file '${frames[frames.length - 1].name}'`);
writeFileSync(`${framesFolder}/frames.txt`, lines.join('\n'));
console.log(frames.length, 'frames over', (frames[frames.length - 1].at - frames[0].at).toFixed(1), 'seconds');
await send('Page.close');
socket.close();
