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
isPartner: boolean = false;
constructor(
  public global: GlobalService,
  public auth: AuthPocketbaseService
) { 
  this.isPartner = this.auth.isPartner();
}
}
