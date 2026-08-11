import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GlobalService } from './global.service';

export interface AppNotification {
  id: string;
  user: string;
  fromUser?: string;
  partnerId?: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  referenceId?: string;
  created: string;
  data?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  private readonly handledIds = new Set<string>();
  private activeUserId = '';
  private readonly soundPreferenceKey = 'ongo_notification_sound_enabled';

  constructor(private global: GlobalService) {}

  get soundEnabled(): boolean {
    return localStorage.getItem(this.soundPreferenceKey) !== 'false';
  }

  setSoundEnabled(enabled: boolean): void {
    localStorage.setItem(this.soundPreferenceKey, String(enabled));
  }

  async initRealtimeNotifications(userId: string) {
  const pb = this.global.pb;

  if (!userId) return;

  if (this.activeUserId === userId) return;
  this.activeUserId = userId;

  await this.loadNotifications(userId);

  await pb.collection('notifications').unsubscribe('*');

  await pb.collection('notifications').subscribe('*', async (e) => {
    const notification = e.record;

    if (notification?.['user'] !== userId) return;

    if (e.action === 'create') {
      const current = this.notificationsSubject.value;

      if (!current.some(item => item.id === notification.id)) {
        this.notificationsSubject.next([notification as unknown as AppNotification, ...current]);
      }

      this.updateUnreadCount();
      this.handleAudibleEvent(notification.id);

      console.log('Nueva notificación:', notification);
    }

    if (e.action === 'update') {
      const updated = this.notificationsSubject.value.map((item) =>
        item.id === notification.id ? notification as unknown as AppNotification : item
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

  this.notificationsSubject.next(records as unknown as AppNotification[]);
  records.forEach(record => this.handledIds.add(record.id));
  this.updateUnreadCount();
}

  async markAsRead(notificationId: string) {
    const pb = this.global.pb;

    const updated = await pb.collection('notifications').update(notificationId, {
      read: true
    });

    const list = this.notificationsSubject.value.map((item) =>
      item.id === notificationId ? updated as unknown as AppNotification : item
    );

    this.notificationsSubject.next(list);
    this.updateUnreadCount();
  }

  async open(notification: AppNotification): Promise<void> {
    if (!notification.read) await this.markAsRead(notification.id);
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

  handleForegroundPush(notificationId?: string): void {
    this.handleAudibleEvent(notificationId || 'push-without-id');
  }

  private handleAudibleEvent(notificationId: string): void {
    if (this.handledIds.has(notificationId)) return;
    this.handledIds.add(notificationId);
    if (!this.soundEnabled) return;
    try {
      const audio = new Audio('assets/sounds/notification.mp3');
      audio.volume = 0.45;
      audio.play().catch(() => {});
    } catch (error) {
      console.warn('No se pudo reproducir sonido de notificación', error);
    }
  }

  async stopRealtimeNotifications() {
    const pb = this.global.pb;
    await pb.collection('notifications').unsubscribe('*');
    this.activeUserId = '';
  }
}
