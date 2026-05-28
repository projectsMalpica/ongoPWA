import { Component, inject, HostListener } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Header } from './ui/header/header';
import { Menubar } from './ui/menubar/menubar';
import { Sidebar } from './ui/sidebar/sidebar';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { ToastService } from './services/ToastService.service';
import { NotificationsService } from './services/NotificationsService.service';
import { GlobalService } from './services/global.service';
import { SwUpdate } from '@angular/service-worker';
import { AuthPocketbaseService } from './services/authPocketbase.service';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, Menubar, Sidebar, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private router = inject(Router);

  showLayout = true;

  private hiddenLayoutRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password'
  ];
  toasts: any[] = [];

  showPwaPrompt = false;
  isIos = false;
  isInstalled = false;
  deferredPrompt: BeforeInstallPromptEvent | null = null;
  constructor(
    private toastService: ToastService,
    public notificationsService: NotificationsService,
    public global: GlobalService,
      private swUpdate: SwUpdate,
      private auth: AuthPocketbaseService
  ) 
  {
     this.router.events
    .pipe(filter(event => event instanceof NavigationEnd))
    .subscribe((event: NavigationEnd) => {
      this.showLayout = !this.hiddenLayoutRoutes.includes(event.urlAfterRedirects);
    });

  this.showLayout = !this.hiddenLayoutRoutes.includes(this.router.url);

  this.checkForAppUpdates();

  if (typeof window !== 'undefined') {
    this.isIos =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
      ((navigator.platform === 'MacIntel') && (navigator as any).maxTouchPoints > 1);

    this.isInstalled =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    const dismissed = localStorage.getItem('ongo-pwa-dismissed') === '1';

    if (this.isIos && !this.isInstalled && !dismissed) {
      this.showPwaPrompt = true;
    }
  }

  this.toastService.toasts$.subscribe(t => {
    this.toasts = t;
  });
  }
  
 async ngOnInit() {
  const restored = await this.auth.restoreSession();

  if (!restored) {
    console.warn('No se pudo restaurar sesión');
    return;
  }

  const user = this.auth.pb.authStore.record || this.auth.pb.authStore.model;

  if (!user?.id) {
    console.warn('No hay usuario válido');
    return;
  }

  this.global.pb.authStore.save(
    this.auth.pb.authStore.token,
    user
  );

  await this.notificationsService.initRealtimeNotifications(user.id);

  console.log('Sesión restaurada:', user.id);
}
  checkForAppUpdates() {
  if (location.hostname === 'localhost') {
    return;
  }

  if (this.swUpdate.isEnabled) {
    this.swUpdate.versionUpdates.subscribe(event => {
      if (event.type === 'VERSION_READY') {
        console.log('Nueva versión disponible. Recargando app...');
        window.location.reload();
      }
    });
  }
}
async logoutHard() {
  this.global.pb.authStore.clear();

  /* localStorage.clear();
  sessionStorage.clear(); */
this.auth.clearLocalSession();
  if ('databases' in indexedDB) {
    const dbs = await indexedDB.databases();

    dbs.forEach((db) => {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    });
  }

  window.location.href = '/login';
}
  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(event: Event) {
    event.preventDefault();
    this.deferredPrompt = event as BeforeInstallPromptEvent;

    if (!this.isInstalled) {
      this.showPwaPrompt = true;
    }
  }

  @HostListener('window:appinstalled')
  onAppInstalled() {
    this.isInstalled = true;
    this.showPwaPrompt = false;
    this.deferredPrompt = null;
    localStorage.removeItem('ongo-pwa-dismissed');
    console.log('✅ OnGo instalada correctamente');
  }

  async installPwa() {
    if (this.isIos) {
      alert('Para instalar OnGo, toca el botón Compartir del navegador y luego selecciona "Añadir a pantalla de inicio".');
      return;
    }

    if (!this.deferredPrompt) {
      console.log('⚠️ El prompt de instalación todavía no está disponible');
      return;
    }

    await this.deferredPrompt.prompt();
    const choice = await this.deferredPrompt.userChoice;

    console.log('Resultado instalación:', choice.outcome);

    if (choice.outcome === 'accepted') {
      this.showPwaPrompt = false;
    }

    this.deferredPrompt = null;
  }

  closePwaPrompt() {
    this.showPwaPrompt = false;
    localStorage.setItem('ongo-pwa-dismissed', '1');
  }
}