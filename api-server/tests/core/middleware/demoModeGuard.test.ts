import { isDemoModeEnabled, demoModeGuard } from '../../../src/core/middleware/demoModeGuard';

describe('demoModeGuard', () => {
  const prev = process.env.DEMO_MODE;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.DEMO_MODE;
    } else {
      process.env.DEMO_MODE = prev;
    }
  });

  it('isDemoModeEnabled reads truthy env', () => {
    process.env.DEMO_MODE = 'true';
    expect(isDemoModeEnabled()).toBe(true);
    process.env.DEMO_MODE = '0';
    expect(isDemoModeEnabled()).toBe(false);
  });

  it('rejects mutating /api requests when DEMO_MODE is on', async () => {
    process.env.DEMO_MODE = 'true';
    const send = jest.fn();
    const code = jest.fn(() => ({ send }));
    const reply = { code } as any;
    const request = { method: 'POST', url: '/api/v1/projects' } as any;

    await demoModeGuard(request, reply);

    expect(code).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'demo_mode_readonly' })
    );
  });

  it('allows GET when DEMO_MODE is on', async () => {
    process.env.DEMO_MODE = 'true';
    const send = jest.fn();
    const code = jest.fn(() => ({ send }));
    const reply = { code } as any;
    const request = { method: 'GET', url: '/api/v1/projects' } as any;

    await demoModeGuard(request, reply);

    expect(code).not.toHaveBeenCalled();
  });

  it('allows mutating when DEMO_MODE is off', async () => {
    process.env.DEMO_MODE = 'false';
    const send = jest.fn();
    const code = jest.fn(() => ({ send }));
    const reply = { code } as any;
    const request = { method: 'POST', url: '/api/v1/projects' } as any;

    await demoModeGuard(request, reply);

    expect(code).not.toHaveBeenCalled();
  });
});
