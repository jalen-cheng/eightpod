// A small MCP client for OpenScreen's stdio server, so its tools can be called from a script.
// Usage: node mcp.mjs list            -> tool names and descriptions
//        node mcp.mjs schema <tool>   -> one tool's input schema
//        node mcp.mjs call <calls.json>  -> runs [{ "tool": ..., "args": {...} }, ...] in order,
//                                           printing each result; "$name" strings in args are
//                                           replaced by values saved with "save": {"name": "path.in.result"}
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXECUTABLE = '/Applications/Openscreen.app/Contents/MacOS/Openscreen';
const [mode, argument] = process.argv.slice(2);
const server = spawn(EXECUTABLE, ['mcp'], { stdio: ['pipe', 'pipe', 'inherit'] });

let nextId = 1;
let buffered = '';
const pending = new Map();
server.stdout.on('data', (chunk) => {
  buffered += chunk.toString();
  let newline;
  while ((newline = buffered.indexOf('\n')) >= 0) {
    const line = buffered.slice(0, newline).trim();
    buffered = buffered.slice(newline + 1);
    if (!line.startsWith('{')) continue;
    const message = JSON.parse(line);
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  }
});
const request = (method, params) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
});
const notify = (method, params) => server.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);

await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'script', version: '1' } });
notify('notifications/initialized', {});

// Reads "a.b.c" out of an object
let imageCount = 0;
const dig = (value, path) => path.split('.').reduce((found, key) => found?.[key], value);

if (mode === 'list' || mode === 'schema') {
  const { result } = await request('tools/list', {});
  for (const tool of result.tools) {
    if (mode === 'list') console.log(`${tool.name}: ${tool.description.split('\n')[0].slice(0, 150)}`);
    else if (tool.name === argument) console.log(tool.description, '\n', JSON.stringify(tool.inputSchema, null, 1));
  }
} else if (mode === 'call') {
  const saved = {};
  const fill = value => JSON.parse(JSON.stringify(value), (_key, entry) => (
    typeof entry === 'string' && entry.startsWith('$') && entry.slice(1) in saved ? saved[entry.slice(1)] : entry));
  for (const call of JSON.parse(readFileSync(argument, 'utf8'))) {
    const reply = await request('tools/call', { name: call.tool, arguments: fill(call.args ?? {}) });
    const text = reply.result?.content?.filter(part => part.type === 'text').map(part => part.text).join('\n') ?? JSON.stringify(reply.error);
    console.log(`--- ${call.tool}${reply.result?.isError ? ' (error)' : ''}\n${text.slice(0, call.show ?? 1500)}`);
    if (call.save) {
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = {}; }
      for (const [name, path] of Object.entries(call.save)) saved[name] = dig(parsed, path);
    }
    for (const part of reply.result?.content ?? []) {
      if (part.type === 'image' && call.imagePrefix) {
        const { writeFileSync } = await import('node:fs');
        imageCount = (globalThis.imageCount ?? 0) + 1; globalThis.imageCount = imageCount;
        const file = `${call.imagePrefix}_${String(imageCount).padStart(2, '0')}.${part.mimeType?.includes('jpeg') ? 'jpg' : 'png'}`;
        writeFileSync(file, Buffer.from(part.data, 'base64'));
        console.log('image saved', file);
      }
    }
  }
}
server.stdin.end();
server.kill();
process.exit(0);
