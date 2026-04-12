import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-explorer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './explorer.html',
  styleUrl: './explorer.scss',
})
export class Explorer{
partners: any[] = [];
promos: any[] = [];
constructor(public global: GlobalService,
  public router: Router
){
}
ngOnInit(): void {
  this.global.initPartnersRealtime(); // Forzamos la carga
  this.global.initPromosRealtime();   // Si quieres asegurar también esto

  this.global.partners$.subscribe((partners: any[]) => {
    this.partners = partners;
  });

  this.global.promos$.subscribe((promos: any[]) => {
    this.promos = promos;
  });
}

}
