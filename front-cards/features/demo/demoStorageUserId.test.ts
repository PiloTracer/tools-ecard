import { demoUserStoragePrefix, resolveDemoStorageUserId, sanitizeDemoStorageUserId } from './demoStorageUserId';

describe('demoStorageUserId', () => {
  it('sanitizes ids for storage keys', () => {
    expect(sanitizeDemoStorageUserId('user@example.com')).toBe('user_40example.com');
  });

  it('resolves from OAuth user id', () => {
    expect(resolveDemoStorageUserId({ id: '42', email: 'a@b.com' })).toBe('42');
  });

  it('falls back to email when id missing', () => {
    expect(resolveDemoStorageUserId({ id: '', email: 'a@b.com' })).toBe('a_40b.com');
  });

  it('builds per-user localStorage prefix', () => {
    expect(demoUserStoragePrefix('42')).toBe('ecards:demo:u:42:');
  });
});
