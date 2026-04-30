/**
 * Forward authenticated requests from Next Route Handlers to api-server.
 */

import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'ecards_auth';

export function getUpstreamApiBase(): string {
  return (
    process.env.INTERNAL_API_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:7400'
  ).replace(/\/$/, '');
}

const SKIP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
  // Keep `cookie`: api-server auth reads `ecards_auth` via @fastify/cookie; relying only on
  // NextRequest.cookies.get + Bearer missed sessions when cookie parsing differed from the raw header.
  'keep-alive',
]);

export async function proxyRequestToApiServer(
  request: NextRequest,
  apiAbsolutePath: string
): Promise<Response> {
  const url = new URL(request.url);
  const upstreamUrl = `${getUpstreamApiBase()}${apiAbsolutePath}${url.search}`;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (SKIP_HEADERS.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  // Buffer body: streaming + duplex caused empty/failed upstream POSTs in Node fetch → empty client responses.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 0) {
      init.body = buf;
    }
  }

  return fetch(upstreamUrl, init);
}

const SKIP_RESPONSE_HEADERS = new Set(['transfer-encoding', 'connection']);

/**
 * Fetch upstream and return a NextResponse safe for Route Handlers (buffered body + sane headers).
 */
export async function proxyRequestToApiServerAsNextResponse(
  request: NextRequest,
  apiAbsolutePath: string
): Promise<NextResponse> {
  try {
    const res = await proxyRequestToApiServer(request, apiAbsolutePath);
    const buf = await res.arrayBuffer();
    const out = new NextResponse(buf, {
      status: res.status,
      statusText: res.statusText,
    });
    res.headers.forEach((value, key) => {
      if (SKIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
      try {
        out.headers.set(key, value);
      } catch {
        /* ignore headers Next rejects */
      }
    });
    return out;
  } catch (err) {
    console.error('[proxy upstream]', apiAbsolutePath, err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Upstream unavailable',
        success: false,
      },
      { status: 502 }
    );
  }
}
