import { Component, OnDestroy, OnInit } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit, OnDestroy {
  clientes: any[] = [];
  isOpen = false;

  private sub = new Subscription();

  constructor(
    public global: GlobalService,
    public auth: AuthPocketbaseService,
    public router: Router,
    public sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.sidebarService.isOpen$.subscribe(value => {
        this.isOpen = value;
      })
    );

    const currentUser = this.auth.getCurrentUser();
    if (currentUser) {
      this.auth.setUser(currentUser);
    }

    this.sub.add(
      this.global.clientes$.subscribe((clientes: any[]) => {
        this.clientes = clientes;
      })
    );

    this.sub.add(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          this.closeSidebar();
        })
    );

    console.log('Avatar en profileData:', this.global.profileData.avatar);
  }

  goHome(): void {
    this.closeSidebar();
    this.router.navigate([this.auth.isPartner() ? '/home-local' : '/home']);
  }

  goProfile(): void {
    this.closeSidebar();
    this.router.navigate([this.auth.isPartner() ? '/profile-local' : '/profile']);
  }

  goWallet(): void {
    this.closeSidebar();
    this.router.navigate(['/wallet']);
  }

  logout(): void {
    this.closeSidebar();
    this.auth.logoutUser();
    this.router.navigate(['/login']);
  }

  closeSidebar(): void {
    this.sidebarService.close();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}