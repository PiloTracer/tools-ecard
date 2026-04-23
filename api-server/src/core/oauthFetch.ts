/**
 * Server-side HTTP(S) for OAuth identity URLs in dev (mkcert, http:// env, etc.).
 * Mirrors front-cards/shared/server/oauth-fetch.ts.
 */
import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';

function useNodeOAuthClient(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const v = process.env.OAUTH_DEV_INSECURE_TLS?.trim().toLowerCase();
  if (v === '0' || v === 'false' || v === 'off') return false;
  return true;
}

function flattenHeaders(raw: RequestInit['headers']): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!raw) return headers;
  if (raw instanceof Headers) {
    raw.forEach((v, k) => {
      headers[k] = v;
    });
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, string>)) {
      if (typeof v === 'string') headers[k] = v;
    }
  }
  return headers;
}

function nodeRequest(
  u: URL,
  method: string,
  headers: Record<string, string>,
  bodyStr: string | undefined,
  useTls: boolean
): Promise<Response> {
  const port = u.port ? Number(u.port) : useTls ? 443 : 80;
  const path = `${u.pathname}${u.search}`;
  const hdrs = {
    ...headers,
    ...(bodyStr != null ? { 'Content-Length': String(Buffer.byteLength(bodyStr)) } : {}),
  };

  return new Promise((resolve, reject) => {
    const lib = useTls ? https : http;
    const opts: http.RequestOptions = {
      hostname: u.hostname,
      port,
      path,
      method,
      headers: hdrs,
    };
    if (useTls) {
      (opts as https.RequestOptions).agent = new https.Agent({ rejectUnauthorized: false });
    }

    const req = lib.request(opts, res => {
      const chunks: Buffer[] = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const h = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v == null) continue;
          if (Array.isArray(v)) {
            for (const item of v) h.append(k, item);
          } else {
            h.set(k, v);
          }
        }
        resolve(
          new Response(buf, {
            status: res.statusCode ?? 0,
            statusText: res.statusMessage,
            headers: h,
          })
        );
      });
    });
    req.on('error', reject);
    if (bodyStr != null) req.write(bodyStr);
    req.end();
  });
}

export function oauthServerFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.href;
  const u = new URL(url);
  const method = init?.method ?? 'GET';
  const headers = flattenHeaders(init?.headers);

  let bodyStr: string | undefined;
  if (init?.body instanceof URLSearchParams) bodyStr = init.body.toString();
  else if (typeof init?.body === 'string') bodyStr = init.body;
  else if (init?.body != null) {
    return fetch(input, init);
  }

  const isHttps = u.protocol === 'https:';
  const isHttp = u.protocol === 'http:';

  if (!useNodeOAuthClient() || (!isHttps && !isHttp)) {
    return fetch(input, init);
  }

  return nodeRequest(u, method, headers, bodyStr, isHttps);
}
