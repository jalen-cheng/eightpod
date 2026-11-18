// Records the demo stage through Chrome's debugging port, as frames for ffmpeg.
// Copy demo-stage.html into app/public while recording (it must be served from the same address
// as the app), and remove it afterwards.
// Usage: node record.mjs <port> <frames folder>
// Then: ffmpeg -f concat -safe 0 -i <frames folder>/frames.txt -vf "fps=60,scale=1920:1080,format=yuv420p" -c:v libx264 -crf 18 demo.mp4
import { mkdirSync, writeFileSync } from 'node:fs';

const [debugPort, framesFolder] = process.argv.slice(2);
mkdirSync(framesFolder, { recursive: true });
// Everything is recorded this many times slower and sped back up when encoding, so the finished
// video has that many times more frames per second than Chrome delivers
const SLOW = 2;
const realPause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const pause = milliseconds => realPause(milliseconds * SLOW);

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
await realPause(7000);
// Slow motion: the stage's timers, and every transition and animation on the page
await send('Animation.enable');
await send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
await run(`window.SLOW = ${SLOW}`);
// No scroll bar inside the window
await run("(() => { const style = appDocument().createElement('style'); style.textContent = 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}'; appDocument().head.append(style); return true })()");

await run("caption('Your Eight Sleep Pod, run from your own network')");
await pause(400);
await send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
isRecording = true;
await pause(1500);

// Temperature and power, on the one card
await run("caption('Set the temperature')");
await run(`zoomTo(${cardWith('Bed temperature')}, 1.22)`);
await pause(600);
await run("press(findInApp('button[aria-label=\"Increase temperature\"]'))");
await pause(160);
await run("press(findInApp('button[aria-label=\"Increase temperature\"]'))");
await pause(900);
await run("caption('One tap for off, one for on')");
await run("press(findInApp('button[aria-label=\"Turn off\"]'))");
await pause(1500);
await run("press(findInApp('p, span', 'Tap to turn on'))");
await pause(1400);

// Schedule
await run('zoomOut()');
await run("caption('A schedule for every night')");
await run("press(findInApp('a[href=\"/schedules\"]'))");
await pause(1300);
await run("scrollAppTo(findInApp('p, span', 'Bed on'), 250)");
await pause(500);
await run(`zoomTo(${cardWith('Bed on')}, 1.2)`);
await pause(1300);

// Alarm: warm the bed before it goes off
await run("caption('Wake up warm: the bed heats before the alarm')");
await run("press(findInApp('button[aria-label=\"Alarm options\"]'))");
await pause(1000);
await run("press(findInApp('[aria-label=\"Warm up before the alarm\"]')?.parentElement.querySelector('[role=\"combobox\"]'), 'mousedown')");
await pause(700);
await run("press(findInApp('li', '30 min'))");
await pause(1000);
await run("press(findInApp('.MuiDialog-paper button', 'Save'))");
await pause(1200);

// In-bed detection
await run('zoomOut()');
await run("caption('It knows when you are in bed (Pod 5)')");
await run("press(findInApp('a[href=\"/settings\"]'))");
await pause(1300);
await run(`scrollAppTo(${HEADINGS}.find(element => element.textContent.trim() === 'In-bed detection'), 150)`);
await pause(700);
await run(`zoomTo(${cardWith('In-bed detection')}, 1.2)`);
await pause(1000);
// The switch on the same row as a label: the nearest ancestor of the label that holds one
const switchBeside = label => `(() => { let node = ${HEADINGS}.find(element => element.textContent.trim() === '${label}'); `
  + "while (node && !node.querySelector('input[type=\"checkbox\"]')) node = node.parentElement; "
  + "return node?.querySelector('input[type=\"checkbox\"]'); })()";
await run(`press(${switchBeside('Alarm after a long time in bed')})`);
await pause(1300);

// The API: a request typed in a terminal changes the bed
await run("caption('A local API for scripts, Shortcuts and assistants')");
// The recording is made on a development address; show the one a Pod has
await run("(() => { appDocument().querySelectorAll('code').forEach(code => { code.textContent = code.textContent.replaceAll(appFrame.contentWindow.location.origin, 'http://eightpod.local'); }); return true })()");
await run(`scrollAppTo(${HEADINGS}.find(element => element.textContent.trim() === 'API'), 330)`);
await pause(900);
await run('zoomOut()');
await run('showTerminal()');
await run(`typeCommand("curl -X POST eightpod.local/api/deviceStatus -d '{\\"left\\": {\\"targetTemperatureF\\": 70}}'")`);
await pause(250);
await run("sendRequest('/api/deviceStatus', { left: { targetTemperatureF: 70 } })");
await pause(900);
await run('hideTerminal()');
await run("press(findInApp('a[href=\"/temperature\"]') ?? findInApp('a[href=\"/\"]'))");
await pause(1900);

// End card
await run('zoomOut()');
await pause(300);
await run('showCard()');
await pause(2400);

isRecording = false;
await send('Page.stopScreencast');

// Each frame is shown until the next one arrived; the last one is held for a moment
const lines = ['ffconcat version 1.0'];
frames.forEach((frame, index) => {
  const duration = (index + 1 < frames.length ? frames[index + 1].at - frame.at : 1.0 * SLOW) / SLOW;
  lines.push(`file '${frame.name}'`, `duration ${Math.max(duration, 0.001).toFixed(5)}`);
});
lines.push(`file '${frames[frames.length - 1].name}'`);
writeFileSync(`${framesFolder}/frames.txt`, lines.join('\n'));
console.log(frames.length, 'frames for', ((frames[frames.length - 1].at - frames[0].at) / SLOW).toFixed(1), 'seconds of video');
await send('Page.close');
socket.close();
