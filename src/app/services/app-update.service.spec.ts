import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { BehaviorSubject, Subject } from 'rxjs';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { AppUpdateService } from './app-update.service';

class SwUpdateStub {
  isEnabled = true;
  versionUpdates = new Subject<VersionEvent>();
  unrecoverable = new Subject<{ reason: string }>();
  checkForUpdate = vi.fn().mockResolvedValue(false);
}

describe('AppUpdateService', () => {
  let swUpdate: SwUpdateStub;
  let stable: BehaviorSubject<boolean>;

  function createService(enabled = true): AppUpdateService {
    swUpdate = new SwUpdateStub();
    swUpdate.isEnabled = enabled;
    stable = new BehaviorSubject(false);

    TestBed.configureTestingModule({
      providers: [
        AppUpdateService,
        { provide: SwUpdate, useValue: swUpdate },
        { provide: ApplicationRef, useValue: { isStable: stable.asObservable() } }
      ]
    });
    return TestBed.inject(AppUpdateService);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  it('does nothing when Angular Service Worker is disabled', () => {
    const service = createService(false);
    stable.next(true);

    expect(service.notice()).toBeNull();
    expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
  });

  it('does not notify for VERSION_DETECTED', () => {
    const service = createService();
    swUpdate.versionUpdates.next({
      type: 'VERSION_DETECTED',
      version: { hash: 'next', appData: undefined }
    });

    expect(service.notice()).toBeNull();
  });

  it('shows one notification when VERSION_READY arrives', () => {
    const service = createService();
    swUpdate.versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'current', appData: undefined },
      latestVersion: { hash: 'next', appData: undefined }
    });

    expect(service.updateAvailable()).toBe(true);
    expect(service.currentVersionHash()).toBe('current');
    expect(service.latestVersionHash()).toBe('next');
  });

  it('dismisses only the current hash for the active session', () => {
    const service = createService();
    const ready = {
      type: 'VERSION_READY' as const,
      currentVersion: { hash: 'current', appData: undefined },
      latestVersion: { hash: 'next', appData: undefined }
    };
    localStorage.setItem('auth-test', 'preserved');
    swUpdate.versionUpdates.next(ready);

    service.dismissUpdate();
    swUpdate.versionUpdates.next(ready);

    expect(service.notice()).toBeNull();
    expect(sessionStorage.getItem('ongo_dismissed_update_hash')).toBe('next');
    expect(localStorage.getItem('auth-test')).toBe('preserved');
  });

  it('prevents a double reload request and does not clear storage', () => {
    const service = createService();
    const reload = vi.spyOn(service as any, 'reloadPage').mockImplementation(() => undefined);
    localStorage.setItem('auth-test', 'preserved');

    service.reloadNow();
    service.reloadNow();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(service.isUpdating()).toBe(true);
    expect(localStorage.getItem('auth-test')).toBe('preserved');
  });

  it('ignores check errors and leaves the application usable', async () => {
    const service = createService();
    swUpdate.checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    stable.next(true);
    await Promise.resolve();

    expect(service.notice()).toBeNull();
  });

  it('shows the reload-only notice for an unrecoverable state', () => {
    const service = createService();
    swUpdate.unrecoverable.next({ reason: 'missing cached chunk' });

    expect(service.unrecoverable()).toBe(true);
    expect(service.updateAvailable()).toBe(false);
  });

  it('is a singleton and does not duplicate the listener when injected twice', () => {
    const service = createService();
    const sameService = TestBed.inject(AppUpdateService);

    expect(sameService).toBe(service);
    expect((swUpdate.versionUpdates as any).observers).toHaveLength(1);
  });
});
