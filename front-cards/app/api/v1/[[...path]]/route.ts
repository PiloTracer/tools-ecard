import { NextRequest } from 'next/server';
import { proxyRequestToApiServerAsNextResponse } from '@/shared/server/proxy-to-api-server';

async function handle(request: NextRequest, pathSegments: string[]) {
  const tail = pathSegments.length ? pathSegments.join('/') : '';
  const apiPath = tail ? `/api/v1/${tail}` : '/api/v1';
  return proxyRequestToApiServerAsNextResponse(request, apiPath);
}
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return handle(request, path);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return handle(request, path);
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return handle(request, path);
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return handle(request, path);
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  return handle(request, path);
}
