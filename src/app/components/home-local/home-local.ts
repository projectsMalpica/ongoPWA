import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GlobalService } from '../../services/global.service';
import { HttpClient } from '@angular/common/http';
import { WompiService } from '../../services/wompi.service';
import { environment } from '../../environments/environment';
import { Subscription, lastValueFrom } from 'rxjs';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import Swiper from 'swiper';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { PartnerStatsService } from '../../services/partnerStats.service';

@Component({
  selector: 'app-home-local',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home-local.html',
  styleUrl: './home-local.scss',
})
export class HomeLocal implements AfterViewInit, OnDestroy {
  @ViewChild('partnerPlansSwiper', { static: false })
  partnerPlansSwiperRef?: ElementRef<HTMLDivElement>;

  @ViewChild('partnerPlansPagination', { static: false })
  partnerPlansPaginationRef?: ElementRef<HTMLDivElement>;

  private partnerPlansSwiper?: Swiper;
  private partnerPlansSwiperSub?: Subscription;
  paymentModalOpen = false;
  loadingTx = false;
  tx?: any;
  txError?: string;
  giftOrders: any[] = [];
  loadingGiftOrders = false;
  peopleInside = 0;
  ambientLevel = 'Chill';
  ambientManual = false;
  stats: any;

  constructor(public global: GlobalService,
    public http: HttpClient,
    public auth: AuthPocketbaseService,
    public wompi: WompiService,
    public router: Router,
    public partnerStats: PartnerStatsService
  ) { }
  openPremiumPromo(): void {
    if (!this.requirePartnerSubscription('Crear promociones')) {
      return;
    }

    this.router.navigate(['/profile-local']);
  }
  goToProfileLocal(): void {
    this.router.navigate(['/profile-local']);
  }
  async ngOnInit(): Promise<void> {
    await this.auth.restoreSession();

    await this.loadPartnerProfileForHome();
    const profile =
      this.auth.getCurrentProfile();


    this.stats =
      await this.partnerStats.getStats(
        profile.id
      );
    this.global.initPlanningPartnersRealtime();

    setTimeout(() => {
      this.loadGiftOrders();
    }, 500);
  }
  async loadPartnerProfileForHome(): Promise<void> {
    const user = this.auth.getCurrentUser();

    if (!user?.id) {
      console.warn('No hay usuario autenticado en HomeLocal');
      return;
    }

    try {
      const partner = await this.global.pb
        .collection('usuariosPartner')
        .getFirstListItem(`userId="${user.id}"`, {
          requestKey: null
        });

      this.global.profileDataPartner = {
        ...this.global.profileDataPartner,

        id: partner.id,
        userId: partner['userId'] || '',
        name: partner['name'] || '',
        venueName: partner['venueName'] || '',
        email: partner['email'] || '',
        phone: partner['phone'] || '',
        avatar: partner['avatar']
          ? this.global.pb.files.getUrl(partner, partner['avatar'])
          : this.global.profileDataPartner?.avatar || '',

        subscriptionPlanName: partner['subscriptionPlanName'] || '',
        subscriptionPlanId: partner['subscriptionPlanId'] || '',
        subscriptionStatus: partner['subscriptionStatus'] || '',
        subscriptionStartsAt: partner['subscriptionStartsAt'] || '',
        subscriptionExpiresAt: partner['subscriptionExpiresAt'] || '',
        subscriptionAutoRenew: partner['subscriptionAutoRenew'] || false,
        ambientLevel: partner['ambientLevel'] || 'Chill'
      };
      this.ambientLevel =
        this.global.profileDataPartner.ambientLevel;
      if (
        this.global.profileDataPartner.subscriptionStatus === 'active' &&
        this.global.profileDataPartner.subscriptionExpiresAt &&
        new Date(this.global.profileDataPartner.subscriptionExpiresAt).getTime() <= Date.now()

      ) {
        await this.global.pb.collection('usuariosPartner').update(partner.id, {
          subscriptionStatus: 'expired'
        }, { requestKey: null });

        this.global.profileDataPartner.subscriptionStatus = 'expired';
      }

    } catch (error) {
      console.error('Error cargando perfil partner en home:', error);
    }
  }
  async loadGiftOrders(): Promise<void> {
    const partnerId = this.global.profileDataPartner?.id;

    if (!partnerId) {
      console.warn('No hay partnerId para cargar regalos');
      return;
    }

    this.loadingGiftOrders = true;

    try {
      this.giftOrders = await this.global.pb.collection('product_orders').getFullList({
        filter: `partnerId="${partnerId}" && orderType="gift" && orderStatus="pending_redeem"`,
        sort: '-created',
        expand: 'receiverUserId,buyerUserId',
        requestKey: null
      });
    } catch (error) {
      console.error('Error cargando regalos pendientes:', error);
    } finally {
      this.loadingGiftOrders = false;
    }
  }
  async markGiftAsRedeemed(order: any): Promise<void> {
    if (!order?.id) return;

    const confirm = window.confirm(
      `¿Confirmas que entregaste "${order.productName}" con el código ${order.redeemCode}?`
    );

    if (!confirm) return;

    try {
      await this.global.pb.collection('product_orders').update(order.id, {
        orderStatus: 'redeemed',
        status: 'completed',
        redeemedAt: new Date().toISOString()
      }, { requestKey: null });

      this.giftOrders = this.giftOrders.filter(item => item.id !== order.id);
    } catch (error) {
      console.error('Error reclamando regalo:', error);
    }
  }
  async selectPlan(plan: { id: string; name: string; priceCOP: number; role: 'partner' | 'client' }) {
    const reference = `suscrip-${plan.role}-${plan.id}-${crypto.randomUUID()}`;

    // 1) firma exactamente con los mismos valores que mandarás al widget
    const { signature } = await lastValueFrom(
      this.http.post<{ signature: string }>('/api/pago/sign', {
        amountInCents: Math.round(plan.priceCOP * 100),
        currency: 'COP',
        reference,
        // expirationTime: '2025-12-31T23:59:59.000Z' // si decides usarla, pásala también al widget
      })
    );

    // 2) abre el widget (modal: no pasar redirectUrl)
    const result = await this.wompi.openCheckout({
      amountInCents: Math.round(plan.priceCOP * 100),
      reference,
      currency: 'COP',
      customerEmail: this.auth.currentUser?.email || undefined,
      signature,
      publicKey: environment.WOMPI_PUBLIC_KEY,   // evita merchants/undefined
      // redirectUrl: `${location.origin}/pago/resultado` // ← usar solo si prefieres redirigir
    });
    console.log('widget result:', result);

    // 3) muestra modal y confirma estado
    this.paymentModalOpen = true;
    this.loadingTx = true;
    this.tx = undefined; this.txError = undefined;

    // el id de transacción puede venir con distintos nombres según el método
    const txId: string | undefined =
      result?.transaction?.id ?? result?.transactionId ?? result?.id;

    if (txId) {
      this.http.get(`/api/pago/tx/${encodeURIComponent(txId)}`).subscribe({
        next: (data: any) => { this.tx = data?.data; this.loadingTx = false; },
        error: (e) => { this.txError = e?.error?.error || 'Error consultando'; this.loadingTx = false; }
      });
    } else {
      // Fallback por referencia si el widget no entregó id
      this.http.get(`/api/pago/tx/by-reference/${encodeURIComponent(reference)}`).subscribe({
        next: (data: any) => {
          const last = data?.data?.[0];
          if (!last) { this.txError = 'No se encontró transacción'; this.loadingTx = false; return; }
          this.tx = last; this.loadingTx = false;
        },
        error: (e) => { this.txError = e?.error?.error || 'Error consultando por referencia'; this.loadingTx = false; }
      });
    }
  }
  ngAfterViewInit(): void {
    this.bindPartnerPlansSwiper();
  }
  private bindPartnerPlansSwiper(): void {
    this.partnerPlansSwiperSub?.unsubscribe();

    this.partnerPlansSwiperSub = this.global.planningPartners$.subscribe((plans) => {
      if (!plans || !plans.length) return;

      setTimeout(() => {
        this.initPartnerPlansSwiper();
      }, 0);
    });
  }

  private initPartnerPlansSwiper(): void {
    if (!this.partnerPlansSwiperRef?.nativeElement || !this.partnerPlansPaginationRef?.nativeElement) {
      return;
    }

    if (this.partnerPlansSwiper) {
      this.partnerPlansSwiper.destroy(true, true);
    }

    this.partnerPlansSwiper = new Swiper(this.partnerPlansSwiperRef.nativeElement, {
      modules: [Pagination],
      slidesPerView: 1.08,
      spaceBetween: 12,
      grabCursor: true,
      observer: true,
      observeParents: true,
      watchOverflow: true,
      pagination: {
        el: this.partnerPlansPaginationRef.nativeElement,
        clickable: true
      },
      breakpoints: {
        576: {
          slidesPerView: 1.15,
          spaceBetween: 14
        },
        768: {
          slidesPerView: 1.35,
          spaceBetween: 16
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.partnerPlansSwiper?.destroy(true, true);
    this.partnerPlansSwiperSub?.unsubscribe();
  }

  closePaymentModal() {
    this.paymentModalOpen = false;
    this.tx = undefined; this.txError = undefined;
  }

  hasActivePartnerSubscription(): boolean {
    return (
      this.global.profileDataPartner?.subscriptionStatus === 'active' &&
      this.global.profileDataPartner?.subscriptionExpiresAt &&
      new Date(this.global.profileDataPartner.subscriptionExpiresAt).getTime() > Date.now()
    );
  }

  getPartnerPlanName(): string {
    return this.global.profileDataPartner?.subscriptionPlanName || 'Plan gratuito';
  }

  getPartnerPlanExpiresLabel(): string {
    const expiresAt = this.global.profileDataPartner?.subscriptionExpiresAt;

    if (!expiresAt) return '';

    return new Date(expiresAt).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  requirePartnerSubscription(featureName: string): boolean {
    if (this.hasActivePartnerSubscription()) {
      return true;
    }

    Swal.fire({
      icon: 'info',
      title: 'Función VIP',
      text: `${featureName} requiere una suscripción activa.`,
      confirmButtonText: 'Ver planes'
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/profile-local']);
      }
    });

    return false;
  }

  /* async setAmbient(level: string) {
  
    const partnerId = this.global.profileDataPartner?.id;
  
    if (!partnerId) {
      console.warn('No existe partner');
      return;
    }
  
    this.ambientManual = true;
    this.ambientLevel = level;
  
  
    try {
  
      await this.global.pb
        .collection('usuariosPartner')
        .update(partnerId, {
  
          ambientLevel: level,
          ambientUpdatedAt: new Date().toISOString()
  
        },{
          requestKey:null
        });
  
  
      console.log(
        'Ambiente actualizado:',
        level
      );
  
  
    } catch(error){
  
      console.error(
        'Error guardando ambiente',
        error
      );
  
    }
  
  } */
  async setAmbient(level: string) {

    this.ambientLevel = level;

    this.global.profileDataPartner.ambientLevel = level;


    const partnerId = this.global.profileDataPartner?.id;

    if (!partnerId) return;


    await this.global.pb
      .collection('usuariosPartner')
      .update(partnerId, {

        ambientLevel: level,
        ambientUpdatedAt: new Date().toISOString()

      }, {
        requestKey: null
      });

  }
  updateAmbientLevel() {
    if (this.peopleInside < 20) {
      this.ambientLevel = 'Chill';
    } else if (this.peopleInside < 50) {
      this.ambientLevel = 'Activo';
    } else {
      this.ambientLevel = 'Full';
    }
  }
}

