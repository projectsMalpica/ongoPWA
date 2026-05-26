import { Component, ChangeDetectorRef } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { CommonModule } from '@angular/common';
import PocketBase from 'pocketbase';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { WompiService } from '../../services/wompi.service';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/ToastService.service';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../environments/environment';
@Component({
  selector: 'app-detailprofilelocal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detailprofilelocal.html',
  styleUrl: './detailprofilelocal.scss',
})
export class Detailprofilelocal {
  private pb = new PocketBase('https://db.ongomatch.com:8090');
  isReservingTable = false;
  avatarUrl: string = '';
  partner: any = null;
  partnerPromos: any[] = [];
  partnerProducts: any[] = [];
  showGiftModal = false;
  selectedGiftProduct: any = null;
  selectedReceiverUserId = '';
  giftMessage = '';
  giftPaymentMethod: 'wallet' | 'wompi' = 'wallet';
  walletBalance = 0;
  currentWallet: any = null;
  giftReceivers: any[] = [];
  isSendingGift = false;
  isBuyingTicket = false;
  lastTicketCode = '';
showTicketSuccess = false;

  constructor(public global: GlobalService,
    public changeDetectorRef: ChangeDetectorRef,
    public auth: AuthPocketbaseService,
    public wompiService: WompiService,
    private toastService: ToastService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.pb.autoCancellation(false);
  }
  async ngOnInit(): Promise<void> {

    const partnerId = this.activatedRoute.snapshot.paramMap.get('id');

    if (!partnerId) {
      console.warn('No se recibió ID del local');
      return;
    }

    try {

      this.partner = await this.pb
        .collection('usuariosPartner')
        .getOne(partnerId);

    } catch (error) {

      console.error('Error cargando local:', error);
      return;

    }

    if (!this.partner?.id) {
      console.warn('No hay partner para mostrar');
      return;
    }

    this.normalizePartnerData();
    this.setAvatarUrl();

    await Promise.all([
      this.loadPartnerPromos(),
      this.loadPartnerProducts()
    ]);

    console.log('Partner detalle:', this.partner);
    console.log('Promos:', this.partnerPromos);
    console.log('Productos:', this.partnerProducts);
    this.changeDetectorRef.detectChanges();
  }
  getAvatarUrl(user: any): string {
  if (!user?.avatar) {
    return 'assets/images/user/pic1.jpg';
  }

  return `${environment.pbUrl}/api/files/${user.collectionId}/${user.id}/${user.avatar}`;
}
async payWithWallet(params: {
  amount: number;
  description: string;
  referenceType: string;
  referenceId: string;
}): Promise<boolean> {
  const authUser = this.auth.currentUser;

  if (!authUser?.id) {
    this.toastService.show('Debes iniciar sesión.', 'error');
    return false;
  }

  await this.loadWallet();

  if (!this.currentWallet?.id) {
    this.toastService.show('No se encontró tu wallet.', 'error');
    return false;
  }

  const balanceBefore = Number(this.currentWallet.balance || 0);

  if (balanceBefore < params.amount) {
    this.toastService.show('Saldo insuficiente. Recarga tu wallet para continuar.', 'error');

    setTimeout(() => {
      this.router.navigate(['/wallet']);
    }, 800);

    return false;
  }

  const balanceAfter = balanceBefore - params.amount;

  let authUserRecordId = authUser.id;

  try {
    const authRecord = await this.pb.collection('users').getFirstListItem(
      `email="${authUser.email}"`,
      { requestKey: null }
    );

    authUserRecordId = authRecord.id;
  } catch (error) {
    console.warn('No se pudo confirmar el usuario en users, se usará authUser.id:', authUser.id);
  }

  const transactionData: any = {
    walletId: this.currentWallet.id,
    userId: authUserRecordId,
    type: params.referenceType === 'ticket_order' ? 'ticket' : 'purchase',
    amount: params.amount,
    direction: 'debit',
    balanceBefore,
    balanceAfter,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    status: 'completed',
    description: params.description
  };

  if (this.partner?.id) {
    transactionData.partnerId = this.partner.id;
  }

  try {
    const transaction = await this.pb.collection('wallet_transactions').create(transactionData, {
      requestKey: null
    });

    console.log('Transacción wallet creada:', transaction);

    await this.pb.collection('wallet').update(this.currentWallet.id, {
      balance: balanceAfter
    }, { requestKey: null });

    this.walletBalance = balanceAfter;
    this.currentWallet.balance = balanceAfter;

    return true;

  } catch (error: any) {
    console.error('wallet_transactions data:', transactionData);
    console.error('PocketBase response:', error?.response);

    this.toastService.show('No se pudo registrar la transacción.', 'error');
    return false;
  }
}
  private generateRedeemCode(prefix = 'TICKET'): string {
  return `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
}

async buyTicket(): Promise<void> {
  try {
    this.isBuyingTicket = true;

    const buyerUserId = this.auth.currentUser?.id;

    if (!buyerUserId) {
      this.toastService.show('Debes iniciar sesión para comprar entrada.', 'error');
      return;
    }

    const amount = Number(this.partner.ticketPrice || 0);

    if (!amount || amount <= 0) {
      this.toastService.show('Este local no tiene precio de entrada configurado.', 'error');
      return;
    }

    const redeemCode = this.generateRedeemCode('TICKET');

    const order = await this.pb.collection('ticket_orders').create({
      buyerUserId,
      partnerId: this.partner.id,
      partnerUserId: this.partner.userId,
      partnerName: this.partner.venueName,
      amount,
      status: 'pending',
      orderStatus: 'pending_redeem',
      paymentMethod: 'wallet',
      ticketDate: this.partner.ticketDate || '',
      redeemCode,
      referenceId: `ticket_${this.partner.id}_${Date.now()}`
    }, { requestKey: null });

    const paid = await this.payWithWallet({
      amount,
      description: `Entrada comprada: ${this.partner.venueName}`,
      referenceType: 'ticket_order',
      referenceId: order.id
    });

    if (!paid) {
      await this.pb.collection('ticket_orders').update(order.id, {
        status: 'cancelled',
        orderStatus: 'cancelled'
      }, { requestKey: null });
      return;
    }

    await this.pb.collection('ticket_orders').update(order.id, {
      status: 'paid',
      orderStatus: 'pending_redeem',
      paidAt: new Date().toISOString()
    }, { requestKey: null });

    this.lastTicketCode = redeemCode;
    this.showTicketSuccess = true;

    this.toastService.show(`Entrada comprada. Código: ${redeemCode}`, 'success');

  } catch (error) {
    console.error('Error comprando entrada:', error);
    this.toastService.show('No se pudo comprar la entrada.', 'error');
  } finally {
    this.isBuyingTicket = false;
    this.changeDetectorRef.detectChanges();
  }
}
  async reserveTable(): Promise<void> {
    try {
      this.isReservingTable = true;

      const clientUserId = this.auth.currentUser?.id;

      if (!clientUserId) {
        this.toastService.show('Debes iniciar sesión para reservar.', 'error');
        return;
      }

      const amount = Number(this.partner.reservationPrice || 0);

      const reservation = await this.pb.collection('table_reservations').create({
        clientUserId,
        partnerId: this.partner.id,
        partnerUserId: this.partner.userId,
        partnerName: this.partner.venueName,
        amount,
        status: amount > 0 ? 'pending' : 'paid',
        paymentMethod: amount > 0 ? 'wallet' : 'free',
        reservationDate: this.partner.reservationDate || '',
        reservationType: 'table',
        people: 1,
        message: ''
      }, { requestKey: null });

      if (amount > 0) {
        const paid = await this.payWithWallet({
          amount,
          description: `Reserva de mesa: ${this.partner.venueName}`,
          referenceType: 'table_reservation',
          referenceId: reservation.id
        });

        if (!paid) {
          await this.pb.collection('table_reservations').update(reservation.id, {
            status: 'cancelled',
            paymentMethod: 'wallet',
          }, { requestKey: null });

          return;
        }
        this.toastService.show('Reserva realizada correctamente 🍾', 'success');

      }


    } catch (error) {
      console.error('Error reservando mesa:', error);
      this.toastService.show('No se pudo realizar la reserva.', 'error');
    } finally {
      this.isReservingTable = false;
      this.changeDetectorRef.detectChanges();

    }
  }
  normalizePartnerData(): void {
    if (typeof this.partner.files === 'string') {
      try {
        this.partner.files = JSON.parse(this.partner.files);
      } catch {
        this.partner.files = [this.partner.files];
      }
    }

    if (!Array.isArray(this.partner.files)) {
      this.partner.files = [];
    }

    this.partner.files = this.partner.files.map((file: string) => {
      if (!file) return '';
      return file.startsWith('http')
        ? file
        : this.pb.files.getUrl(this.partner, file);
    }).filter(Boolean);

    if (typeof this.partner.services === 'string') {
      this.partner.services = this.partner.services
        .split(',')
        .map((item: string) => item.trim())
        .filter(Boolean);
    }

    if (!Array.isArray(this.partner.services)) {
      this.partner.services = [];
    }
  }

  setAvatarUrl(): void {
    if (this.partner.avatar?.startsWith('http')) {
      this.avatarUrl = this.partner.avatar;
      return;
    }

    if (this.partner.avatar) {
      this.avatarUrl = this.pb.files.getUrl(this.partner, this.partner.avatar);
      return;
    }

    if (this.partner.files?.length) {
      this.avatarUrl = this.partner.files[0];
      return;
    }

    this.avatarUrl = 'assets/images/avatar-local.png';
  }

  async loadPartnerPromos(): Promise<void> {
    try {
      if (!this.partner?.userId) {
        console.warn('El partner no tiene userId para cargar promociones');
        return;
      }

      const records = await this.pb.collection('promos').getFullList({
        filter: `userId="${this.partner.userId}"`,
        sort: '-created',
        requestKey: null
      });

      this.partnerPromos = records.map((promo: any) => ({
        id: promo.id,
        name: promo.name,
        description: promo.description,
        userId: promo.userId,
        files: this.normalizeFiles(promo.files)
      }));
    } catch (error) {
      console.error('Error cargando promociones:', error);
    }
  }

  async loadPartnerProducts(): Promise<void> {
    try {
      const filters: string[] = [];

      if (this.partner?.id) {
        filters.push(`partnerId="${this.partner.id}"`);
      }

      if (this.partner?.userId) {
        filters.push(`userId="${this.partner.userId}"`);
      }

      if (!filters.length) return;

      const records = await this.pb.collection('partnerProducts').getFullList({
        filter: `(${filters.join(' || ')}) && isAvailable=true`,
        sort: '-created',
        requestKey: null
      });

      this.partnerProducts = records.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price,
        isAvailable: item.isAvailable,
        userId: item.userId,
        partnerId: item.partnerId,
        image: item.image ? this.pb.files.getUrl(item, item.image) : ''
      }));
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  }

  normalizeFiles(files: any): string[] {
    if (!files) return [];

    if (Array.isArray(files)) {
      return files;
    }

    if (typeof files === 'string') {
      try {
        const parsed = JSON.parse(files);
        return Array.isArray(parsed) ? parsed : [files];
      } catch {
        return [files];
      }
    }

    return [];
  }

  async openGiftModal(product: any): Promise<void> {
    this.selectedGiftProduct = product;
    this.selectedReceiverUserId = '';
    this.giftMessage = '';
    this.giftPaymentMethod = 'wallet';
    this.showGiftModal = true;

    await Promise.all([
      this.loadWallet(),
      this.loadGiftReceivers()
    ]);

    this.changeDetectorRef.detectChanges();
  }

  closeGiftModal(): void {
    if (this.isSendingGift) return;

    this.showGiftModal = false;
    this.selectedGiftProduct = null;
    this.selectedReceiverUserId = '';
    this.giftMessage = '';
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

  async loadGiftReceivers(): Promise<void> {
    try {
      const currentUserId = this.auth.currentUser?.id;

      if (!currentUserId) {
        this.giftReceivers = [];
        return;
      }

      const records = await this.pb.collection('usuariosClient').getFullList({
        filter: `userId!="${currentUserId}"`,
        sort: 'name',
        requestKey: null
      });

      this.giftReceivers = records.map((client: any) => ({
        id: client.id,
        userId: client.userId,
        name: client.name || 'Usuario',
        email: client.email || '',
        avatar: this.normalizeClientAvatar(client)
      }));

      this.changeDetectorRef.detectChanges();

    } catch (error) {
      console.error('Error cargando clientes receptores:', error);
      this.giftReceivers = [];
    }
  }
  normalizeClientAvatar(client: any): string {
    if (!client.avatar) {
      return 'assets/images/user/pic1.jpg';
    }

    if (typeof client.avatar === 'string') {
      try {
        const parsed = JSON.parse(client.avatar);

        if (Array.isArray(parsed) && parsed.length) {
          return parsed[0];
        }

        return client.avatar;
      } catch {
        return client.avatar.startsWith('http')
          ? client.avatar
          : this.pb.files.getUrl(client, client.avatar);
      }
    }

    if (Array.isArray(client.avatar) && client.avatar.length) {
      return client.avatar[0];
    }

    return 'assets/images/user/pic1.jpg';
  }
  async sendGift(): Promise<void> {
    if (!this.selectedGiftProduct) return;

    const buyerUserId = this.auth.currentUser?.id;

    if (!buyerUserId) {
      this.toastService.show('Debes iniciar sesión.', 'error');
      return;
    }

    const receiverUserId = this.selectedReceiverUserId || buyerUserId;

    if (this.giftPaymentMethod === 'wallet') {
      await this.sendGiftWithWallet();
      return;
    }

    await this.sendGiftWithWompi();
  }
  async sendGiftWithWallet(): Promise<void> {
    try {
      this.isSendingGift = true;

      const buyerUserId = this.auth.currentUser?.id;
      const product = this.selectedGiftProduct;
      const amount = Number(product.price || 0);
      const receiverUserId = this.selectedReceiverUserId || buyerUserId;
      const isGift = receiverUserId !== buyerUserId;
      if (!buyerUserId) {
        alert('Debes iniciar sesión.');
        return;
      }

      if (!this.currentWallet) {
        await this.loadWallet();
      }

      const balanceBefore = Number(this.currentWallet.balance || 0);

      if (balanceBefore < amount) {
        this.toastService.show(
          'Saldo insuficiente. Usa Wompi o recarga tu wallet 💳',
          'error'
        ); return;
      }

      const balanceAfter = balanceBefore - amount;

      await this.pb.collection('wallet').update(this.currentWallet.id, {
        balance: balanceAfter
      }, { requestKey: null });

      const order = await this.pb.collection('product_orders').create({
        buyerUserId,
        receiverUserId,
        partnerId: product.partnerId || this.partner.id,
        productId: product.id,
        productName: product.name,
        productImage: product.image || '',
        amount,
        paymentMethod: 'wallet',
        status: 'paid',
        message: this.giftMessage || ''
      }, { requestKey: null });

      await this.pb.collection('wallet_transactions').create({
        walletId: this.currentWallet.id,
        userId: buyerUserId,
        type: 'purchase',
        amount,
        direction: 'debit',
        balanceBefore,
        balanceAfter,
        referenceType: 'product_order',
        referenceId: order.id,
        status: 'approved',
        description: `Regalo enviado: ${product.name}`
      }, { requestKey: null });

      this.walletBalance = balanceAfter;
      this.closeGiftModal();

      this.toastService.show('Regalo enviado correctamente 🎁', 'success');

    } catch (error) {
      console.error('Error enviando regalo con wallet:', error);
      this.toastService.show('No se pudo enviar el regalo.', 'error');
    } finally {
      this.isSendingGift = false;
    }
  }
  async sendGiftWithWompi(): Promise<void> {
    try {
      this.isSendingGift = true;

      const buyerUserId = this.auth.currentUser?.id;
      const product = this.selectedGiftProduct;
      const amount = Number(product.price || 0);
      const reference = `gift_${product.id}_${Date.now()}`;
      const receiverUserId = this.selectedReceiverUserId || buyerUserId;
      const isGift = receiverUserId !== buyerUserId;
      if (!buyerUserId) {
        alert('Debes iniciar sesión.');
        return;
      }

      await this.pb.collection('product_orders').create({
        buyerUserId,
        receiverUserId,
        partnerId: product.partnerId || this.partner.id,
        productId: product.id,
        productName: product.name,
        productImage: product.image || '',
        amount,
        paymentMethod: 'wompi',
        status: 'pending',
        message: this.giftMessage || '',
        referenceId: reference
      }, { requestKey: null });

      this.showGiftModal = false;

      await new Promise(resolve => setTimeout(resolve, 150));

      await this.wompiService.openCheckout({
        amountInCents: amount * 100,
        reference,
        currency: 'COP',
        customerEmail: this.auth.currentUser?.email || ''
      });

    } catch (error) {
      console.error('Error enviando regalo con Wompi:', error);
      this.toastService.show('No se pudo iniciar el pago.', 'error');
    } finally {
      this.isSendingGift = false;
    }
  }
}