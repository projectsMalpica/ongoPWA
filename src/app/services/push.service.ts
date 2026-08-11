import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, Messaging, onMessage } from 'firebase/messaging';
import { environment } from '../environments/environment';
import { GlobalService } from './global.service';
import { ToastService } from './ToastService.service';
import { NotificationsService } from './NotificationsService.service';

export type PushStatus = 'unsupported' | 'default' | 'enabled' | 'blocked' | 'configuration-error' | 'error';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly tokenStorageKey = 'ongo_fcm_registered_token';
  private readonly firebaseScope = '/firebase-cloud-messaging-push-scope';
  private messaging: Messaging | null = null;
  private foregroundReady = false;
  private syncing = false;

  private readonly statusState = signal<PushStatus>('default');
  private readonly busyState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly testResultState = signal<string | null>(null);

  readonly status = this.statusState.asReadonly();
  readonly busy = this.busyState.asReadonly();
  readonly errorMessage = this.errorState.asReadonly();
  readonly testResult = this.testResultState.asReadonly();

  constructor(
    private readonly global: GlobalService,
    private readonly router: Router,
    private readonly toastService: ToastService,
    private readonly notificationsService: NotificationsService
  ) {
    void this.refreshStatus();
    this.global.pb.authStore.onChange(() => {
      if (this.global.pb.authStore.isValid && this.permission() === 'granted') {
        void this.syncGrantedPermission();
      }
    });
  }

  async refreshStatus(): Promise<PushStatus> {
    if (!this.browserApisAvailable() || !(await this.firebaseSupported())) {
      this.statusState.set('unsupported');
    } else if (!environment.firebaseVapidKey) {
      this.statusState.set('configuration-error');
    } else if (this.permission() === 'denied') {
      this.statusState.set('blocked');
    } else if (this.permission() === 'granted') {
      this.statusState.set('enabled');
      await this.initForegroundMessages();
    } else {
      this.statusState.set('default');
    }
    return this.statusState();
  }

  async enableNotifications(): Promise<boolean> {
    this.errorState.set(null);
    const status = await this.refreshStatus();
    if (status === 'unsupported' || status === 'configuration-error' || status === 'blocked') return false;

    this.busyState.set(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        await this.refreshStatus();
        return false;
      }
      const token = await this.obtainToken();
      if (!token) throw new Error('Firebase no devolvió un token para este navegador.');
      await this.registerDeviceToken(token);
      localStorage.setItem(this.tokenStorageKey, token);
      await this.initForegroundMessages();
      this.statusState.set('enabled');
      return true;
    } catch (error: any) {
      this.setError(error);
      return false;
    } finally {
      this.busyState.set(false);
    }
  }

  async syncGrantedPermission(): Promise<void> {
    if (this.syncing || this.permission() !== 'granted' || !this.global.pb.authStore.isValid) return;
    this.syncing = true;
    try {
      const token = await this.obtainToken();
      if (!token) return;
      await this.registerDeviceToken(token);
      localStorage.setItem(this.tokenStorageKey, token);
      this.statusState.set('enabled');
      await this.initForegroundMessages();
    } catch (error: any) {
      this.setError(error);
    } finally {
      this.syncing = false;
    }
  }

  async disableNotifications(): Promise<boolean> {
    this.busyState.set(true);
    this.errorState.set(null);
    try {
      const token = localStorage.getItem(this.tokenStorageKey);
      if (token && this.global.pb.authStore.isValid) await this.deactivateDeviceToken(token);
      if (token) {
        const messaging = await this.ensureMessaging();
        if (messaging) await deleteToken(messaging).catch(() => false);
      }
      localStorage.removeItem(this.tokenStorageKey);
      this.statusState.set(this.permission() === 'denied' ? 'blocked' : 'default');
      return true;
    } catch (error: any) {
      this.setError(error);
      return false;
    } finally {
      this.busyState.set(false);
    }
  }

  async deactivateCurrentDeviceBeforeLogout(): Promise<void> {
    const token = localStorage.getItem(this.tokenStorageKey);
    if (!token || !this.global.pb.authStore.isValid) return;
    try {
      await this.deactivateDeviceToken(token);
      localStorage.removeItem(this.tokenStorageKey);
    } catch (error) {
      console.warn('[Push] No se pudo desactivar el dispositivo; el logout continuará.', error);
    }
  }

  resolveSafeRoute(data: Record<string, unknown> | undefined): string {
    const candidate = typeof data?.['route'] === 'string'
      ? data['route']
      : typeof data?.['url'] === 'string' ? data['url'] : '';
    if (!candidate) return this.routeForType(data);
    try {
      const url = new URL(candidate, window.location.origin);
      if (url.origin !== window.location.origin) return '/maps';
      const route = url.pathname;
      const allowed = [
        /^\/maps$/, /^\/matches$/, /^\/chat$/, /^\/chat-detail\/[A-Za-z0-9_-]+$/,
        /^\/my-orders$/, /^\/partner-pending-orders$/, /^\/wallet-history$/,
        /^\/wallet-partner$/, /^\/profile(?:-local)?$/, /^\/home-local$/,
        /^\/notifications$/
      ];
      return allowed.some(pattern => pattern.test(route)) ? route : '/maps';
    } catch {
      return '/maps';
    }
  }

  canSendTest(): boolean {
    const type = this.global.pb.authStore.record?.['type'];
    return !environment.production || type === 'admin';
  }

  async sendTestNotification(): Promise<boolean> {
    if (this.busyState() || !this.canSendTest()) return false;
    this.testResultState.set(null);
    this.errorState.set(null);
    if (!this.global.pb.authStore.isValid) {
      this.errorState.set('Debes iniciar sesión para enviar una prueba.');
      return false;
    }
    if (this.permission() !== 'granted') {
      this.errorState.set('Activa primero las notificaciones en este dispositivo.');
      return false;
    }
    if (!localStorage.getItem(this.tokenStorageKey)) {
      await this.syncGrantedPermission();
    }
    this.busyState.set(true);
    try {
      const response = await this.apiRequest('/api/push/test', {
        method: 'POST',
        body: JSON.stringify({ type: 'test_notification' })
      });
      this.testResultState.set(
        `Prueba creada. Dispositivos: ${response['devicesFound'] ?? 0}; enviados: ${response['sent'] ?? 0}; fallidos: ${response['failed'] ?? 0}.`
      );
      return true;
    } catch (error: any) {
      this.setError(error);
      return false;
    } finally {
      this.busyState.set(false);
    }
  }

  async notifyMessage(messageId: string): Promise<void> {
    if (!messageId || !this.global.pb.authStore.isValid) return;
    await this.apiRequest('/notifications/message', {
      method: 'POST',
      body: JSON.stringify({ messageId })
    });
  }

  private async initForegroundMessages(): Promise<void> {
    if (this.foregroundReady || this.permission() !== 'granted') return;
    const messaging = await this.ensureMessaging();
    if (!messaging) return;
    onMessage(messaging, payload => {
      const title = payload.notification?.title || payload.data?.['title'] || 'OnGo';
      const body = payload.notification?.body || payload.data?.['body'] || 'Nueva notificación';
      this.toastService.show(`${title}: ${body}`, 'info');
      this.notificationsService.handleForegroundPush(
        typeof payload.data?.['notificationId'] === 'string' ? payload.data['notificationId'] : undefined
      );
      const notification = new Notification(title, {
        body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        data: payload.data || {}
      });
      notification.onclick = () => {
        notification.close();
        void this.router.navigateByUrl(this.resolveSafeRoute(payload.data));
      };
    });
    this.foregroundReady = true;
  }

  private async obtainToken(): Promise<string> {
    if (!environment.firebaseVapidKey || !this.global.pb.authStore.isValid) return '';
    const messaging = await this.ensureMessaging();
    if (!messaging) return '';
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: this.firebaseScope
    });
    return getToken(messaging, {
      vapidKey: environment.firebaseVapidKey,
      serviceWorkerRegistration: registration
    });
  }

  private async registerDeviceToken(token: string): Promise<void> {
    if (!this.global.pb.authStore.isValid) throw new Error('Debes iniciar sesión para activar notificaciones.');
    await this.apiRequest('/push/register-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform: 'web' })
    });
  }

  private async deactivateDeviceToken(token: string): Promise<void> {
    if (!this.global.pb.authStore.isValid) return;
    await this.apiRequest('/push/unregister-token', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  private routeForType(data: Record<string, unknown> | undefined): string {
    const type = String(data?.['type'] || '');
    const referenceId = String(data?.['senderId'] || data?.['referenceId'] || '');
    if (type === 'new_message' || type === 'message') {
      return referenceId ? `/chat-detail/${encodeURIComponent(referenceId)}` : '/chat';
    }
    if (type === 'new_match' || type === 'match') return '/matches';
    if (type.startsWith('wallet_recharge_')) return '/wallet-history';
    if (type.startsWith('reservation_')) return '/my-orders';
    if (type.startsWith('order_') || type === 'gift_received' || type === 'ticket_received') return '/my-orders';
    return '/notifications';
  }

  private async apiRequest(path: string, init: RequestInit): Promise<Record<string, any>> {
    const token = this.global.pb.authStore.token;
    const response = await fetch(`${environment.pushApiBase}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw { status: response.status, message: body.error || 'El servicio push rechazó la solicitud.', response: body };
    }
    return body;
  }

  private async ensureMessaging(): Promise<Messaging | null> {
    if (this.messaging) return this.messaging;
    if (!(await this.firebaseSupported())) return null;
    const app = getApps().length ? getApp() : initializeApp(environment.firebaseConfig);
    this.messaging = getMessaging(app);
    return this.messaging;
  }

  private permission(): NotificationPermission {
    return typeof Notification === 'undefined' ? 'denied' : Notification.permission;
  }

  private browserApisAvailable(): boolean {
    return typeof window !== 'undefined' && window.isSecureContext &&
      'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  private async firebaseSupported(): Promise<boolean> {
    return this.browserApisAvailable() && isSupported().catch(() => false);
  }

  private setError(error: any): void {
    const status = error?.status || 0;
    const detail = error?.response?.data || {};
    const message = status === 403
      ? 'Las reglas actuales no permiten registrar este dispositivo.'
      : error?.message || 'No se pudieron configurar las notificaciones.';
    console.error('[Push] Error de configuración:', { status, message, data: detail });
    this.errorState.set(message);
    this.statusState.set('error');
  }
}
