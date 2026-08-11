import { describe, expect, it, vi } from 'vitest';
import { AuthPocketbaseService } from './authPocketbase.service';

function lookupService(getFirstListItem: any) {
  const service = Object.create(AuthPocketbaseService.prototype) as any;
  service.pb = {
    filter: (_template: string, values: any) => `userId="${values.userId}"`,
    collection: () => ({ getFirstListItem })
  };
  service.logProfileError = vi.fn();
  return service;
}

describe('Google OAuth registration state', () => {
  it('returns null and never creates a minimal profile when lookup returns 404', async () => {
    const getFirstListItem = vi.fn().mockRejectedValue({ status: 404 });
    const service = lookupService(getFirstListItem);

    await expect(service.findGoogleProfile('user123', 'client')).resolves.toBeNull();
    expect(getFirstListItem).toHaveBeenCalledTimes(1);
  });

  it('recovers an existing profile without creating a duplicate', async () => {
    const profile = { id: 'profile1', userId: 'user123', profileComplete: true };
    const getFirstListItem = vi.fn().mockResolvedValue(profile);
    const service = lookupService(getFirstListItem);

    await expect(service.findGoogleProfile('user123', 'client')).resolves.toBe(profile);
  });

  it('treats legacy profiles as complete unless explicitly marked false', () => {
    const service = Object.create(AuthPocketbaseService.prototype) as AuthPocketbaseService;

    expect(service.isProfileComplete(null)).toBe(false);
    expect(service.isProfileComplete({ id: 'profile1', profileComplete: false })).toBe(false);
    expect(service.isProfileComplete({ id: 'profile1', profileComplete: true })).toBe(true);
    expect(service.isProfileComplete({ id: 'legacy-profile' })).toBe(true);
    expect(service.isProfileComplete({ id: 'legacy-profile', profileComplete: null })).toBe(true);
  });

  it.each([
    ['client', '/maps'],
    ['partner', '/home-local'],
    ['admin', '/admin']
  ] as const)('navigates an authenticated %s to %s', async (type, destination) => {
    const service = Object.create(AuthPocketbaseService.prototype) as any;
    service.global = {
      loadProfile: vi.fn().mockResolvedValue(undefined),
      initClientesRealtime: vi.fn().mockResolvedValue(undefined),
      initPartnersRealtime: vi.fn().mockResolvedValue(undefined)
    };
    service.router = { navigate: vi.fn().mockResolvedValue(true) };

    await expect(service.resolveAuthenticatedUserDestination({
      needsRegister: false,
      user: { id: 'user123' },
      profile: type === 'admin' ? null : { id: 'profile1' },
      type
    })).resolves.toBe(true);

    expect(service.router.navigate).toHaveBeenCalledWith([destination]);
  });

  it('does not navigate an explicitly incomplete profile', async () => {
    const service = Object.create(AuthPocketbaseService.prototype) as any;
    service.router = { navigate: vi.fn() };

    await expect(service.resolveAuthenticatedUserDestination({
      needsRegister: true,
      user: { id: 'user123' },
      profile: { id: 'profile1', profileComplete: false },
      type: 'client'
    })).resolves.toBe(false);
    expect(service.router.navigate).not.toHaveBeenCalled();
  });

  it('preserves lookup errors other than 404', async () => {
    const error = { status: 403, message: 'Forbidden' };
    const service = lookupService(vi.fn().mockRejectedValue(error));

    await expect(service.findGoogleProfile('user123', 'client')).rejects.toBe(error);
  });

  it('creates exactly one complete profile on Google form submit', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'profile1', profileComplete: true });
    const profileCollection = {
      getFirstListItem: vi.fn().mockRejectedValue({ status: 404 }),
      create,
      update: vi.fn()
    };
    const userCollection = {
      update: vi.fn().mockResolvedValue({
        id: 'user123', email: 'hidden@example.invalid', type: 'client', name: 'Google User'
      })
    };
    const service = Object.create(AuthPocketbaseService.prototype) as any;
    service.pb = {
      authStore: {
        isValid: true,
        token: 'test-token',
        record: { id: 'user123', email: 'hidden@example.invalid', type: 'client' },
        save: vi.fn()
      },
      collection: (name: string) => name === 'users' ? userCollection : profileCollection
    };
    service.persistGoogleSession = vi.fn().mockReturnValue({ id: 'user123', type: 'client' });
    service.clearPendingGoogleRegistrationType = vi.fn();

    await service.completeGoogleRegister('client', {
      userId: 'user123', name: 'Google User', profileComplete: true
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(profileCollection.update).not.toHaveBeenCalled();
  });

  it('updates an incomplete related profile instead of creating a duplicate', async () => {
    const profileCollection = {
      getFirstListItem: vi.fn().mockResolvedValue({
        id: 'profile1', userId: 'user123', profileComplete: false
      }),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 'profile1', profileComplete: true })
    };
    const service = Object.create(AuthPocketbaseService.prototype) as any;
    service.pb = {
      authStore: {
        isValid: true,
        token: 'test-token',
        record: { id: 'user123', email: 'hidden@example.invalid', type: 'client' },
        save: vi.fn()
      },
      collection: (name: string) => name === 'users'
        ? { update: vi.fn().mockResolvedValue({ id: 'user123', type: 'client' }) }
        : profileCollection
    };
    service.persistGoogleSession = vi.fn().mockReturnValue({ id: 'user123', type: 'client' });
    service.clearPendingGoogleRegistrationType = vi.fn();

    await service.completeGoogleRegister('client', {
      userId: 'user123', name: 'Updated User', profileComplete: true
    });

    expect(profileCollection.update).toHaveBeenCalledOnce();
    expect(profileCollection.update).toHaveBeenCalledWith(
      'profile1', expect.objectContaining({ userId: 'user123', profileComplete: true })
    );
    expect(profileCollection.create).not.toHaveBeenCalled();
  });
});
