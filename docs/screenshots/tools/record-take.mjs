// Records a plain take of the demo app for OpenScreen to edit: the app alone, with no cursor,
// zoom or captions, plus a log of where and when each press happened. OpenScreen draws the
// cursor from the log, zooms on the presses and adds the callouts.
// Usage: node record-take.mjs <port> <frames folder>
// Writes <frames folder>/frames.txt for ffmpeg and <frames folder>/take.json with the pointer
// events (milliseconds into the video) and the time each beat starts (seconds).
import { mkdirSync, writeFileSync } from 'node:fs';

const [debugPort, framesFolder] = process.argv.slice(2);
mkdirSync(framesFolder, { recursive: true });

// Recorded this many times slower and sped back up when encoding, for more frames per second
const SLOW = 3;
// 16:9, so OpenScreen does not crop it, and small enough that the app fills the window
const VIEW = { width: 1120, height: 630 };
// Chrome must be started with --force-device-scale-factor set to this: the screencast only
// follows the scale the browser itself runs at, not one set through the debugger
const SCALE = 1.75;
const realPause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const pause = milliseconds => realPause(milliseconds * SLOW);

const tab = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve));
let nextMessageId = 1;
const pendingReplies = new Map();
const frames = [];
let recordingStartedAt;
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pendingReplies.has(message.id)) {
    pendingReplies.get(message.id)(message.result ?? message.error);
    pendingReplies.delete(message.id);
  }
  if (message.method === 'Page.screencastFrame') {
    const { data, metadata, sessionId } = message.params;
    socket.send(JSON.stringify({ id: nextMessageId++, method: 'Page.screencastFrameAck', params: { sessionId } }));
    if (recordingStartedAt === undefined) return;
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
const run = async (expression) => {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (reply?.exceptionDetails) console.log('script error:', expression, reply.exceptionDetails.exception?.description);
  else if (reply?.result?.value === false || reply?.result?.value === null) console.log('nothing found for:', expression);
  return reply?.result?.value;
};

// Milliseconds into the finished video, right now
const videoNow = () => (Date.now() - recordingStartedAt) / SLOW;
const pointerEvents = [];
const beats = [];
let pointerAt = { x: 0.5, y: 0.55 };
const beat = (callout) => beats.push({ atSec: videoNow() / 1000, callout });

// How long the cursor takes to glide to a press, in video milliseconds
const GLIDE_MS = 650;

// Presses an element of the app: logs where the pointer rests, lets it glide, then presses.
// `find` is page script that returns the element.
const press = async (find, pressWith = 'click') => {
  const target = await run(`(() => { const element = ${find}; if (!element) return null; const box = element.getBoundingClientRect(); `
    + 'return { x: (box.left + box.width / 2) / innerWidth, y: (box.top + box.height / 2) / innerHeight }; })()');
  if (!target) return;
  pointerEvents.push({ at: videoNow(), ...pointerAt });
  await pause(GLIDE_MS);
  pointerEvents.push({ at: videoNow(), ...target, click: true });
  pointerAt = target;
  await run(pressWith === 'mousedown'
    ? `(${find}).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })) || true`
    : `((${find}).click(), true)`);
};

const TEXTS = "[...document.querySelectorAll('h2,h3,h4,h5,h6,p,span')]";
const withText = (selector, text) => `[...document.querySelectorAll('${selector}')].find(element => element.textContent.trim() === '${text}')`;
const switchBeside = label => `(() => { let node = ${TEXTS}.find(element => element.textContent.trim() === '${label}'); `
  + "while (node && !node.querySelector('input[type=\"checkbox\"]')) node = node.parentElement; "
  + "return node?.querySelector('input[type=\"checkbox\"]'); })()";
const scrollTo = (text, offset) => run(`(() => { const element = ${TEXTS}.find(node => node.textContent.trim() === '${text}'); if (!element) return false; `
  + `scrollTo({ top: element.getBoundingClientRect().top + scrollY - ${offset}, behavior: 'smooth' }); return true; })()`);

// A terminal drawn over the page for the API beat, which really sends the request it types
const TERMINAL = `(() => {
  const style = document.createElement('style');
  style.textContent = \`html{scrollbar-width:none}::-webkit-scrollbar{display:none}
    #demo-terminal{position:fixed;left:292px;bottom:22px;width:760px;border-radius:12px;overflow:hidden;z-index:5000;background:#0d0f12;
      box-shadow:0 0 0 1px rgba(255,255,255,.14),0 30px 80px rgba(0,0,0,.7);opacity:0;transform:translateY(26px);transition:opacity 320ms ease,transform 320ms ease}
    #demo-terminal.show{opacity:1;transform:none}
    #demo-terminal header{height:32px;display:flex;align-items:center;gap:7px;padding:0 12px;background:#16191e}
    #demo-terminal header i{width:10px;height:10px;border-radius:50%;background:#333a44}
    #demo-terminal pre{margin:0;padding:16px 18px 18px;min-height:84px;color:#e6edf3;white-space:pre-wrap;font:15px/1.5 'SF Mono',ui-monospace,Menlo,monospace}\`;
  document.head.append(style);
  const terminal = document.createElement('div');
  terminal.id = 'demo-terminal';
  terminal.innerHTML = '<header><i></i><i></i><i></i></header><pre><span style="color:#3fb950">$ </span><span id="demo-typed"></span><span id="demo-reply" style="color:#7d8590"></span></pre>';
  document.body.append(terminal);
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds * ${SLOW}));
  window.showTerminal = async () => { terminal.classList.add('show'); await wait(350); return true; };
  window.hideTerminal = () => { terminal.classList.remove('show'); return true; };
  window.typeCommand = async (command) => {
    for (const character of command) { document.getElementById('demo-typed').textContent += character; await wait(character === ' ' ? 34 : 20); }
    return true;
  };
  window.sendRequest = async (path, body) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    document.getElementById('demo-reply').textContent = '\\nHTTP ' + response.status;
    return true;
  };
  return true;
})()`;

await send('Emulation.setDeviceMetricsOverride', { ...VIEW, deviceScaleFactor: 0, mobile: false });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await send('Page.navigate', { url: 'http://localhost:5199/' });
await realPause(7000);
await run(TERMINAL);
// The take is made on a development address; the API section shows the one a Pod has
await run("(new MutationObserver(() => document.querySelectorAll('code').forEach(code => { if (code.textContent.includes(location.origin)) code.textContent = code.textContent.replaceAll(location.origin, 'http://eightpod.local'); })).observe(document.body, { childList: true, subtree: true }), true)");
// The take opens on a bed that is off
await run("fetch('/api/deviceStatus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ left: { isOn: false } }) }).then(() => true)");
await realPause(7000);
await send('Animation.enable');
await send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });

await send('Page.startScreencast', { format: 'jpeg', quality: 93, maxWidth: Math.ceil(VIEW.width * SCALE), maxHeight: Math.ceil(VIEW.height * SCALE), everyNthFrame: 1 });
recordingStartedAt = Date.now();
pointerEvents.push({ at: 0, ...pointerAt });
await pause(1300);

// Beat 1: on with one press, then two degrees warmer
beat('One tap turns the bed on');
await press(withText('p, span', 'Tap to turn on'));
await pause(1500);
beat('Set the temperature');
await press("document.querySelector('button[aria-label=\"Increase temperature\"]')");
await pause(200);
await press("document.querySelector('button[aria-label=\"Increase temperature\"]')");
await pause(1100);

// Beat 2: a night's schedule
beat('A schedule for every night');
await press("document.querySelector('a[href=\"/schedules\"]')");
await pause(1300);
await scrollTo('Bed on', 250);
await pause(1300);

// Beat 3: warm the bed before the alarm
beat('Wake up warm');
await press("document.querySelector('button[aria-label=\"Alarm options\"]')");
await pause(900);
await press("document.querySelector('[aria-label=\"Warm up before the alarm\"]')?.parentElement.querySelector('[role=\"combobox\"]')", 'mousedown');
await pause(600);
await press(withText('li', '30 min'));
await pause(900);
await press(withText('.MuiDialog-paper button', 'Save'));
await pause(900);

// Beat 4: in-bed detection
beat("Knows when you're in bed");
await press("document.querySelector('a[href=\"/settings\"]')");
await pause(1200);
await scrollTo('In-bed detection', 120);
await pause(900);
await press(switchBeside('Alarm after a long time in bed'));
await pause(1100);

// Beat 5: back on the temperature page, a request from a terminal changes the bed
beat('A local API for anything');
await press("document.querySelector('a[href=\"/temperature\"]') ?? document.querySelector('a[href=\"/\"]')");
await pause(1100);
await run('showTerminal()');
await run(`typeCommand("curl -X POST eightpod.local/api/deviceStatus -d '{\\"left\\": {\\"targetTemperatureF\\": 70}}'")`);
await pause(250);
await run("sendRequest('/api/deviceStatus', { left: { targetTemperatureF: 70 } })");
// The page asks the Pod for its state every five seconds; wait for the dial to show the change
await realPause(5600);
await pause(700);
await run('hideTerminal()');
await pause(1300);

const endSec = videoNow() / 1000;
recordingStartedAt = undefined;
await send('Page.stopScreencast');

const lines = ['ffconcat version 1.0'];
frames.forEach((frame, index) => {
  const duration = (index + 1 < frames.length ? frames[index + 1].at - frame.at : 0.3 * SLOW) / SLOW;
  lines.push(`file '${frame.name}'`, `duration ${Math.max(duration, 0.001).toFixed(5)}`);
});
lines.push(`file '${frames[frames.length - 1].name}'`);
writeFileSync(`${framesFolder}/frames.txt`, lines.join('\n'));
writeFileSync(`${framesFolder}/take.json`, JSON.stringify({ pointerEvents, beats, endSec }, null, 1));
console.log(frames.length, 'frames,', endSec.toFixed(1), 'seconds,', pointerEvents.length, 'pointer events');
await send('Page.close');
socket.close();
