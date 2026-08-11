import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import PocketBase from 'pocketbase';
import Swal from 'sweetalert2';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';

type PartnerProofType = 'product' | 'ticket' | 'promo';

type PartnerProofItem = {
  id: string;
  collection: 'product_payment_proofs' | 'ticket_payment_proofs';
  type: PartnerProofType;
  title: string;
  buyerUserId: string;
  receiverUserId?: string;
  partnerId: string;
  amount: number;
  currency: string;
  status: string;
  redeemCode?: string;
  proofFile?: string;
  date: string;
  raw: any;
};

@Component({
  selector: 'app-partner-pending-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './partner-pending-orders.html',
  styleUrl: './partner-pending-orders.scss',
})
export class PartnerPendingOrders implements OnInit, OnDestroy {
  private pb: PocketBase;
  private unsubscribers: Array<() => void> = [];

  loading = false;
  processingId: string | null = null;
  error = '';

  partnerProfile: any = null;
  proofs: PartnerProofItem[] = [];

  activeFilter: 'pending' | 'approved' | 'rejected' = 'pending';
  showProofPreview = false;
selectedProofUrl = '';
selectedProofType: 'image' | 'pdf' | 'unknown' = 'unknown';
  constructor(
    private auth: AuthPocketbaseService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {
    this.pb = this.auth.pb;
  }

  async ngOnInit(): Promise<void> {
    await this.loadPartnerProfile();
    await this.loadProofs();
    await this.listenChanges();
  }

  ngOnDestroy(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
  }

  async loadPartnerProfile(): Promise<void> {
    await this.auth.restoreSession();

    const user =
      this.auth.currentUser ||
      this.auth.pb.authStore.record ||
      this.auth.pb.authStore.model;

    if (!user?.id) {
      this.error = 'Debes iniciar sesión como comercio.';
      return;
    }

    this.partnerProfile = await this.pb.collection('usuariosPartner').getFirstListItem(
      `userId="${user.id}"`,
      { requestKey: null }
    );
  }

  async loadProofs(): Promise<void> {
    if (!this.partnerProfile?.id) return;

    this.loading = true;
    this.error = '';
    this.proofs = [];
    this.cdr.detectChanges();

    try {
      const [productProofs, ticketProofs] = await Promise.all([
        this.pb.collection('product_payment_proofs').getFullList({
          filter: `partnerId="${this.partnerProfile.id}" && status="${this.activeFilter}"`,
          sort: '-created',
          requestKey: null
        }),
        this.pb.collection('ticket_payment_proofs').getFullList({
          filter: `partnerId="${this.partnerProfile.id}" && status="${this.activeFilter}"`,
          sort: '-created',
          requestKey: null
        })
      ]);

      const products: PartnerProofItem[] = productProofs.map((item: any) => ({
        id: item.id,
        collection: 'product_payment_proofs',
        type: 'product',
        title: item.productName || item.itemName || 'Producto',
        buyerUserId: item.buyerUserId,
        receiverUserId: item.receiverUserId,
        partnerId: item.partnerId,
        amount: Number(item.amount || item.amountUSD || item.amountBs || 0),
        currency: item.currency || (item.amountUSD ? 'USD' : item.amountBs ? 'VES' : 'COP'),
        status: item.status,
        redeemCode: item.redeemCode,
        proofFile: item.proofFile,
        date: item.created,
        raw: item
      }));

      const tickets: PartnerProofItem[] = ticketProofs.map((item: any) => {
        const isPromo =
          item.productName === 'Promoción' ||
          String(item.itemName || '').toLowerCase().includes('promo');

        return {
          id: item.id,
          collection: 'ticket_payment_proofs',
          type: isPromo ? 'promo' : 'ticket',
          title: item.itemName || item.productName || (isPromo ? 'Promoción' : 'Entrada'),
          buyerUserId: item.buyerUserId,
          partnerId: item.partnerId,
          amount: Number(item.amount || 0),
          currency: item.currency || 'COP',
          status: item.status,
          redeemCode: item.redeemCode,
          proofFile: item.proofFile,
          date: item.created,
          raw: item
        };
      });

      this.proofs = [...products, ...tickets].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

    } catch (error: any) {
      console.error('Error cargando comprobantes del comercio:', error);
      this.error = error?.message || 'No se pudieron cargar los comprobantes.';
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async listenChanges(): Promise<void> {
    if (this.unsubscribers.length) return;

    for (const collection of ['product_payment_proofs', 'ticket_payment_proofs']) {
      const unsubscribe = await this.pb.collection(collection).subscribe('*', async () => {
        this.zone.run(async () => {
          await this.loadProofs();
        });
      });

      this.unsubscribers.push(unsubscribe);
    }
  }
  openProofPreview(item: PartnerProofItem): void {
  const url = this.getProofFileUrl(item);

  if (!url) return;

  this.selectedProofUrl = url;

  const fileName = String(item.proofFile || '').toLowerCase();

  if (
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.webp')
  ) {
    this.selectedProofType = 'image';
  } else if (fileName.endsWith('.pdf')) {
    this.selectedProofType = 'pdf';
  } else {
    this.selectedProofType = 'unknown';
  }

  this.showProofPreview = true;
}

closeProofPreview(): void {
  this.showProofPreview = false;
  this.selectedProofUrl = '';
  this.selectedProofType = 'unknown';
}
  async changeFilter(status: 'pending' | 'approved' | 'rejected'): Promise<void> {
    this.activeFilter = status;
    await this.loadProofs();
  }

  async approveProof(item: PartnerProofItem): Promise<void> {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Aprobar compra',
      text: `¿Aprobar ${item.title}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    this.processingId = item.id;

    try {
      await this.pb.collection(item.collection).update(item.id, {
        status: 'approved',
        validatedAt: new Date().toISOString()
      }, { requestKey: null });

      await this.loadProofs();

      Swal.fire({
        icon: 'success',
        title: 'Compra aprobada',
        timer: 1300,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error('Error aprobando compra:', error);

      Swal.fire({
        icon: 'error',
        title: 'No se pudo aprobar',
        text: error?.message || 'Revisa permisos y campos.'
      });

    } finally {
      this.processingId = null;
      this.cdr.detectChanges();
    }
  }

  async rejectProof(item: PartnerProofItem): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Rechazar compra',
      input: 'text',
      inputPlaceholder: 'Motivo del rechazo',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    this.processingId = item.id;

    try {
      await this.pb.collection(item.collection).update(item.id, {
        status: 'rejected',
        adminNotes: result.value || 'Comprobante rechazado por el comercio',
        validatedAt: new Date().toISOString()
      }, { requestKey: null });

      await this.loadProofs();

      Swal.fire({
        icon: 'success',
        title: 'Compra rechazada',
        timer: 1300,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error('Error rechazando compra:', error);

      Swal.fire({
        icon: 'error',
        title: 'No se pudo rechazar',
        text: error?.message || 'Revisa permisos y campos.'
      });

    } finally {
      this.processingId = null;
      this.cdr.detectChanges();
    }
  }

  getProofFileUrl(item: PartnerProofItem): string {
    if (!item.proofFile) return '';
    return this.pb.files.getUrl(item.raw, item.proofFile);
  }

  getMoneyLabel(amount: number, currency = 'COP'): string {
    const value = Number(amount || 0);

    if (currency === 'USD') {
      return `${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} USD`;
    }

    if (currency === 'VES') {
      return `${value.toLocaleString('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} Bs`;
    }

    return `${value.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })} COP`;
  }

  getTypeLabel(type: PartnerProofType): string {
    if (type === 'promo') return 'Promoción';
    if (type === 'ticket') return 'Entrada';
    return 'Producto / regalo';
  }

  getStatusLabel(status: string): string {
    if (status === 'approved') return 'Aprobado';
    if (status === 'rejected') return 'Rechazado';
    return 'Pendiente';
  }
}