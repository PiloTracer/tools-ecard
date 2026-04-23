/**
 * Run Next without `node -r preload … next` on the CLI.
 * Next 15+ can emit invalid NODE_OPTIONS for workers when the parent used `-r` (see vercel/next.js#77550).
 * Also strips `-r` / `--require` from NODE_OPTIONS (e.g. APM agents) before spawning Next.
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');

require('./preload-root-env.cjs');

// Monorepo root `.env` sets `PORT` for the API (e.g. 4000). Next.js uses `PORT` for its listen port — use `FRONTEND_PORT` when set.
if (process.env.FRONTEND_PORT) {
  process.env.PORT = String(process.env.FRONTEND_PORT).trim();
}

function stripRequireFlagsFromNodeOptions() {
  const raw = process.env.NODE_OPTIONS;
  if (!raw || typeof raw !== 'string') return;
  const kept = [];
  const parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const u = p.replace(/^"|"$/g, '');
    if (u === '-r' || u === '--require') {
      i += 1;
      continue;
    }
    if (
      /^-r[=]/.test(u) ||
      /^--require[=]/.test(u) ||
      /^-r\./.test(u) ||
      /^-r\//.test(u) ||
      /^-r\\\\/.test(u)
    ) {
      continue;
    }
    kept.push(p);
  }
  if (kept.length) process.env.NODE_OPTIONS = kept.join(' ');
  else delete process.env.NODE_OPTIONS;
}

stripRequireFlagsFromNodeOptions();

const nextBin = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
const args = process.argv.slice(2);
const child = spawn(process.execPath, [nextBin, ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

child.on('close', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code === null || code === undefined ? 1 : code);
});
