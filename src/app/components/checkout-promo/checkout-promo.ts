import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import PocketBase from 'pocketbase';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';

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
    currentWallet: any = null;
  walletBalance = 0;
  lastRedeemCode = '';
  lastRedeemQr = '';
  loading = false;
  error = '';
  promoOrderSuccess = false;


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private auth: AuthPocketbaseService
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
copyRedeemCode(): void {
  if (!this.lastRedeemCode) return;

  navigator.clipboard.writeText(this.lastRedeemCode);
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
  if (this.loading) return;

  this.error = '';
  this.loading = true;

  try {
    const buyerUserId = this.auth.currentUser?.id;

    if (!buyerUserId) {
      this.error = 'Debes iniciar sesión.';
      return;
    }

    if (!this.promo?.id) {
      this.error = 'No se encontró la promoción.';
      return;
    }

    const amount = Number(this.promo.price || 0);

    if (amount <= 0) {
      this.error = 'Esta promoción no tiene precio configurado.';
      return;
    }

    await this.loadWallet();

    const balanceBefore = Number(this.currentWallet?.balance || 0);

    if (balanceBefore < amount) {
      this.error = 'Saldo insuficiente. Recarga tu wallet para continuar.';
      return;
    }

    const balanceAfter = balanceBefore - amount;
    const redeemCode = `PROMO-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const redeemQr = `${window.location.origin}/redeem-promo/${redeemCode}`;
    const referenceId = `wallet_promo_${this.promo.id}_${Date.now()}`;

    const partnerId =
  this.promo.partnerId ||
  this.promo.partner ||
  this.promo.userId ||
  this.promo.expand?.partner?.id ||
  this.promo.expand?.userId?.id ||
  '';

    const order = await this.pb.collection('promo_orders').create({
  promoId: this.promo.id,
  partnerId,
  buyerUserId,
  buyerName: this.auth.currentUser?.name || '',
  buyerEmail: this.auth.currentUser?.email || '',
  amount,
  status: 'paid',
  orderStatus: 'active',
  redeemCode,
  paymentData: JSON.stringify({
    method: 'wallet',
    referenceId,
    redeemQr,
    promoName: this.promo.name,
    promoImage: this.promo.files?.[0] || '',
    paidAt: new Date().toISOString()
  })
}, { requestKey: null });

    await this.pb.collection('wallet').update(this.currentWallet.id, {
      balance: balanceAfter
    }, { requestKey: null });

    await this.pb.collection('wallet_transactions').create({
      walletId: this.currentWallet.id,
      userId: buyerUserId,
      partnerId,
      type: 'promo_purchase',
      amount,
      direction: 'debit',
      balanceBefore,
      balanceAfter,
      referenceType: 'promo_order',
      referenceId: order.id,
      status: 'completed',
      description: `Promoción comprada: ${this.promo.name}`
    }, { requestKey: null });

    this.walletBalance = balanceAfter;
    this.lastRedeemCode = redeemCode;
    this.lastRedeemQr = redeemQr;
    this.promoOrderSuccess = true;

  } catch (error: any) {
    console.error('Error creando orden promo:', error);
    console.error('PocketBase response:', error?.response);

    this.error =
      error?.response?.message ||
      'No se pudo crear la orden de promoción.';
  } finally {
    this.loading = false;
    this.cdr.detectChanges();
  }
}
async loadWallet(): Promise<void> {
    const userId = this.auth.currentUser?.id;

    if (!userId) return;

    try {
      const wallet = await this.pb.collection('wallet').getFirstListItem(
        `userId="${userId}"`,
        { requestKey: null }
      );

      this.currentWallet = wallet;
      this.walletBalance = Number(wallet['balance'] || 0);
    } catch (error) {
      console.warn('El usuario no tiene wallet creada todavía');

      const wallet = await this.pb.collection('wallet').create({
        userId,
        balance: 0,
        currency: 'COP',
        status: 'active'
      });

      this.currentWallet = wallet;
      this.walletBalance = 0;
    }
  }
}