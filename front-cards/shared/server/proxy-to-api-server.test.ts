/**
 * @jest-environment node
 */

import { isServerDemoMode } from './proxy-to-api-server';

describe('proxy demo guard helpers', () => {
  const prevDemo = process.env.DEMO_MODE;
  const prevPublic = process.env.NEXT_PUBLIC_DEMO_MODE;

  afterEach(() => {
    if (prevDemo === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = prevDemo;
    if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
    else process.env.NEXT_PUBLIC_DEMO_MODE = prevPublic;
  });

  it('isServerDemoMode is true when DEMO_MODE is set', () => {
    process.env.DEMO_MODE = 'true';
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    expect(isServerDemoMode()).toBe(true);
  });

  it('isServerDemoMode is true when NEXT_PUBLIC_DEMO_MODE is set', () => {
    delete process.env.DEMO_MODE;
    process.env.NEXT_PUBLIC_DEMO_MODE = '1';
    expect(isServerDemoMode()).toBe(true);
  });

  it('isServerDemoMode is false when both unset', () => {
    delete process.env.DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    expect(isServerDemoMode()).toBe(false);
  });
});
