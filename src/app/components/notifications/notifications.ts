import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { AppNotification, NotificationsService } from '../../services/NotificationsService.service';
import { PushService } from '../../services/push.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class NotificationsComponent implements OnInit {
  get notifications$() { return this.notifications.notifications$; }
  get unreadCount$() { return this.notifications.unreadCount$; }
  loading = true;
  error = '';

  constructor(
    public readonly notifications: NotificationsService,
    private readonly auth: AuthPocketbaseService,
    private readonly push: PushService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const userId = this.auth.getUserId();
    if (!userId) {
      this.error = 'Inicia sesión para consultar tus notificaciones.';
      this.loading = false;
      return;
    }
    try {
      await this.notifications.initRealtimeNotifications(userId);
    } catch (error) {
      console.error('[Notifications] No se pudo cargar el historial.', error);
      this.error = 'No pudimos cargar las notificaciones. Intenta nuevamente.';
    } finally {
      this.loading = false;
    }
  }

  async open(item: AppNotification): Promise<void> {
    try {
      await this.notifications.open(item);
      await this.router.navigateByUrl(this.push.resolveSafeRoute({
        ...(item.data || {}),
        type: item.type,
        referenceId: item.referenceId,
        senderId: item.fromUser
      }));
    } catch (error) {
      console.error('[Notifications] No se pudo abrir la notificación.', error);
      this.error = 'No pudimos actualizar esta notificación.';
    }
  }

  async markAll(): Promise<void> {
    const userId = this.auth.getUserId();
    if (!userId) return;
    try {
      await this.notifications.markAllAsRead(userId);
    } catch (error) {
      console.error('[Notifications] No se pudieron marcar todas como leídas.', error);
      this.error = 'No pudimos marcar todas como leídas.';
    }
  }
}
