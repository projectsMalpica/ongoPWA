import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';

@Component({
  selector: 'app-detailprofile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detailprofile.html',
  styleUrl: './detailprofile.scss',
})
export class Detailprofile {
constructor(public global: GlobalService){}
abrirChat(cliente: any) {
  console.log('Abriendo chat con:', cliente);
  this.global.selectedClient = cliente;  // ✅ Guarda el cliente completo
  this.global.activeRoute = 'chat-detail';
}
}
