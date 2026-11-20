#!/usr/bin/env node
// An MCP server for a SevenSleep Pod. It runs on your computer, is started by your AI client
// over standard input and output, and turns each tool call into one request to the Pod's own
// API on your network. Where the Pod is comes from SEVENSLEEP_URL (http://sevensleep.local
// when unset). Set SEVENSLEEP_READ_ONLY=1 to leave out every tool that changes the bed.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { TOOLS, describeResult } from './tools.mjs';

const POD_URL = (process.env.SEVENSLEEP_URL ?? 'http://sevensleep.local').replace(/\/+$/, '');
const IS_READ_ONLY = ['1', 'true'].includes(process.env.SEVENSLEEP_READ_ONLY ?? '');
const REQUEST_TIMEOUT_MS = 15_000;

// One field of a tool's input, from the plain description in tools.mjs to the SDK's schema
const toSchema = (field) => {
  let schema;
  if (field.type === 'enum') schema = z.enum(field.values);
  else if (field.type === 'boolean') schema = z.boolean();
  else if (field.type === 'string') schema = field.pattern ? z.string().regex(new RegExp(field.pattern)) : z.string();
  else {
    schema = z.number().min(field.min).max(field.max);
    if (field.integer) schema = schema.int();
  }
  schema = schema.describe(field.description);
  return field.optional ? schema.optional() : schema;
};

// Sends one request to the Pod and returns its answer, parsed when it is JSON
const askPod = async ({ method, path, body }) => {
  const response = await fetch(`${POD_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let answer;
  try {
    answer = text ? JSON.parse(text) : undefined;
  } catch {
    answer = text;
  }
  if (!response.ok) {
    const reason = typeof answer === 'object' ? JSON.stringify(answer) : answer ?? '';
    throw new Error(`The Pod refused it (${response.status}). ${reason}`);
  }
  return answer;
};

const server = new McpServer({ name: 'sevensleep', version: '1.0.0' });

for (const tool of TOOLS) {
  if (IS_READ_ONLY && tool.changesTheBed) continue;
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: Object.fromEntries(Object.entries(tool.input).map(([name, field]) => [name, toSchema(field)])),
      // Clients use these to decide what to ask the person about before running
      annotations: { readOnlyHint: !tool.changesTheBed, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const answer = await askPod(tool.request(args));
        return { content: [{ type: 'text', text: describeResult(tool, args, answer) }] };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const hint = error?.name === 'TimeoutError' || error?.cause ? ` Could not reach the Pod at ${POD_URL}: is this computer on the same network?` : '';
        return { content: [{ type: 'text', text: `${reason}${hint}` }], isError: true };
      }
    },
  );
}

await server.connect(new StdioServerTransport());
