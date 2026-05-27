import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import PocketBase from 'pocketbase';

@Component({
  selector: 'app-checkout-promo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout-promo.html',
  styleUrl: './checkout-promo.scss',
})
export class CheckoutPromo implements OnInit {
  pb = new PocketBase('https://db.ongomatch.com:8090');

  promo: any = null;
  currentUser: any = null;

  loading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.currentUser = this.pb.authStore.model;

    const id = this.route.snapshot.paramMap.get('id');

    const promoLocal = localStorage.getItem('selectedPromoToBuy');

    if (promoLocal) {
      this.promo = JSON.parse(promoLocal);
    }

    if (!this.promo && id) {
      await this.loadPromo(id);
    }

    if (!this.currentUser) {
      this.error = 'Debes iniciar sesión para comprar esta promoción.';
    }
  }

  async loadPromo(id: string): Promise<void> {
    try {
      this.promo = await this.pb.collection('promos').getOne(id, {
        expand: 'partner,userId',
        requestKey: null,
      });

      localStorage.setItem('selectedPromoToBuy', JSON.stringify(this.promo));
    } catch (error) {
      console.error(error);
      this.error = 'No fue posible cargar la promoción.';
    }
  }

  generateRedeemCode(): string {
    return 'PROMO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  getPartnerId(): string {
    return this.promo?.partner || this.promo?.partnerId || '';
  }

  getAmount(): number {
    return Number(this.promo?.price || this.promo?.amount || 0);
  }

  async createPromoOrder(): Promise<void> {
    if (!this.promo?.id) {
      this.error = 'No se encontró la promoción.';
      return;
    }

    if (!this.currentUser?.id) {
      this.error = 'Debes iniciar sesión para comprar.';
      return;
    }

    const amount = this.getAmount();

    if (!amount || amount <= 0) {
      this.error = 'La promoción no tiene un precio válido.';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const data = {
        promoId: this.promo.id,
        partnerId: this.getPartnerId(),
        buyerUserId: this.currentUser.id,
        buyerName: this.currentUser.name || this.currentUser.username || '',
        buyerEmail: this.currentUser.email || '',
        amount,
        status: 'pending',
        orderStatus: 'active',
        redeemCode: this.generateRedeemCode(),
        paymentData: JSON.stringify({
          source: 'promo_checkout',
          promoName: this.promo.name,
          createdAt: new Date().toISOString(),
        }),
      };

      const order = await this.pb.collection('promo_orders').create(data, {
        requestKey: null,
      });

      localStorage.setItem('selectedPromoOrder', JSON.stringify(order));

      /**
       * Aquí conectas con tu flujo de pago.
       * Si ya tienes una ruta de pago para entradas, puedes reutilizarla.
       */
      this.router.navigate(['/payment-promo', order.id]);

    } catch (error) {
      console.error(error);
      this.error = 'No fue posible crear la orden de promoción.';
    } finally {
      this.loading = false;
    }
  }
}