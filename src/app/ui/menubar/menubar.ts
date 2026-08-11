import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'app-menubar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './menubar.html',
  styleUrl: './menubar.scss',
})
export class Menubar {
  isPartner = false;
constructor(
  public global: GlobalService,
  public auth: AuthPocketbaseService
) { 
}
 ngOnInit() {
    this.isPartner = this.auth.isPartner();

    this.auth.currentUser$.subscribe(user => {
      const storedType = localStorage.getItem('type');
      let type = user?.type || null;
      if (!type && storedType && storedType !== 'undefined') {
        try {
          type = JSON.parse(storedType);
        } catch {
          type = storedType;
        }
      }
      this.isPartner = type === 'partner';
    });
  }
}
