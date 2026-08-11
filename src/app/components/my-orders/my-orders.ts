import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import PocketBase from 'pocketbase';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { ActivatedRoute } from '@angular/router';

type OrderItem = {
  id: string;
/*   type: 'promo' | 'product' | 'ticket' | 'reservation' | 'manual_product_payment';
 */  type: 'promo' | 'product' | 'ticket' | 'reservation' | 'manual_product_payment' | 'manual_promo_payment' | 'manual_ticket_payment';
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
  currency?: string;
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
  activeFilter: 'all' | 'pending' | 'approved' | 'paid' = 'all';

get filteredOrders(): OrderItem[] {
  if (this.activeFilter === 'all') return this.orders;

  if (this.activeFilter === 'pending') {
    return this.orders.filter(order =>
      order.status === 'pending' ||
      order.orderStatus === 'pending' ||
      order.orderStatus === 'pending_payment'
    );
  }

  if (this.activeFilter === 'approved') {
    return this.orders.filter(order =>
      order.status === 'approved' ||
      order.orderStatus === 'approved'
    );
  }

  if (this.activeFilter === 'paid') {
    return this.orders.filter(order =>
      order.status === 'paid' ||
      order.orderStatus === 'active' ||
      order.orderStatus === 'pending_redeem'
    );
  }

  return this.orders;
}
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

  /* const collections = [
    'promo_orders',
    'product_orders',
    'ticket_orders',
    'table_reservations',
    'product_payment_proofs'
  ]; */

  const collections = [
  'promo_orders',
  'product_orders',
  'ticket_orders',
  'table_reservations',
  'product_payment_proofs',
  'ticket_payment_proofs'
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
  reservations,
  manualProductPayments,
  manualTicketPromoPayments
] = await Promise.all([
  this.loadPromoOrders(clientId),
  this.loadProductOrders(authUserId),
  this.loadTicketOrders(authUserId),
  this.loadReservations(authUserId),
  this.loadManualProductPayments(authUserId),
  this.loadManualTicketPromoPayments(authUserId)
]);

   const loadedOrders = [
  ...manualProductPayments,
  ...manualTicketPromoPayments,
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
async loadManualTicketPromoPayments(authUserId: string): Promise<OrderItem[]> {
  const records = await this.pb.collection('ticket_payment_proofs').getFullList({
    filter: `buyerUserId="${authUserId}"`,
    sort: '-created',
    expand: 'partnerId',
    requestKey: null
  });

  return records.map((item: any) => {
    const isPromo =
      item.productName === 'Promoción' ||
      item.itemName?.toLowerCase?.().includes('promo');

    return {
      id: item.id,
      type: isPromo ? 'manual_promo_payment' : 'manual_ticket_payment',
      title: item.itemName || item.productName || (isPromo ? 'Promoción pendiente' : 'Entrada pendiente'),
      description:
        item.status === 'approved'
          ? 'Pago aprobado. Ya puedes reclamar en el local.'
          : item.status === 'rejected'
            ? 'El comercio rechazó este comprobante.'
            : 'Comprobante enviado. El comercio está validando tu pago.',
      amount: Number(item.amount || 0),
      currency: item.currency || 'COP',
      status: item.status,
      orderStatus: item.status,
      redeemCode: item.status === 'approved' ? item.redeemCode : '',
      partnerName: item.expand?.partnerId?.venueName || item.expand?.partnerId?.name || 'Local',
      date: item.created,
      raw: item
    };
  });
}
async loadManualProductPayments(authUserId: string): Promise<OrderItem[]> {
  const records = await this.pb.collection('product_payment_proofs').getFullList({
    filter: `buyerUserId="${authUserId}" || receiverUserId="${authUserId}"`,
    sort: '-created',
    expand: 'partnerId,productId',
    requestKey: null
  });

  return records.map((item: any) => ({
    id: item.id,
    type: 'manual_product_payment',
    title: item.productName || 'Compra pendiente',
    description:
      item.status === 'approved'
        ? 'Pago aprobado. Puedes reclamar este producto en el local.'
        : item.status === 'rejected'
          ? 'El comercio rechazó este comprobante.'
          : 'Comprobante enviado. El comercio está validando tu pago.',
    amount: Number(item.amount || item.amountBs || item.amountUSD || 0),
    currency: item.currency || (item.amountBs ? 'VES' : item.amountUSD ? 'USD' : 'COP'),
    status: item.status,
    orderStatus: item.status,
    redeemCode: item.status === 'approved' ? item.redeemCode : '',
    partnerName: item.expand?.partnerId?.venueName || item.expand?.partnerId?.name || 'Local',
    date: item.created,
    raw: item
  }));
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
      description: (item.ticketDate ?? item.tiketDate)
        ? `Entrada para el ${this.formatDate(item.ticketDate ?? item.tiketDate)}`
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
  if (order.type === 'manual_product_payment') return 'Pago manual';
  if (order.type === 'promo') return 'Promo';
  if (order.type === 'product') return 'Regalo / compra';
  if (order.type === 'ticket') return 'Entrada';
  return 'Reserva';
}
/* getBadgeLabel(order: OrderItem): string {
  if (order.type === 'manual_product_payment') return 'Producto manual';
  if (order.type === 'manual_promo_payment') return 'Promo manual';
  if (order.type === 'manual_ticket_payment') return 'Entrada manual';
  if (order.type === 'promo') return 'Promo';
  if (order.type === 'product') return 'Regalo / compra';
  if (order.type === 'ticket') return 'Entrada';
  return 'Reserva';
} */
 getStatusLabel(order: OrderItem): string {
  if (order.status === 'approved') return 'Aprobado';
  if (order.status === 'rejected') return 'Rechazado';
  if (order.orderStatus === 'redeemed') return 'Canjeado';
  if (order.orderStatus === 'cancelled') return 'Cancelado';
  if (order.status === 'paid') return 'Pagado';
  if (order.status === 'pending') return 'Pendiente de aprobación';
  return order.status || 'Activo';
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
