import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalService } from './global.service';
import { PushService } from './push.service';
import { ToastService } from './ToastService.service';
import { NotificationsService } from './NotificationsService.service';

const messagingMocks = vi.hoisted(() => ({
  deleteToken: vi.fn().mockResolvedValue(true),
  getMessaging: vi.fn().mockReturnValue({}),
  getToken: vi.fn().mockResolvedValue('token-new'),
  isSupported: vi.fn().mockResolvedValue(true),
  onMessage: vi.fn()
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn().mockReturnValue({}),
  getApps: vi.fn().mockReturnValue([{}]),
  initializeApp: vi.fn().mockReturnValue({})
}));

vi.mock('firebase/messaging', () => messagingMocks);

describe('PushService', () => {
  let service: PushService;
  let collection: any;
  let globalMock: any;
  let toast: { show: ReturnType<typeof vi.fn> };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    messagingMocks.onMessage.mockReset();
    collection = {
      getList: vi.fn().mockResolvedValue({ items: [] }),
      create: vi.fn().mockResolvedValue({ id: 'device1' }),
      update: vi.fn().mockResolvedValue({ id: 'device1' })
    };
    globalMock = {
      pb: {
        authStore: {
          isValid: true,
          record: { id: 'user1' },
          token: 'pb-token',
          onChange: vi.fn().mockReturnValue(() => undefined)
        },
        filter: vi.fn().mockReturnValue('safe-filter'),
        collection: vi.fn().mockReturnValue(collection)
      }
    };
    toast = { show: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PushService,
        provideRouter([]),
        { provide: GlobalService, useValue: globalMock },
        { provide: ToastService, useValue: toast },
        { provide: NotificationsService, useValue: { handleForegroundPush: vi.fn() } }
      ]
    });
    service = TestBed.inject(PushService);
  });

  async function setSupport(permission: NotificationPermission): Promise<void> {
    vi.spyOn(service as any, 'browserApisAvailable').mockReturnValue(true);
    vi.spyOn(service as any, 'firebaseSupported').mockResolvedValue(true);
    vi.spyOn(service as any, 'permission').mockReturnValue(permission);
  }

  it('reports an unsupported browser', async () => {
    vi.spyOn(service as any, 'browserApisAvailable').mockReturnValue(false);
    expect(await service.refreshStatus()).toBe('unsupported');
  });

  it('keeps permission default without requesting it automatically', async () => {
    await setSupport('default');
    expect(await service.refreshStatus()).toBe('default');
  });

  it('reports granted permission as enabled', async () => {
    await setSupport('granted');
    vi.spyOn(service as any, 'initForegroundMessages').mockResolvedValue(undefined);
    expect(await service.refreshStatus()).toBe('enabled');
  });

  it('reports denied permission as blocked', async () => {
    await setSupport('denied');
    expect(await service.refreshStatus()).toBe('blocked');
  });

  it('registers a token through the authenticated backend endpoint', async () => {
    await (service as any).registerDeviceToken('same-token');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain('/push/register-token');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer pb-token');
  });

  it('surfaces a PocketBase registration error', async () => {
    await setSupport('default');
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') });
    vi.spyOn(service as any, 'obtainToken').mockResolvedValue('new-token');
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({ error: 'Registro no permitido' })
    });

    expect(await service.enableNotifications()).toBe(false);
    expect(service.status()).toBe('error');
    expect(service.errorMessage()).toContain('reglas actuales');
  });

  it('deactivates only the current token before logout', async () => {
    localStorage.setItem('ongo_fcm_registered_token', 'current-token');
    await service.deactivateCurrentDeviceBeforeLogout();
    expect(fetchMock.mock.calls[0][0]).toContain('/push/unregister-token');
    expect(localStorage.getItem('ongo_fcm_registered_token')).toBeNull();
  });

  it('handles a foreground message and its safe click route', async () => {
    await setSupport('granted');
    vi.spyOn(service as any, 'ensureMessaging').mockResolvedValue({});
    let handler: ((payload: any) => void) | undefined;
    messagingMocks.onMessage.mockImplementation((_messaging, callback) => { handler = callback; });
    const close = vi.fn();
    const notificationInstances: any[] = [];
    class NotificationStub {
      onclick: (() => void) | null = null;
      close = close;
      constructor(public title: string, public options: any) { notificationInstances.push(this); }
    }
    vi.stubGlobal('Notification', NotificationStub);
    Object.defineProperty(NotificationStub, 'permission', { value: 'granted' });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await (service as any).initForegroundMessages();
    handler?.({ notification: { title: 'Mensaje', body: 'Hola' }, data: { route: '/matches' } });
    notificationInstances[0].onclick();

    expect(toast.show).toHaveBeenCalledWith('Mensaje: Hola', 'info');
    expect(navigate).toHaveBeenCalledWith('/matches');
  });

  it('accepts known internal routes and rejects arbitrary routes', () => {
    expect(service.resolveSafeRoute({ route: '/chat-detail/abc_123' })).toBe('/chat-detail/abc_123');
    expect(service.resolveSafeRoute({ route: '/admin' })).toBe('/maps');
    expect(service.resolveSafeRoute({ url: 'https://evil.invalid/steal' })).toBe('/maps');
  });

  it('sends a test only for the authenticated user through the protected endpoint', async () => {
    await setSupport('granted');
    localStorage.setItem('ongo_fcm_registered_token', 'registered');
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ devicesFound: 1, sent: 1, failed: 0 })
    });
    expect(await service.sendTestNotification()).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/push/test');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ type: 'test_notification' });
  });
});
