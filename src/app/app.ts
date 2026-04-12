import { Component, inject, HostListener } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Header } from './ui/header/header';
import { Menubar } from './ui/menubar/menubar';
import { Sidebar } from './ui/sidebar/sidebar';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

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

  showPwaPrompt = false;
  isIos = false;
  isInstalled = false;
  deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.showLayout = !this.hiddenLayoutRoutes.includes(event.urlAfterRedirects);
      });

    this.showLayout = !this.hiddenLayoutRoutes.includes(this.router.url);

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