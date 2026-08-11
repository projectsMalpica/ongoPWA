import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import PocketBase from 'pocketbase';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-checkout-promo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
  paymentProofFile: File | null = null;
partnerPaymentMethods: any[] = [];

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
      await this.loadPartnerPaymentMethods();
    }

    if (!this.currentUser?.id) {
      this.error = 'Debes iniciar sesión para comprar esta promoción.';
    }

    await this.loadWallet();
      this.cdr.detectChanges();

  }
  copyRedeemCode(): void {
    if (!this.lastRedeemCode) return;

    navigator.clipboard.writeText(this.lastRedeemCode);
  }
async loadPromo(id: string): Promise<void> {
  try {
    this.promo = await this.pb.collection('promos').getOne(id, {
      requestKey: null,
    });

    localStorage.setItem('selectedPromoToBuy', JSON.stringify(this.promo));
  } catch (error) {
    console.error(error);
    this.error = 'No fue posible cargar la promoción.';
  } finally {
    this.cdr.detectChanges();
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
/*       const redeemCode = `PROMO-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
 */      const redeemCode = '';
      const redeemQr = `${window.location.origin}/redeem-promo/${redeemCode}`;
      const referenceId = `wallet_promo_${this.promo.id}_${Date.now()}`;

      console.log('PROMO ORDER DATA:', {
        promoId: this.promo.id,
        partnerId,
        buyerUserId: user.id,
        buyerClientId,
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
        buyerUserId: user.id,
        buyerClientId,
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
  getMoneyLabel(amount: number, currency: string = 'COP'): string {
  const value = Number(amount || 0);

  if (currency === 'VES') {
    return `${value.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} Bs`;
  }

  if (currency === 'USD') {
    return `${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} USD`;
  }

  return `${value.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })} COP`;
}
isManualPromo(): boolean {
  return this.promo?.country === 'VE'
    || this.promo?.currency === 'VES'
    || this.promo?.currency === 'USD';
}

onPaymentProofSelected(event: any): void {
  this.paymentProofFile = event.target.files?.[0] || null;
}

async loadPartnerPaymentMethods(): Promise<void> {
  if (!this.promo?.userId) return;

  try {
    const partner = await this.pb.collection('usuariosPartner').getFirstListItem(
      `userId="${this.promo.userId}"`,
      { requestKey: null }
    );

    this.partnerPaymentMethods = Array.isArray(partner['paymentMethods'])
      ? partner['paymentMethods']
      : [];

  } catch (error) {
    console.error('Error cargando métodos de pago del local:', error);
    this.partnerPaymentMethods = [];
  }
}
async createPromoManualOrder(): Promise<void> {
  if (this.loading) return;

  this.error = '';

  if (!this.paymentProofFile) {
    this.error = 'Debes subir el comprobante de pago.';
    return;
  }

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

    const partnerProfile = await this.pb.collection('usuariosPartner').getFirstListItem(
      `userId="${this.promo.userId}"`,
      { requestKey: null }
    );

    const redeemCode = `PROMO-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const formData = new FormData();

    formData.append('partnerId', partnerProfile.id);
    formData.append('buyerUserId', user.id);
    formData.append('productName', 'Promoción');
    formData.append('amount', String(this.getAmount()));
    formData.append('country', this.promo.country || 'VE');
    formData.append('currency', this.promo.currency || 'USD');
    formData.append('status', 'pending');
    formData.append('message', `Compra manual de promoción: ${this.promo.name}`);
    formData.append('paymentMethod', 'manual');
    formData.append('itemId', this.promo.id);
    formData.append('itemName', this.promo.name || 'Promoción');
/*     formData.append('redeemCode', redeemCode);
 */    formData.append('redeemCode', '');
    formData.append('proofFile', this.paymentProofFile);

    await this.pb.collection('ticket_payment_proofs').create(formData, {
      requestKey: null
    });

    this.lastRedeemCode = '';
    this.promoOrderSuccess = true;
    this.paymentProofFile = null;

  } catch (error: any) {
    console.error('Error creando pago manual promo:', error);
    this.error =
      error?.response?.message ||
      error?.message ||
      'No se pudo enviar el comprobante.';
  } finally {
    this.loading = false;
    this.cdr.detectChanges();
  }
}
}
