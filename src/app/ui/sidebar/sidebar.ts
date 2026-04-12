import { Component, OnInit } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit {
  clientes: any[] = [];
  constructor(
    public global: GlobalService,
    public auth: AuthPocketbaseService,
    public router: Router
  ) { }

  ngOnInit(): void {
    // Verificar si hay un usuario logueado
    const currentUser = this.auth.getCurrentUser();
    if (currentUser) {
      this.auth.setUser(currentUser); // Actualizar el usuario en el servicio
    }
    this.global.clientes$.subscribe((clientes : any[]) => {
      this.clientes = clientes;
    });
    
    console.log('Avatar en profileData:', this.global.profileData.avatar);

  }
    goHome(): void {
    this.router.navigate([this.auth.isPartner() ? '/home-local' : '/home']);
  }

  goProfile(): void {
    this.router.navigate([this.auth.isPartner() ? '/profile-local' : '/profile']);
  }

  goWallet(): void {
    this.router.navigate(['/wallet']);
  }

  logout(): void {
    this.auth.logoutUser();
    this.router.navigate(['/login']);
  }
}
