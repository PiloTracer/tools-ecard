/**
 * Server-side HTTP(S) for OAuth identity URLs only.
 * In non-production, uses Node http(s) so mkcert / http:// env URLs do not go through undici fetch()
 * (which can follow redirects to https and then fail TLS verification).
 *
 * SAFETY: In production (NODE_ENV === 'production'), this function ALWAYS uses
 * the standard secure fetch() API with proper TLS certificate validation.
 * The insecure Node.js agent with rejectUnauthorized: false is ONLY used in
 * development environments.
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

function flattenHeaders(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (h instanceof Headers) {
    h.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(h)) {
    for (const [k, v] of h) out[k] = v;
    return out;
  }
  for (const [k, v] of Object.entries(h)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function bodyToString(body: RequestInit['body']): string | undefined {
  if (body == null) return undefined;
  if (body instanceof URLSearchParams) return body.toString();
  if (typeof body === 'string') return body;
  return undefined;
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

/** Same surface as fetch() for OAuth calls to identity host (http or https). */
export function oauthServerFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

  const u = new URL(url);
  const method = init?.method ?? 'GET';
  const headers = flattenHeaders(init?.headers);
  const bodyStr = bodyToString(init?.body);
  if (init?.body != null && bodyStr === undefined) {
    return fetch(input, init);
  }

  const isHttps = u.protocol === 'https:';
  const isHttp = u.protocol === 'http:';

  if (!useNodeOAuthClient() || (!isHttps && !isHttp)) {
    return fetch(input, init);
  }

  return nodeRequest(u, method, headers, bodyStr, isHttps);
}
