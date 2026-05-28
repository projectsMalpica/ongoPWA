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
  pb!: PocketBase;
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
  ) {
    this.pb = this.auth.pb;

  }

  async ngOnInit(): Promise<void> {
    await this.auth.restoreSession();

    this.currentUser =
      this.auth.currentUser ||
      this.auth.pb.authStore.record ||
      this.auth.pb.authStore.model;

    const id = this.route.snapshot.paramMap.get('id');

    const promoLocal =
      localStorage.getItem('selectedPromoToBuy') ||
      localStorage.getItem('selectedPromo');

    if (promoLocal) {
      try {
        this.promo = JSON.parse(promoLocal);
      } catch {
        localStorage.removeItem('selectedPromoToBuy');
        localStorage.removeItem('selectedPromo');
      }
    }

    if (id) {
      await this.loadPromo(id);
    }

    if (!this.currentUser?.id) {
      this.error = 'Debes iniciar sesión para comprar esta promoción.';
    }

    await this.loadWallet();
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
      const user =
        this.auth.currentUser ||
        this.auth.pb.authStore.record ||
        this.auth.pb.authStore.model;

      if (!user?.id) {
        this.error = 'Debes iniciar sesión.';
        return;
      }

      if (!this.promo?.id) {
        this.error = 'No se encontró la promoción.';
        return;
      }

      const amount = Number(this.promo.price || this.promo.amount || 0);

      if (amount <= 0) {
        this.error = 'Esta promoción no tiene precio configurado.';
        return;
      }

      await this.loadWallet();

      const balanceBefore = Number(this.currentWallet?.balance || 0);

      if (!this.currentWallet?.id) {
        this.error = 'No se encontró la wallet del usuario.';
        return;
      }

      if (balanceBefore < amount) {
        this.error = 'Saldo insuficiente. Recarga tu wallet para continuar.';
        return;
      }

      const buyerProfile = await this.pb.collection('usuariosClient').getFirstListItem(
        `userId="${user.id}"`,
        { requestKey: null }
      );

      const buyerClientId = buyerProfile.id;

      let partnerId =
        this.promo.partnerId ||
        this.promo.expand?.partnerId?.id ||
        this.promo.partner ||
        '';

      if (!partnerId && this.promo.userId) {
        const partnerProfile = await this.pb.collection('usuariosPartner').getFirstListItem(
          `userId="${this.promo.userId}"`,
          { requestKey: null }
        );

        partnerId = partnerProfile.id;
      }

      if (!partnerId) {
        this.error = 'No se encontró el local asociado a esta promoción.';
        return;
      }

      const balanceAfter = balanceBefore - amount;
      const redeemCode = `PROMO-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const redeemQr = `${window.location.origin}/redeem-promo/${redeemCode}`;
      const referenceId = `wallet_promo_${this.promo.id}_${Date.now()}`;

      console.log('PROMO ORDER DATA:', {
        promoId: this.promo.id,
        partnerId,
        buyerUserId: buyerClientId,
        authUserId: user.id,
        buyerName: user?.name || user?.username || '',
        buyerEmail: user?.email || '',
        amount,
        status: 'paid',
        orderStatus: 'active',
        redeemCode
      });

      const order = await this.pb.collection('promo_orders').create({
        promoId: this.promo.id,
        partnerId,
        buyerUserId: buyerClientId,
        buyerName: user?.name || user?.username || '',
        buyerEmail: user?.email || '',
        amount,
        status: 'paid',
        orderStatus: 'active',
        redeemCode,
        paymentData: {
          method: 'wallet',
          referenceId,
          redeemQr,
          promoName: this.promo.name,
          promoImage: this.promo.files?.[0] || '',
          paidAt: new Date().toISOString()
        }
      }, { requestKey: null });

      await this.pb.collection('wallet').update(this.currentWallet.id, {
        balance: balanceAfter
      }, { requestKey: null });

      await this.pb.collection('wallet_transactions').create({
        walletId: this.currentWallet.id,
        userId: user.id,
        partnerId,
type: 'purchase',
        amount,
        direction: 'debit',
        balanceBefore,
        balanceAfter,
        referenceType: 'order',
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
      console.log('PB ERROR DATA:', error?.response?.data);

      const fieldErrors = error?.response?.data;

      if (fieldErrors) {
        this.error = Object.entries(fieldErrors)
          .map(([field, value]: any) => `${field}: ${value.message}`)
          .join(' | ');
      } else {
        this.error =
          error?.response?.message ||
          'No se pudo crear la orden de promoción.';
      }
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
  async loadWallet(): Promise<void> {
    const user =
      this.auth.currentUser ||
      this.auth.pb.authStore.record ||
      this.auth.pb.authStore.model;

    const userId = user?.id;
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