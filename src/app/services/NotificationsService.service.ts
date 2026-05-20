import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GlobalService } from './global.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private notificationsSubject = new BehaviorSubject<any[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private global: GlobalService) {}

  async initRealtimeNotifications(userId: string) {
  const pb = this.global.pb;

  if (!userId) return;

  await this.loadNotifications(userId);

  await pb.collection('notifications').unsubscribe('*');

  await pb.collection('notifications').subscribe('*', async (e) => {
    const notification = e.record;

    if (notification?.['user'] !== userId) return;

    if (e.action === 'create') {
      const current = this.notificationsSubject.value;

      this.notificationsSubject.next([
        notification,
        ...current
      ]);

      this.updateUnreadCount();
      this.playNotificationSound();

      console.log('Nueva notificación:', notification);
    }

    if (e.action === 'update') {
      const updated = this.notificationsSubject.value.map((item) =>
        item.id === notification.id ? notification : item
      );

      this.notificationsSubject.next(updated);
      this.updateUnreadCount();
    }

    if (e.action === 'delete') {
      const filtered = this.notificationsSubject.value.filter(
        (item) => item.id !== notification.id
      );

      this.notificationsSubject.next(filtered);
      this.updateUnreadCount();
    }
  });
}

  async loadNotifications(userId: string) {
  const pb = this.global.pb;

  const records = await pb.collection('notifications').getFullList({
    filter: `user="${userId}"`,
    sort: '-created',
    expand: 'fromUser'
  });

  this.notificationsSubject.next(records);
  this.updateUnreadCount();
}

  async markAsRead(notificationId: string) {
    const pb = this.global.pb;

    const updated = await pb.collection('notifications').update(notificationId, {
      read: true
    });

    const list = this.notificationsSubject.value.map((item) =>
      item.id === notificationId ? updated : item
    );

    this.notificationsSubject.next(list);
    this.updateUnreadCount();
  }

  async markAllAsRead(userId: string) {
    const unread = this.notificationsSubject.value.filter(
      (item) => item.user === userId && !item.read
    );

    for (const item of unread) {
      await this.markAsRead(item.id);
    }
  }

  private updateUnreadCount() {
    const count = this.notificationsSubject.value.filter(
      (item) => !item.read
    ).length;

    this.unreadCountSubject.next(count);
  }

  private playNotificationSound() {
    try {
      const audio = new Audio('assets/sounds/notification.mp3');
      audio.play().catch(() => {});
    } catch (error) {
      console.warn('No se pudo reproducir sonido de notificación', error);
    }
  }

  async stopRealtimeNotifications() {
    const pb = this.global.pb;
    await pb.collection('notifications').unsubscribe('*');
  }
}