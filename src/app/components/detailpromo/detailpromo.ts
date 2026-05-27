import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import PocketBase from 'pocketbase';

@Component({
  selector: 'app-detailpromo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detailpromo.html',
  styleUrl: './detailpromo.scss',
})
export class Detailpromo implements OnInit {
  pb = new PocketBase('https://db.ongomatch.com:8090');

  promo: any = null;
  loading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.error = 'No se encontró la promoción.';
      return;
    }

    const promoLocal = localStorage.getItem('selectedPromo');

    if (promoLocal) {
      this.promo = JSON.parse(promoLocal);
    }

    await this.loadPromo(id);
  }

  async loadPromo(id: string): Promise<void> {
    this.loading = true;

    try {
      this.promo = await this.pb.collection('promos').getOne(id, {
        expand: 'partner,userId',
        requestKey: null,
      });

      localStorage.setItem('selectedPromo', JSON.stringify(this.promo));
    } catch (error) {
      console.error(error);
      this.error = 'No fue posible cargar la promoción.';
    } finally {
      this.loading = false;
    }
  }

  buyPromo(): void {
    if (!this.promo) return;

    localStorage.setItem('selectedPromoToBuy', JSON.stringify(this.promo));

    this.router.navigate(['/checkout-promo', this.promo.id]);
  }

}
