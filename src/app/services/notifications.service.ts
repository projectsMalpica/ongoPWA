import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  Messaging
} from 'firebase/messaging';
import { environment } from '../environments/environment';
import { GlobalService } from './global.service';

@Injectable({
  providedIn: 'root'
})
export class PushService {
  private messaging: Messaging | null = null;

  constructor(private global: GlobalService) {}

  async initPush(userId: string): Promise<void> {
    if (!userId) return;

    if (!('Notification' in window)) {
      console.warn('Este navegador no soporta notificaciones.');
      return;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('Este navegador no soporta Service Workers.');
      return;
    }

    const app = initializeApp(environment.firebaseConfig);
    this.messaging = getMessaging(app);

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.warn('Permiso de notificaciones denegado.');
      return;
    }

    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );

    const token = await getToken(this.messaging, {
      vapidKey: environment.firebaseVapidKey,
      serviceWorkerRegistration: registration
    });

    if (!token) return;

    await this.saveDeviceToken(userId, token);

    onMessage(this.messaging, (payload) => {
      console.log('Push recibido en foreground:', payload);

      const title = payload.notification?.title || 'Nueva notificación';
      const body = payload.notification?.body || '';

      new Notification(title, {
        body,
        icon: '/assets/icons/icon-192x192.png'
      });
    });
  }

  private async saveDeviceToken(userId: string, token: string): Promise<void> {
    const pb = this.global.pb;

    const existing = await pb.collection('devices').getFullList({
      filter: `user="${userId}" && token="${token}"`,
      requestKey: null
    });

    if (existing.length) {
      await pb.collection('devices').update(existing[0].id, {
        active: true,
        platform: 'web'
      });
      return;
    }

    await pb.collection('devices').create({
      user: userId,
      token,
      platform: 'web',
      active: true
    });
  }
}
