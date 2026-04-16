import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
constructor(public global: GlobalService, public auth: AuthPocketbaseService, public router: Router
  , public sidebarService: SidebarService
) {}

 goHome(): void {
    const route = this.auth.isPartner() ? '/home-local' : '/home';
    this.router.navigate([route]);
  }

  goMenu(): void {
    this.router.navigate(['/sidebar']);
  }
  toggleSidebar() {
    this.sidebarService.toggle();
  }
}
