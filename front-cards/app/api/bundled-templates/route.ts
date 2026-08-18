/**
 * GET /api/bundled-templates — live listing of the bundled global templates.
 *
 * Reads public/templates/globals/{,demo,prd} from disk on every request, so
 * operator-dropped ZIP packages are picked up without any manifest step.
 * Always 200 — a scan failure returns empty groups instead of breaking the
 * gallery (the client already tolerates empty listings).
 */

import { NextResponse } from 'next/server';
import { scanBundledGlobals } from '@/features/template-textile/services/bundledGlobalsScanner';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const listing = await scanBundledGlobals();
    return NextResponse.json(listing, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.warn('[bundled-templates] scan failed:', error);
    return NextResponse.json({ shared: [], demo: [], prd: [] });
  }
}
