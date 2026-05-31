import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import PocketBase from 'pocketbase';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { ActivatedRoute } from '@angular/router';

type OrderItem = {
  id: string;
  type: 'promo' | 'product' | 'ticket' | 'reservation';
  title: string;
  description: string;
  amount: number;
  status: string;
  orderStatus?: string;
  redeemCode?: string;
  redeemQr?: string;
  partnerName?: string;
  date?: string;
  raw: any;
};

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.scss',
})
export class MyOrders implements OnInit, OnDestroy {
  private unsubscribers: Array<() => void> = [];

  pb!: PocketBase;

  orders: OrderItem[] = [];
  loading = false;
  error = '';

  user: any = null;
  clientProfile: any = null;

  constructor(
    private auth: AuthPocketbaseService,
    private route: ActivatedRoute,
     private cdr: ChangeDetectorRef,
  private zone: NgZone
  ) {
    this.pb = this.auth.pb;
  }

 async ngOnInit() {
  const restored = await this.auth.restoreSession();

  if (!restored) {
    this.loading = false;
    this.error = 'Debes iniciar sesión.';
    this.cdr.detectChanges();
    return;
  }

  await this.loadOrders();
  await this.listenOrdersChanges();

  this.route.queryParams.subscribe(async () => {
    await this.loadOrders();
  });
}

  async listenOrdersChanges() {
  if (this.unsubscribers.length) return;

  const collections = [
    'promo_orders',
    'product_orders',
    'ticket_orders',
    'table_reservations'
  ];

  for (const collection of collections) {
    const unsubscribe = await this.pb.collection(collection).subscribe('*', async () => {
      this.zone.run(async () => {
        await this.loadOrders();
      });
    });

    this.unsubscribers.push(unsubscribe);
  }
}

  ngOnDestroy() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
  }

  async loadOrders(): Promise<void> {
  this.zone.run(() => {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();
  });

  try {
    await this.auth.restoreSession();

    this.user =
      this.auth.currentUser ||
      this.auth.pb.authStore.record ||
      this.auth.pb.authStore.model;

    if (!this.user?.id) {
      this.zone.run(() => {
        this.error = 'Debes iniciar sesión para ver tus compras.';
        this.loading = false;
        this.cdr.detectChanges();
      });
      return;
    }

    this.clientProfile = await this.pb.collection('usuariosClient').getFirstListItem(
      `userId="${this.user.id}"`,
      { requestKey: null }
    );

    const clientId = this.clientProfile.id;
    const authUserId = this.user.id;

    const [
      promoOrders,
      productOrders,
      ticketOrders,
      reservations
    ] = await Promise.all([
      this.loadPromoOrders(clientId),
      this.loadProductOrders(authUserId),
      this.loadTicketOrders(authUserId),
      this.loadReservations(authUserId)
    ]);

    const loadedOrders = [
      ...promoOrders,
      ...productOrders,
      ...ticketOrders,
      ...reservations
    ].sort((a, b) => {
      const dateA = new Date(a.date || '').getTime();
      const dateB = new Date(b.date || '').getTime();
      return dateB - dateA;
    });

    this.zone.run(() => {
      this.orders = [...loadedOrders];
      this.cdr.detectChanges();
    });

  } catch (error: any) {
    console.error('Error cargando compras:', error);

    this.zone.run(() => {
      this.error = error?.message || 'No fue posible cargar tus compras.';
      this.cdr.detectChanges();
    });

  } finally {
    this.zone.run(() => {
      this.loading = false;
      this.cdr.detectChanges();
    });
  }
}

  async loadPromoOrders(clientId: string): Promise<OrderItem[]> {
    const records = await this.pb.collection('promo_orders').getFullList({
      filter: `buyerUserId="${clientId}"`,
      sort: '-created',
      expand: 'partnerId',
      requestKey: null
    });

    return records.map((item: any) => ({
      id: item.id,
      type: 'promo',
      title: item.paymentData?.promoName || 'Promoción',
      description: `Promoción comprada para reclamar en el local.`,
      amount: Number(item.amount || 0),
      status: item.status,
      orderStatus: item.orderStatus,
      redeemCode: item.redeemCode,
      redeemQr: item.paymentData?.redeemQr || '',
      partnerName: item.expand?.partnerId?.venueName || item.expand?.partnerId?.name || 'Local',
      date: item.created,
      raw: item
    }));
  }

  async loadProductOrders(authUserId: string): Promise<OrderItem[]> {
    const records = await this.pb.collection('product_orders').getFullList({
      filter: `buyerUserId="${authUserId}" || receiverUserId="${authUserId}"`,
      sort: '-created',
      expand: 'partnerId,productId',
      requestKey: null
    });

    return records.map((item: any) => ({
      id: item.id,
      type: 'product',
      title: item.productName || 'Producto / regalo',
      description: item.message || this.getProductOrderDescription(item),
      amount: Number(item.amount || 0),
      status: item.status,
      orderStatus: item.orderStatus,
      redeemCode: item.redeemCode,
      redeemQr: item.redeemQr,
      partnerName: item.expand?.partnerId?.venueName || item.expand?.partnerId?.name || 'Local',
      date: item.created,
      raw: item
    }));
  }

  async loadTicketOrders(authUserId: string): Promise<OrderItem[]> {
    const records = await this.pb.collection('ticket_orders').getFullList({
      filter: `buyerUserId="${authUserId}"`,
      sort: '-created',
      requestKey: null
    });

    return records.map((item: any) => ({
      id: item.id,
      type: 'ticket',
      title: item.partnerName || 'Entrada / ticket',
      description: item.tiketDate
        ? `Entrada para el ${this.formatDate(item.tiketDate)}`
        : 'Entrada comprada.',
      amount: Number(item.amount || 0),
      status: item.status,
      orderStatus: item.orderStatus,
      redeemCode: item.redeemCode,
      partnerName: item.partnerName || 'Local',
      date: item.created,
      raw: item
    }));
  }

  async loadReservations(authUserId: string): Promise<OrderItem[]> {
    const records = await this.pb.collection('table_reservations').getFullList({
      filter: `clientUserId="${authUserId}"`,
      sort: '-created',
      expand: 'partnerId',
      requestKey: null
    });

    return records.map((item: any) => ({
      id: item.id,
      type: 'reservation',
      title: item.partnerName || 'Reserva de mesa',
      description: `${item.people || 1} persona(s). ${item.message || ''}`,
      amount: Number(item.amount || 0),
      status: item.status,
      orderStatus: item.reservationType,
      redeemCode: '',
      partnerName: item.partnerName || item.expand?.partnerId?.venueName || 'Local',
      date: item.reservationDate || item.created,
      raw: item
    }));
  }

  getProductOrderDescription(item: any): string {
    if (item.orderType === 'gift') {
      return 'Regalo comprado para reclamar en el local.';
    }

    return 'Compra realizada para reclamar en el local.';
  }

  getBadgeLabel(order: OrderItem): string {
    if (order.type === 'promo') return 'Promo';
    if (order.type === 'product') return 'Regalo / compra';
    if (order.type === 'ticket') return 'Entrada';
    return 'Reserva';
  }

  getStatusLabel(order: OrderItem): string {
    if (order.orderStatus === 'redeemed') return 'Canjeado';
    if (order.orderStatus === 'cancelled') return 'Cancelado';
    if (order.status === 'paid') return 'Pagado';
    if (order.status === 'pending') return 'Pendiente';
    if (order.status === 'rejected') return 'Rechazado';
    return order.status || 'Activo';
  }

  async copyCode(code?: string): Promise<void> {
    if (!code) return;
    await navigator.clipboard.writeText(code);
  }

  formatDate(date?: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}