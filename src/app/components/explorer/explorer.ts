import { Component, OnDestroy, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import Swiper from 'swiper';
import { Autoplay, Pagination, Navigation } from 'swiper/modules';

@Component({
  selector: 'app-explorer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './explorer.html',
  styleUrl: './explorer.scss',
})
export class Explorer implements OnInit, OnDestroy, AfterViewInit {
  partners: any[] = [];
  promos: any[] = [];
  partnerStats:any = {};
  private promoSwiper?: Swiper;

  constructor(
    public global: GlobalService,
    public router: Router,
    public changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.global.initPartnersRealtime();
    this.global.initPromosRealtime();

    this.global.partners$.subscribe((partners: any[]) => {
      this.partners = partners;
      this.loadPartnerStats();
      this.changeDetectorRef.detectChanges();
    });

    this.global.promos$.subscribe((promos: any[]) => {
      this.promos = promos;

      setTimeout(() => {
        this.initPromoSwiper();
      }, 100);
    });
  }
  async loadPartnerStats(){

 for(const partner of this.partners){

   const stats =
   await this.global.getPartnerStats(partner.id);


   this.partnerStats[partner.id] =
   stats?.['currentVisitors'] || 0;

 }

}
  initPromoSwiper(): void {
    if (this.promoSwiper) {
      this.promoSwiper.destroy(true, true);
    }

    this.promoSwiper = new Swiper('.spot-swiper1', {
      modules: [Autoplay, Pagination, Navigation],
      slidesPerView: 1.2,
      spaceBetween: 12,
      loop: this.promos.length > 1,
      autoplay: {
        delay: 3000,
        disableOnInteraction: false,
      },
      observer: true,
      observeParents: true,
      breakpoints: {
        576: {
          slidesPerView: 2,
        },
        768: {
          slidesPerView: 3,
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.promoSwiper?.destroy(true, true);
  }

  ngAfterViewInit(): void {
    this.initPromoSwiper();
    this.changeDetectorRef.detectChanges();
  }

  goToPartner(partner: any): void {
    if (!partner?.id) return;
    localStorage.setItem('selectedPartner', JSON.stringify(partner));
    this.router.navigate(['/detailprofilelocal', partner.id]);
  }

 goToPromo(promo: any): void {
  if (!promo?.id) return;

  localStorage.setItem('selectedPromoToBuy', JSON.stringify(promo));
  localStorage.setItem('selectedPromo', JSON.stringify(promo));

  this.router.navigate(['/checkout-promo', promo.id]);
}
}