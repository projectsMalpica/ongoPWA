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

@Component({
  selector: 'app-home-local',
  standalone: true,
  imports: [CommonModule],
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
  constructor(public global: GlobalService,
    public http: HttpClient,
    public auth: AuthPocketbaseService,
    public wompi: WompiService
  ) {}

  ngOnInit(): void {
    this.global.initPlanningPartnersRealtime();
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


}

