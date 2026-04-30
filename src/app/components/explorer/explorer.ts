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
      this.changeDetectorRef.detectChanges();
    });

    this.global.promos$.subscribe((promos: any[]) => {
      this.promos = promos;

      setTimeout(() => {
        this.initPromoSwiper();
      }, 100);
    });
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
  if (!promo) return;

  // Caso 1: la promo tiene directamente el id del local
  if (promo.partner) {
    const partner = this.partners.find(p => p.id === promo.partner);

    if (partner) {
      localStorage.setItem('selectedPartner', JSON.stringify(partner));
      this.router.navigate(['/detailprofilelocal', partner.id]);
      return;
    }
  }

  // Caso 2: la promo está relacionada por userId
  if (promo.userId) {
    const partner = this.partners.find(p => p.userId === promo.userId);

    if (partner) {
      localStorage.setItem('selectedPartner', JSON.stringify(partner));
      this.router.navigate(['/detailprofilelocal', partner.id]);
      return;
    }
  }

  console.warn('No se encontró local asociado a esta promoción:', promo);
}
}