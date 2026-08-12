import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboard',
}));

const mockFetch = jest.fn();
Object.defineProperty(globalThis, 'fetch', { value: mockFetch, writable: true, configurable: true });

function userResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function Probe() {
  const { roles, canManageGlobalTemplates, isAuthenticated } = useAuth();
  return (
    <div data-testid="probe">
      {JSON.stringify({ roles, canManageGlobalTemplates, isAuthenticated })}
    </div>
  );
}

async function renderAndSettle() {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => {
    const text = screen.getByTestId('probe').textContent || '';
    expect(JSON.parse(text).isAuthenticated).toBe(true);
  });
  return JSON.parse(screen.getByTestId('probe').textContent || '{}');
}

describe('AuthContext — app roles (Pass 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('exposes roles and grants canManageGlobalTemplates for appsuper', async () => {
    mockFetch.mockResolvedValue(
      userResponse({ id: 'u1', email: 'a@b.c', roles: ['appsuper'] })
    );

    const state = await renderAndSettle();

    expect(state.roles).toEqual(['appsuper']);
    expect(state.canManageGlobalTemplates).toBe(true);
  });

  it('grants canManageGlobalTemplates for appglobal too', async () => {
    mockFetch.mockResolvedValue(
      userResponse({ id: 'u1', email: 'a@b.c', roles: ['appglobal'] })
    );

    const state = await renderAndSettle();

    expect(state.canManageGlobalTemplates).toBe(true);
  });

  it('denies by default when roles are absent or unknown', async () => {
    mockFetch.mockResolvedValue(userResponse({ id: 'u1', email: 'a@b.c' }));
    const withoutRoles = await renderAndSettle();
    expect(withoutRoles.roles).toEqual([]);
    expect(withoutRoles.canManageGlobalTemplates).toBe(false);
  });

  it('ignores unknown future roles', async () => {
    mockFetch.mockResolvedValue(
      userResponse({ id: 'u1', email: 'a@b.c', roles: ['appfuture'] })
    );

    const state = await renderAndSettle();

    expect(state.roles).toEqual(['appfuture']);
    expect(state.canManageGlobalTemplates).toBe(false);
  });
});
