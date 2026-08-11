import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PushService, PushStatus } from '../../services/push.service';
import { NotificationsService } from '../../services/NotificationsService.service';

@Component({
  selector: 'app-push-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './push-settings.html',
  styleUrl: './push-settings.scss'
})
export class PushSettings implements OnInit {
  constructor(
    public readonly push: PushService,
    public readonly notifications: NotificationsService
  ) {}

  setSound(event: Event): void {
    this.notifications.setSoundEnabled((event.target as HTMLInputElement).checked);
  }

  ngOnInit(): void {
    void this.push.refreshStatus();
  }

  label(status: PushStatus): string {
    return ({
      unsupported: 'No compatible con este navegador',
      default: 'Permiso pendiente',
      enabled: 'Activadas',
      blocked: 'Bloqueadas por el navegador',
      'configuration-error': 'Configuración pendiente',
      error: 'No se pudieron configurar'
    })[status];
  }

  description(status: PushStatus): string {
    if (status === 'blocked') return 'Habilítalas desde la configuración de permisos del navegador.';
    if (status === 'unsupported') return 'Este navegador o contexto no ofrece Web Push seguro.';
    if (status === 'configuration-error') return 'Falta configurar la clave pública VAPID para este entorno.';
    if (status === 'enabled') return 'Este dispositivo puede recibir avisos de OnGo.';
    if (status === 'error') return this.push.errorMessage() || 'Intenta nuevamente más tarde.';
    return 'Actívalas para recibir mensajes, matches y novedades importantes.';
  }
}
