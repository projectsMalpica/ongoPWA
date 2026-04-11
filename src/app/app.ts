import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './ui/header/header';
import { Menubar } from './ui/menubar/menubar';
import { Sidebar } from './ui/sidebar/sidebar';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, Menubar, Sidebar, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
/*   protected readonly title = signal('ongoPWA');
 */   private router = inject(Router);

  showLayout = true;

  private hiddenLayoutRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password'
  ];

  constructor() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.showLayout = !this.hiddenLayoutRoutes.includes(event.urlAfterRedirects);
      });

    this.showLayout = !this.hiddenLayoutRoutes.includes(this.router.url);
  }
}
