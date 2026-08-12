/**
 * GET /api/bundled-templates/file/<path> — stream a bundled-global file from
 * disk, live.
 *
 * Next's standalone server only serves public/ files that existed at process
 * start, so operator-dropped template packages would need a restart if they
 * were served as static assets. This route reads from the (host-mounted)
 * globals directory on every request instead — drop files on the host and
 * they are immediately downloadable, no rebuild, no restart.
 *
 * Security: the path is confined to public/templates/globals; traversal
 * outside it is rejected. Only .zip/.png/.json are served.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';

export const dynamic = 'force-dynamic';

const GLOBALS_DIR = join(process.cwd(), 'public', 'templates', 'globals');

const CONTENT_TYPES: Record<string, string> = {
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.json': 'application/json',
};

function resolveConfinedPath(segments: string[]): string | null {
  const rel = segments.join('/');
  const abs = normalize(join(GLOBALS_DIR, rel));
  if (abs !== GLOBALS_DIR && !abs.startsWith(GLOBALS_DIR + '/')) return null;
  const ext = abs.slice(abs.lastIndexOf('.')).toLowerCase();
  if (!CONTENT_TYPES[ext]) return null;
  return abs;
}

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const abs = resolveConfinedPath(path ?? []);
  if (!abs) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  try {
    const info = await stat(abs);
    if (!info.isFile()) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const ext = abs.slice(abs.lastIndexOf('.')).toLowerCase();
    const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        'Content-Type': CONTENT_TYPES[ext],
        'Content-Length': String(info.size),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
