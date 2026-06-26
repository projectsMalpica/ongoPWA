import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import PocketBase from 'pocketbase';
import * as bootstrap from 'bootstrap';
import * as mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { GlobalService } from '../../services/global.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { ModalService } from '../../services/modal.service';
import { WompiService } from '../../services/wompi.service';
import Swal from 'sweetalert2';
import Swiper from 'swiper';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { RealtimePlanningPartnerService } from '../../services/realtime-planningPartner.service';
@Component({
  selector: 'app-profile-local',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile-local.html',
  styleUrl: './profile-local.scss',
})
export class ProfileLocal implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('plansSwiper', { static: false }) plansSwiperRef?: ElementRef<HTMLDivElement>;
  @ViewChild('plansPagination', { static: false }) plansPaginationRef?: ElementRef<HTMLDivElement>;
  partnerProducts: any[] = [];

  private plansSwiper?: Swiper;
  private plansSwiperSub?: Subscription;
  /* newProduct = {
    name: '',
    description: '',
    category: '',
    price: null as number | null,
    isAvailable: true,
    userId: '',
    partnerId: ''
  }; */
  newProduct = {
    name: '',
    description: '',
    category: '',
    price: null as number | null,
    currency: 'COP',
    country: 'CO',
    isAvailable: true,
    userId: '',
    partnerId: ''
  };
  subscribingPlanId: string | null = null;
  productImageFile: File | null = null;
  isEditingProduct: boolean = false;
  editingProductId: string | null = null;
  todayStats = {
    giftsRedeemed: 0,
    ticketsSold: 0,
    ticketsUsed: 0,
    revenue: 0
  };

  loadingStats = false;


  @ViewChild('promoOptionsModal', { static: false }) promoOptionsModalRef!: ElementRef;
  @ViewChild('mapRef', { static: false }) mapRef!: ElementRef;
  toastMessage: string = '';
  toastType: 'success' | 'error' | 'info' = 'info';
  showToast: boolean = false;
  @ViewChild('mapContainer') mapContainer?: ElementRef;
  map?: mapboxgl.Map;
  private mapInitialized = false;

  selectedLat: number | null = null;
  selectedLng: number | null = null;
  marker!: mapboxgl.Marker;
  coordenadasSeleccionadas: { lat: number, lng: number } | null = null;
  isEditingPromo: boolean = false;
  editingPromoId: string | null = null;
  showSuccessToast = false;
  isEditProfile: boolean = false;
  Profile: boolean = false;
  planningPartners: any[] = [];
  newAvatar: File | null = null;
  avatarPreview: string | ArrayBuffer | null = null;
  photosPartner: any[] = Array(6).fill({});
  selectedServices: string[] = [];
  serviceSearch: string = '';
  servicesPartner = [
    { value: 'Eventos', label: 'Eventos' },
    { value: 'Fiesta', label: 'Fiesta' },
    { value: 'Cenas', label: 'Cenas' },
    { value: 'Tragos', label: 'Tragos' }
  ];
  lat: number = 0;
  lng: number = 0;
  newPromo = {
  name: '',
  description: '',
  date: '',
  price: null as number | null,
  currency: 'COP',
  country: 'CO',
  files: [],
  userId: '',
};
  showPromos = false;
  isServicesOffcanvasOpen = false;
  selectedPaymentCountry: 'CO' | 'VE' = 'CO';
  selectedPlan: any = null;
  paymentProofFile: File | null = null;

  filteredServices: { value: string; label: string }[] = [...this.servicesPartner];
  promoImageFile: File | null = null;
  successPromoToast = false
  private pb = new PocketBase('https://db.ongomatch.com:8090');
  promosByPartner: any[] = [];
  seleccionMarker!: mapboxgl.Marker;
  selectedMarker!: mapboxgl.Marker;
  redeemCodeInput = '';
  redeemOrder: any = null;
  redeemLoading = false;
  redeemMessage = '';
  redeemError = '';
  peopleInside = 0;
  ambientLevel = 'Chill';
  giftOrders: any[] = [];
  loadingGiftOrders = false;
  subscriptionPlans: any[] = [];
  planningSubscription: any;
  ticketCodeInput = '';
  ticketOrder: any = null;
  ticketRedeemLoading = false;
  ticketRedeemMessage = '';
  ticketRedeemError = '';

  constructor(
    public global: GlobalService,
    public auth: AuthPocketbaseService,
    public modalService: ModalService,
    public http: HttpClient,
    public wompi: WompiService,
    private planningPartnerService: RealtimePlanningPartnerService,
    private cdr: ChangeDetectorRef
  ) {
    this.loadPromotionsForPartner();
    this.pb.autoCancellation(false);
  }


  async ngOnInit() {
    this.fetchPartnerData();

    await this.global.initPlanningPartnersRealtime();

    this.plansSwiperSub = this.global.planningPartners$.subscribe((plans) => {
      this.subscriptionPlans = plans || [];
      console.log('Planes cargados:', this.subscriptionPlans);

      setTimeout(() => {
        this.initPlansSwiper();
        this.cdr.detectChanges();
      }, 0);
    });

    await this.loadProfileDataPartner();
    await this.loadPartnerProducts();
    await this.loadTodayStats();

    this.initMapIfReady();
  }
  onPromoCountryChange(): void {
  this.newPromo.currency = this.getDefaultCurrencyByCountry(this.newPromo.country);
}
  getSubscriptionStatusLabel(): string {

    const status =
      this.global.profileDataPartner.subscriptionStatus;

    if (status === 'pending') {
      return 'Validando';
    }

    if (
      status === 'active' &&
      this.hasActivePartnerSubscription()
    ) {
      return 'Activo';
    }

    return 'Free';
  }
  async submitManualPaymentProof() {
    if (!this.selectedPlan || !this.paymentProofFile) return;

    try {
      await this.auth.restoreSession();

      const user = this.auth.getCurrentUser();

      const partnerId = this.global.profileDataPartner?.id;

      if (!user?.id || !partnerId) {
        Swal.fire({
          icon: 'warning',
          title: 'Perfil no disponible',
          text: 'No se encontró el usuario o el local asociado.'
        });
        return;
      }

      const formData = new FormData();

      formData.append('partnerId', partnerId);
      formData.append('userId', user.id);
      formData.append('planId', this.selectedPlan.id);
      formData.append('planName', this.selectedPlan.name || '');
      formData.append('field', 'comprobante_pago_venezuela');
      formData.append('amountUSD', String(Number(this.selectedPlan.PriceUSD || 0)));
      formData.append('amountBs', '0');
      formData.append('bcvRate', '0');
      formData.append('country', 'VE');
      formData.append('paymentMethod', 'Pago móvil / transferencia');
      formData.append('status', 'pending');
      formData.append('adminNotes', '');
      formData.append('proofFile', this.paymentProofFile);

      await this.pb.collection('partner_payment_proofs').create(formData, {
        requestKey: null
      });

      await this.pb.collection('usuariosPartner').update(partnerId, {
        subscriptionStatus: 'pending',
        subscriptionPlanId: this.selectedPlan.id,
        subscriptionPlanName: this.selectedPlan.name || '',
        subscriptionStartsAt: '',
        subscriptionExpiresAt: '',
        subscriptionAutoRenew: false
      }, {
        requestKey: null
      });

      this.global.profileDataPartner.subscriptionStatus = 'pending';
      this.global.profileDataPartner.subscriptionPlanId = this.selectedPlan.id;
      this.global.profileDataPartner.subscriptionPlanName = this.selectedPlan.name || '';

      const modalEl = document.getElementById('manualPaymentModal');
      if (modalEl) {
        bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      }

      this.paymentProofFile = null;
      this.selectedPlan = null;

      this.cdr.detectChanges();

      Swal.fire({
        icon: 'success',
        title: 'Comprobante enviado',
        text: 'Validaremos tu pago y activaremos tu plan en menos de 12 horas.'
      });

      this.paymentProofFile = null;
      this.selectedPlan = null;

    } catch (error: any) {
      console.error('Error enviando comprobante:', error);
      console.error('Detalle PocketBase:', error?.data?.data);

      Swal.fire({
        icon: 'error',
        title: 'No se pudo enviar',
        text: error?.data?.message || error?.message || 'Error al enviar comprobante.'
      });
    }
  }
  getPlanItems(plan: any): string[] {
    const items = plan?.items;

    if (!items) return [];

    if (Array.isArray(items)) {
      return items.map(String).filter(Boolean);
    }

    if (typeof items === 'string') {
      return items
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }

    return [];
  }
  openSubscriptionsModal() {
    const modalEl = document.getElementById('subscriptionsModal');
    if (modalEl) {
      const modalInstance = new bootstrap.Modal(modalEl);
      modalInstance.show();
    } else {
      console.warn('No se encontró el modal de subscripciones en el DOM');
    }
  }
  async loadTodayStats() {

    const partnerId = this.global.profileDataPartner?.id;

    if (!partnerId) return;


    this.loadingStats = true;


    try {

      const start = new Date();
      start.setHours(0, 0, 0, 0);


      const end = new Date();
      end.setHours(23, 59, 59, 999);


      const startISO = start.toISOString();
      const endISO = end.toISOString();



      // 🎁 regalos entregados hoy

      const gifts = await this.pb
        .collection('product_orders')
        .getFullList({

          filter:
            `partnerId="${partnerId}" 
        && orderType="gift"
        && orderStatus="redeemed"
        && redeemedAt >= "${startISO}"
        && redeemedAt <= "${endISO}"`,

          requestKey: null

        });



      // 🎟️ entradas vendidas hoy

      const tickets = await this.pb
        .collection('ticket_orders')
        .getFullList({

          filter:
            `partnerId="${partnerId}"
        && status="paid"
        && created >= "${startISO}"
        && created <= "${endISO}"`,

          requestKey: null

        });



      // 🚪 entradas usadas hoy

      const usedTickets = tickets.filter(
        t => t['orderStatus'] === 'redeemed'
      );



      this.todayStats = {

        giftsRedeemed: gifts.length,

        ticketsSold: tickets.length,

        ticketsUsed: usedTickets.length,

        revenue: tickets.reduce(
          (sum, t) => sum + Number(t['amount'] || 0),
          0
        )

      };



    } catch (error) {

      console.error(
        'Error cargando estadísticas',
        error
      );

    } finally {

      this.loadingStats = false;

    }

  }
  async searchTicketByCode(): Promise<void> {

    let partnerId = this.global.profileDataPartner?.id;
    const code = this.ticketCodeInput.trim();

    this.ticketOrder = null;
    this.ticketRedeemMessage = '';
    this.ticketRedeemError = '';

    // Si no existe el id del local en memoria, buscarlo
    if (!partnerId) {

      const userId = this.auth.currentUser?.id;

      if (!userId) {
        this.ticketRedeemError = 'No hay usuario autenticado.';
        return;
      }

      try {

        const partner = await this.pb
          .collection('usuariosPartner')
          .getFirstListItem(
            `userId="${userId}"`,
            { requestKey: null }
          );

        partnerId = partner.id;

        // Guardar en memoria
        this.global.profileDataPartner.id = partner.id;

      } catch (error) {
        console.error('Error buscando local:', error);
        this.ticketRedeemError = 'No se encontró el local.';
        return;
      }
    }

    if (!code) {
      this.ticketRedeemError = 'Ingresa el código de la entrada.';
      return;
    }

    this.ticketRedeemLoading = true;

    try {

      const order = await this.pb
        .collection('ticket_orders')
        .getFirstListItem(
          `partnerId="${partnerId}" && redeemCode="${code}" && status="paid"`,
          { requestKey: null }
        );

      this.ticketOrder = order;

      if (order['orderStatus'] === 'redeemed') {

        this.ticketRedeemError = 'Esta entrada ya fue canjeada.';

      } else {

        this.ticketRedeemMessage =
          'Entrada válida. Puedes permitir el ingreso.';
      }

    } catch (error) {

      console.error('Error buscando ticket:', error);

      this.ticketRedeemError =
        'No encontramos una entrada válida con ese código.';

    } finally {

      this.ticketRedeemLoading = false;
      this.cdr.detectChanges();

    }
  }

  async confirmRedeemTicket(): Promise<void> {
    if (!this.ticketOrder?.id) return;

    const result = await Swal.fire({
      icon: 'question',
      title: '¿Validar entrada?',
      text: `Confirmar ingreso para ${this.ticketOrder.partnerName}`,
      confirmButtonText: 'Sí, validar',
      cancelButtonText: 'Cancelar',
      showCancelButton: true
    });

    if (!result.isConfirmed) return;

    await this.pb.collection('ticket_orders').update(this.ticketOrder.id, {
      orderStatus: 'redeemed',
      redeemedAt: new Date().toISOString()
    }, { requestKey: null });

    this.ticketRedeemMessage = 'Entrada canjeada correctamente.';
    this.ticketCodeInput = '';
    this.ticketOrder = null;
  }
  async searchGiftByCode(): Promise<void> {
    const partnerId = this.global.profileDataPartner?.id;
    const code = this.redeemCodeInput.trim();

    this.redeemOrder = null;
    this.redeemMessage = '';
    this.redeemError = '';

    if (!partnerId) {
      this.redeemError = 'No se encontró el local.';
      return;
    }

    if (!code) {
      this.redeemError = 'Ingresa el código del regalo.';
      return;
    }

    this.redeemLoading = true;

    try {
      const order = await this.pb.collection('product_orders').getFirstListItem(
        `partnerId="${partnerId}" && redeemCode="${code}" && orderType="gift"`,
        { requestKey: null }
      );

      this.redeemOrder = order;

      if (order['orderStatus'] === 'redeemed') {
        this.redeemError = 'Este regalo ya fue reclamado.';
      } else {
        this.redeemMessage = 'Regalo encontrado. Puedes entregarlo.';
      }

    } catch (error) {
      this.redeemError = 'No encontramos un regalo con ese código para este local.';
    } finally {
      this.redeemLoading = false;
      this.cdr.detectChanges();

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
      this.cdr.detectChanges();

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
  async confirmRedeemGift(): Promise<void> {
    if (!this.redeemOrder?.id) return;

    const result = await Swal.fire({
      icon: 'question',
      title: '¿Entregar regalo?',
      text: `Confirma que vas a entregar: ${this.redeemOrder.productName}`,
      confirmButtonText: 'Sí, entregar',
      cancelButtonText: 'Cancelar',
      showCancelButton: true
    });

    if (!result.isConfirmed) return;

    try {
      await this.pb.collection('product_orders').update(this.redeemOrder.id, {
        orderStatus: 'redeemed',
        status: 'completed',
        redeemedAt: new Date().toISOString()
      }, { requestKey: null });

      await Swal.fire({
        icon: 'success',
        title: 'Regalo entregado',
        text: 'El regalo fue marcado como reclamado correctamente.',
        confirmButtonText: 'Aceptar'
      });

      this.redeemCodeInput = '';
      this.redeemOrder = null;
      this.redeemMessage = '';
      this.redeemError = '';

    } catch (error) {
      console.error('Error validando regalo:', error);
      this.redeemError = 'No se pudo marcar el regalo como reclamado.';
    }
  }
  ngAfterViewInit() {
    ['promoModal', 'promoListModal', 'promoOptionsModal', 'productModal', 'productListModal', 'productOptionsModal'].forEach(id => {
      const modalEl = document.getElementById(id);
      if (modalEl) {
        modalEl.addEventListener('hidden.bs.modal', () => {
          const backdrop = document.querySelector('.modal-backdrop');
          if (backdrop) backdrop.remove();
          document.body.classList.remove('modal-open');
        });
      }
    });


    const servicesOffcanvas = document.getElementById('offcanvasBottom1Local');
    if (servicesOffcanvas) {
      servicesOffcanvas.addEventListener('show.bs.offcanvas', () => {
        this.isServicesOffcanvasOpen = true;
      });

      servicesOffcanvas.addEventListener('hidden.bs.offcanvas', () => {
        this.isServicesOffcanvasOpen = false;
      });
    }

    this.bindPlansSwiper();
  }
  private bindPlansSwiper(): void {
    this.plansSwiperSub?.unsubscribe();

    this.plansSwiperSub = this.global.planningPartners$.subscribe((plans) => {
      if (!plans || !plans.length) return;

      setTimeout(() => {
        this.initPlansSwiper();
      }, 0);
    });
  }

  private initPlansSwiper(): void {
    if (!this.plansSwiperRef?.nativeElement || !this.plansPaginationRef?.nativeElement) {
      return;
    }

    if (this.plansSwiper) {
      this.plansSwiper.destroy(true, true);
    }

    this.plansSwiper = new Swiper(this.plansSwiperRef.nativeElement, {
      modules: [Pagination, Autoplay],
      slidesPerView: 1.08,
      spaceBetween: 12,
      grabCursor: true,
      observer: true,
      observeParents: true,
      watchOverflow: true,
      pagination: {
        el: this.plansPaginationRef.nativeElement,
        clickable: true
      },
      breakpoints: {
        576: {
          slidesPerView: 1.15,
          spaceBetween: 14
        },
        768: {
          slidesPerView: 1.4,
          spaceBetween: 16
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.plansSwiper?.destroy(true, true);
    this.plansSwiperSub?.unsubscribe();
  }
  private showAppToast(
    message: string,
    type: 'success' | 'error' | 'info' = 'info'
  ): void {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;

    setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }

  async ngAfterViewChecked() {
    if (!this.mapInitialized && this.mapContainer) {
      this.mapInitialized = true;

      const [lng, lat] = await this.getCurrentLocation();

      setTimeout(() => {
        this.map = new mapboxgl.Map({
          container: this.mapContainer!.nativeElement,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [lng, lat],
          zoom: 14,
          accessToken: environment.MAPBOX_PUBLIC_TOKEN
        });

        this.map.on('click', (event) => this.onMapClick(event));
      }, 0);
    }
  }

  openPromoOptions() {
    this.modalService.open('promoOptionsModal');
  }

  openProductModal() {
    this.cancelProduct(); // limpia el formulario si vas a crear uno nuevo

    const optionsModalEl = document.getElementById('productOptionsModal');
    const productModalEl = document.getElementById('productModal');

    if (optionsModalEl) {
      const optionsInstance = bootstrap.Modal.getOrCreateInstance(optionsModalEl);
      optionsInstance.hide();
    }

    setTimeout(() => {
      if (productModalEl) {
        const productInstance = bootstrap.Modal.getOrCreateInstance(productModalEl);
        productInstance.show();
      }
    }, 200);
  }

  openProductListModal() {
    const optionsModalEl = document.getElementById('productOptionsModal');
    const productListModalEl = document.getElementById('productListModal');

    if (optionsModalEl) {
      const optionsInstance = bootstrap.Modal.getOrCreateInstance(optionsModalEl);
      optionsInstance.hide();
    }

    setTimeout(() => {
      if (productListModalEl) {
        const productListInstance = bootstrap.Modal.getOrCreateInstance(productListModalEl);
        productListInstance.show();
      }
    }, 200);
  }


  openPromoListModal() {
    this.modalService.close('promoOptionsModal'); // Cierra el modal de opciones
    setTimeout(() => {
      this.modalService.open('promoListModal');
    }, 150);
  }

  private initMapIfReady() {
    if (!this.mapInitialized && this.mapContainer) {
      this.mapInitialized = true;

      this.map = new mapboxgl.Map({
        container: this.mapContainer.nativeElement,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [
          this.global.profileDataPartner.lng || -74.08175,
          this.global.profileDataPartner.lat || 4.60971
        ],
        zoom: 12,
        accessToken: environment.MAPBOX_PUBLIC_TOKEN
      });

      const geocoder = new MapboxGeocoder({
        accessToken: environment.MAPBOX_PUBLIC_TOKEN,
        mapboxgl: mapboxgl,
        marker: false
      });

      this.map.addControl(geocoder);
      geocoder.on('result', e => {
        const [lng, lat] = e.result.center;
        this.placeMarker(lng, lat);
      });
    }
  }

  private placeMarker(lng: number, lat: number) {
    // Coloca o mueve marcador existente
    if (this.marker) {
      this.marker.setLngLat([lng, lat]);
    } else {
      this.marker = new mapboxgl.Marker({ color: '#FF50A2' })
        .setLngLat([lng, lat])
        .addTo(this.map!);
    }

    // Actualiza coordenadas seleccionadas
    this.selectedLng = lng;
    this.selectedLat = lat;
  }

  private getCurrentLocation(): Promise<[number, number]> {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve([position.coords.longitude, position.coords.latitude]);
          },
          () => {
            // Si el usuario no acepta, usa la del perfil o centro por defecto
            resolve([
              Number(this.global.profileDataPartner.lng) || -74.08175,
              Number(this.global.profileDataPartner.lat) || 4.60971
            ]);
          },
          { enableHighAccuracy: true }
        );
      } else {
        resolve([
          Number(this.global.profileDataPartner.lng) || -74.08175,
          Number(this.global.profileDataPartner.lat) || 4.60971
        ]);
      }
    });
  }

  async fetchPartnerData(): Promise<void> {
    try {
      const userId = this.auth.getUserId();
      const partnerRecord = await this.auth.findPartnerByUserId(userId);

      if (partnerRecord) {
        this.global.profileDataPartner = {
          id: partnerRecord.id,
          avatar: partnerRecord['avatar'] || '',
          userId: partnerRecord['userId'] || '',
          venueName: partnerRecord['venueName'] || '',
          name: partnerRecord.name || '',
          email: partnerRecord.email || '',
          phone: partnerRecord.phone || '',
        };
      }
    } catch (error) {
    }
  }

  async loadProfileDataPartner() {
    const user = this.auth.getCurrentUser();
    console.log('Cargando perfil de usuario:', user);

    if (!user?.id) {
      console.error('No hay usuario autenticado');
      return;
    }

    try {
      const userData = await this.pb.collection('usuariosPartner').getFirstListItem(`userId="${user.id}"`);

      this.global.profileDataPartner = {
        id: userData.id,
        avatar: userData['avatar'] || '',
        userId: userData['userId'] || '',
        venueName: userData['venueName'] || '',
        files: userData['files'] || [],
        birthday: userData['birthday'] || '',
        address: userData['address'] || '',
        email: userData['email'] || '',
        description: userData['description'] || '',
        phone: userData['phone'] || '',
        capacity: userData['capacity'] || '',
        openingHours: userData['openingHours'] || '',
        lat: userData['lat'] || '',
        lng: userData['lng'] || '',
        services: userData['services'] || '',
        purchaseLink: userData['purchaseLink'] || '',
        paymentMethods: userData['paymentMethods'] || [],
        accountType: userData['accountType'] || 'corriente',
        accountNumber: userData['accountNumber'] || '',
        reservationEnabled:
          userData['reservationEnabled'] || false,
        reservationLink:
          userData['reservationLink'] || '',
        ticketsEnabled: userData['ticketsEnabled'] || false,
        ticketPrice: userData['ticketPrice'] || 0,
        ticketDescription: userData['ticketDescription'] || '',
        reservationPrice: userData['reservationPrice'] || 0,
        reservationCapacity: userData['reservationCapacity'] || 0,
        ticketCapacity: userData['ticketCapacity'] || 0,
        reservationDate: this.toDateTimeLocal(userData['reservationDate'] || ''),
        ticketDate: this.toDateTimeLocal(userData['ticketDate'] || ''),
        ticketsLink:
          userData['ticketsLink'] || '',
        whatsappReservations:
          userData['whatsappReservations'] || '',
        subscriptionPlanName: userData['subscriptionPlanName'] || '',
        subscriptionPlanId: userData['subscriptionPlanId'] || '',
        subscriptionStatus: userData['subscriptionStatus'] || '',
        subscriptionStartsAt: userData['subscriptionStartsAt'] || '',
        subscriptionExpiresAt: userData['subscriptionExpiresAt'] || '',
        subscriptionAutoRenew: userData['subscriptionAutoRenew'] || false,
        country: userData['country'] || 'CO',
        paymentBank: userData['paymentBank'] || '',
        paymentHolder: userData['paymentHolder'] || '',
        paymentDocument: userData['paymentDocument'] || '',
        paymentPhone: userData['paymentPhone'] || '',
        paymentType: userData['paymentType'] || 'pago_movil',
        paymentEnabled: userData['paymentEnabled'] || false,
      };
      this.global.profileDataPartner.avatar = this.pb.files.getUrl(userData, userData['avatar']);
      if (
        this.global.profileDataPartner.subscriptionStatus === 'active' &&
        this.isPartnerSubscriptionExpired()
      ) {
        await this.pb.collection('usuariosPartner').update(userData.id, {
          subscriptionStatus: 'expired'
        });

        this.global.profileDataPartner.subscriptionStatus = 'expired';
      }
      // Cargar fotos si existen
      if (userData['files']) {

        let photosData: any[] = [];

        if (Array.isArray(userData['files'])) {
          photosData = userData['files'];
        } else {
          try {
            photosData = JSON.parse(userData['files']);
          } catch {
            photosData = [];
          }
        }

        this.photosPartner = photosData.map((url: string) => ({ url }));
      }

      // Inicializar servicios seleccionados
      if (this.global.profileDataPartner.services) {
        this.global.selectedServicesPartner = this.global.profileDataPartner.services.split(',').map((i: string) => i.trim());
      }
      // Al final de loadProfileData()
      this.global.profileDataPartner = this.global.profileDataPartner;

    } catch (error) {
    }
  }
  isPartnerSubscriptionExpired(): boolean {
    const expiresAt = this.global.profileDataPartner.subscriptionExpiresAt;

    if (!expiresAt) return true;

    return new Date(expiresAt).getTime() <= Date.now();
  }

  hasActivePartnerSubscription(): boolean {
    return (
      this.global.profileDataPartner.subscriptionStatus === 'active' &&
      this.global.profileDataPartner.subscriptionExpiresAt &&
      new Date(this.global.profileDataPartner.subscriptionExpiresAt).getTime() > Date.now()
    );
  }

  isPartnerPlanActive(plan: any): boolean {
    return (
      this.global.profileDataPartner.subscriptionStatus === 'active' &&
      this.global.profileDataPartner.subscriptionPlanId === plan.id &&
      new Date(this.global.profileDataPartner.subscriptionExpiresAt).getTime() > Date.now()
    );
  }

  isFreePartnerPlan(plan: any): boolean {
    return Number(plan.priceCOP || 0) <= 0;
  }

  getPartnerActivePlanLabel(): string {
    if (this.global.profileDataPartner.subscriptionStatus === 'pending') {
      return this.global.profileDataPartner.subscriptionPlanName || 'Plan en validación';
    }

    if (!this.hasActivePartnerSubscription()) return 'Sin plan activo';

    return this.global.profileDataPartner.subscriptionPlanName || 'Plan activo';
  }

  getPartnerSubscriptionExpiresLabel(): string {
    const expiresAt = this.global.profileDataPartner.subscriptionExpiresAt;

    if (!expiresAt) return '';

    return new Date(expiresAt).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getPartnerPlanButtonLabel(plan: any): string {
    if (this.isFreePartnerPlan(plan)) return 'Plan gratuito';
    if (this.isPartnerPlanActive(plan)) return 'Plan activo';
    if (this.subscribingPlanId === plan.id) return 'Procesando...';

    return 'Suscribirme';
  }

  isPartnerPlanButtonDisabled(plan: any): boolean {
    return (
      this.isFreePartnerPlan(plan) ||
      this.isPartnerPlanActive(plan) ||
      this.subscribingPlanId === plan.id
    );
  }
  private toDateTimeLocal(value: string): string {
    if (!value) return '';

    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60000);

    return localDate.toISOString().slice(0, 16);
  }
  async saveLocation() {
    try {
      await this.pb.collection('usuariosPartner')
        .update(this.global.profileDataPartner.id, {
          lat: this.lat?.toString(),
          lng: this.lng?.toString()
        });
      alert('Ubicación guardada');
    } catch (e) {
      console.error('Error al guardar ubicación', e);
    }
  }


  onAvatarSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.newAvatar = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = reader.result;
      };
      reader.readAsDataURL(file);
    }
  }
  async uploadAvatarFile(): Promise<any> {
    if (!this.newAvatar) return null;

    const formData = new FormData();
    formData.append('file', this.newAvatar);
    formData.append('userId', this.auth.currentUser?.id || '');
    formData.append('type', 'avatar');

    // PocketBase SDK permite pasar FormData directamente
    const fileRecord = await this.pb.collection('files').create(formData);
    return fileRecord;
  }
  removePhoto(index: number) {
    this.photosPartner[index] = {};
    // Limpiar el input file
    const fileInput = document.getElementById('imageUpload' + index) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
  onPhotoSelected(event: any, index: number) {
    const file = event.target.files[0];
    if (file) {
      // Crear URL temporal para previsualización
      const url = URL.createObjectURL(file);
      this.photosPartner[index] = {
        url: url,
        file: file
      };
    }
  }
  editProfile() {
    this.isEditProfile = true;
    // Sincroniza las fotos guardadas con el array editable
    this.photosPartner = (this.global.profileDataPartner.files || []).map((url: string) => ({
      url,
      file: null
    }));
    // Si quieres un máximo de slots (por ejemplo 6)
    while (this.photosPartner.length < 6) {
      this.photosPartner.push({ url: '', file: null });
    }
  }

  async saveProfile() {
    try {
      const userId = this.auth.currentUser?.id;

      if (!userId) {
        this.showAppToast('No hay usuario autenticado', 'error');
        return;
      }

      if (!this.selectedServices.length && this.global.profileDataPartner.services) {
        this.selectedServices = this.global.profileDataPartner.services
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      const uploadedPhotos: string[] = [];

      for (const photo of this.photosPartner) {
        if (photo?.file) {
          const photoForm = new FormData();
          photoForm.append('file', photo.file);

          const record = await this.pb.collection('files').create(photoForm, {
            requestKey: null
          });

          const fileName = record['file'];
          const url = this.pb.files.getUrl(record, fileName);
          uploadedPhotos.push(url);
        } else if (photo?.url) {
          uploadedPhotos.push(photo.url);
        }
      }

      const formData = new FormData();
      formData.append('venueName', this.global.profileDataPartner.venueName || '');
      formData.append('description', this.global.profileDataPartner.description || '');
      formData.append('email', this.global.profileDataPartner.email || '');
      formData.append('phone', this.global.profileDataPartner.phone || '');
      formData.append('address', this.global.profileDataPartner.address || '');
      formData.append('capacity', String(this.global.profileDataPartner.capacity || 0));
      formData.append('openingHours', this.global.profileDataPartner.openingHours || '');
      formData.append('lat', String(this.global.profileDataPartner.lat || ''));
      formData.append('lng', String(this.global.profileDataPartner.lng || ''));
      formData.append('services', this.selectedServices.join(', '));
      formData.append('files', JSON.stringify(uploadedPhotos));
      formData.append('purchaseLink', this.global.profileDataPartner.purchaseLink || '');
      formData.append('country', this.global.profileDataPartner.country || 'CO');
      formData.append('paymentBank', this.global.profileDataPartner.paymentBank || '');
      formData.append('paymentHolder', this.global.profileDataPartner.paymentHolder || '');
      formData.append('paymentDocument', this.global.profileDataPartner.paymentDocument || '');
      formData.append('paymentPhone', this.global.profileDataPartner.paymentPhone || '');
      formData.append('paymentType', this.global.profileDataPartner.paymentType || 'pago_movil');
      formData.append('paymentEnabled', String(this.global.profileDataPartner.paymentEnabled || false));
      formData.append(
        'paymentMethods',
        JSON.stringify(this.global.profileDataPartner.paymentMethods || [])
      );

      formData.append('accountType', this.global.profileDataPartner.accountType || 'corriente');
      formData.append('accountNumber', this.global.profileDataPartner.accountNumber || '');
      formData.append(
        'reservationEnabled',
        String(this.global.profileDataPartner.reservationEnabled || false)
      );
      formData.append('reservationPrice', String(this.global.profileDataPartner.reservationPrice || 0));
      formData.append(
        'reservationDate',
        this.global.profileDataPartner.reservationDate
          ? new Date(this.global.profileDataPartner.reservationDate).toISOString()
          : ''
      );

      formData.append(
        'ticketDate',
        this.global.profileDataPartner.ticketDate
          ? new Date(this.global.profileDataPartner.ticketDate).toISOString()
          : ''
      ); formData.append('reservationCapacity', String(this.global.profileDataPartner.reservationCapacity || 0));

      formData.append('ticketCapacity', String(this.global.profileDataPartner.ticketCapacity || 0));
      formData.append(
        'reservationLink',
        this.global.profileDataPartner.reservationLink || ''
      );

      formData.append('ticketsEnabled', String(this.global.profileDataPartner.ticketsEnabled || false));
      formData.append('ticketPrice', String(this.global.profileDataPartner.ticketPrice || 0));
      formData.append('ticketDescription', this.global.profileDataPartner.ticketDescription || '');

      formData.append(
        'ticketsLink',
        this.global.profileDataPartner.ticketsLink || ''
      );

      formData.append(
        'whatsappReservations',
        this.global.profileDataPartner.whatsappReservations || ''
      );
      if (this.newAvatar) {
        formData.append('avatar', this.newAvatar);
      }

      const existingProfile = await this.pb
        .collection('usuariosPartner')
        .getFirstListItem(`userId="${userId}"`, {
          requestKey: null
        })
        .catch(() => null);

      let savedRecord: any;

      if (existingProfile) {
        savedRecord = await this.pb.collection('usuariosPartner').update(
          existingProfile.id,
          formData,
          { requestKey: null }
        );
      } else {
        formData.append('userId', userId);
        savedRecord = await this.pb.collection('usuariosPartner').create(
          formData,
          { requestKey: null }
        );
      }

      // Normalizar avatar
      const avatarUrl = savedRecord?.avatar
        ? this.pb.files.getUrl(savedRecord, savedRecord.avatar)
        : this.global.profileDataPartner.avatar || '';

      // Normalizar files
      let normalizedFiles: string[] = [];
      if (Array.isArray(savedRecord?.files)) {
        normalizedFiles = savedRecord.files;
      } else if (typeof savedRecord?.files === 'string' && savedRecord.files.trim()) {
        try {
          normalizedFiles = JSON.parse(savedRecord.files);
        } catch {
          normalizedFiles = uploadedPhotos;
        }
      } else {
        normalizedFiles = uploadedPhotos;
      }

      this.global.profileDataPartner = {
        ...this.global.profileDataPartner,
        id: savedRecord.id,
        userId: savedRecord.userId,
        venueName: savedRecord.venueName || '',
        description: savedRecord.description || '',
        email: savedRecord.email || '',
        phone: savedRecord.phone || '',
        address: savedRecord.address || '',
        capacity: savedRecord.capacity || '',
        openingHours: savedRecord.openingHours || '',
        lat: savedRecord.lat || '',
        lng: savedRecord.lng || '',
        services: savedRecord.services || '',
        purchaseLink: savedRecord.purchaseLink || '',
        files: normalizedFiles,
        avatar: avatarUrl,
        ticketsEnabled: savedRecord.ticketsEnabled || false,
        ticketPrice: savedRecord.ticketPrice || 0,
        ticketDescription: savedRecord.ticketDescription || '',
        ticketDate: savedRecord.ticketDate || '',
        ticketCapacity: savedRecord.ticketCapacity || 0,
        reservationEnabled: savedRecord.reservationEnabled || false,
        reservationLink: savedRecord.reservationLink || '',
        reservationPrice: savedRecord.reservationPrice || 0,
        reservationDate: savedRecord.reservationDate || '',
        reservationCapacity: savedRecord.reservationCapacity || 0,
        whatsappReservations: savedRecord.whatsappReservations || '',
        country: savedRecord.country || 'CO',
        paymentMethods: savedRecord.paymentMethods || [],
        paymentBank: savedRecord.paymentBank || '',
        paymentHolder: savedRecord.paymentHolder || '',
        paymentDocument: savedRecord.paymentDocument || '',
        paymentPhone: savedRecord.paymentPhone || '',
        paymentType: savedRecord.paymentType || 'pago_movil',
        accountType: savedRecord.accountType || 'corriente',
        accountNumber: savedRecord.accountNumber || '',
        paymentEnabled: savedRecord.paymentEnabled || false,
      };

      this.avatarPreview = null;
      this.newAvatar = null;
      this.isEditProfile = false;

      /* setTimeout(() => {
        this.showAppToast('Perfil actualizado correctamente', 'success');
      }, 120); */
      Swal.fire({
        icon: 'success',
        title: 'Perfil actualizado',
        text: 'Los cambios se guardaron correctamente',
        timer: 1800,
        showConfirmButton: false,
        background: '#101935',
        color: '#fff'
      });

      console.log('Perfil actualizado correctamente');
    } catch (error: any) {
      console.error('Error guardando perfil:', error);

      if (error?.response) {
        console.error('Detalle PocketBase:', error.response);
      }

      this.showAppToast('No se pudo guardar el perfil', 'error');
    }
  }

  cancelEdit() {
    // Volver a cargar los datos originales
    this.loadProfileDataPartner();
    this.isEditProfile = false;
  }
  activarEdicion() {
    this.isEditProfile = true;
    this.mapInitialized = false; // así se puede volver a inicializar al salir de edición
    console.log('isEditProfile:', this.isEditProfile);
  }
  selectServices(lang: any) {
    this.global.profileDataPartner.services = lang.name;
    // Cerrar el offcanvas después de seleccionar
    const offcanvas = document.getElementById('offcanvasLang');
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvas as Element);
  }
  toggleService(service: { value: string; label: string }) {
    if (this.selectedServices.includes(service.value)) {
      this.selectedServices = this.selectedServices.filter(s => s !== service.value);
    } else {
      this.selectedServices.push(service.value);
    }
  }

  addService(newService: string) {
    const value = newService.trim();
    if (!value) return;
    if (this.global.allServices.some(s => s.value.toLowerCase() === value.toLowerCase())) return;
    const newObj = { value, label: value };
    this.global.allServices.push(newObj);
    this.filteredServices = [...this.global.allServices];
    this.toggleService(newObj);
    this.serviceSearch = '';
  }

  filterServices() {
    if (!this.serviceSearch) {
      this.filteredServices = [...this.global.allServices];
      return;
    }
    this.filteredServices = this.global.allServices.filter(service =>
      service.value.toLowerCase().includes(this.serviceSearch.toLowerCase())
    );
  }

  showAddServiceOption(): boolean {
    if (!this.serviceSearch) return false;
    return !this.filteredServices.some(s => s.value && typeof s.value === 'string' && s.value.toLowerCase() === this.serviceSearch.toLowerCase());
  }

  saveServices() {
    // Guarda los servicios seleccionados en el perfil global
    this.global.profileDataPartner.services = this.selectedServices.join(', ');
    this.isEditProfile = true;
  }

  async savePromotion() {
  try {
    const price = Number(this.newPromo.price || 0);

    if (Number.isNaN(price) || price < 0) {
      this.showAppToast('Ingresa un precio válido para la promoción', 'error');
      return;
    }

    let imageUrl = '';

    if (this.promoImageFile) {
      const fileForm = new FormData();
      fileForm.append('file', this.promoImageFile);
      fileForm.append('userId', this.auth.currentUser?.id || '');
      fileForm.append('type', 'promo');

      const fileRecord = await this.pb.collection('files').create(fileForm, {
        requestKey: null
      });

      imageUrl = this.pb.files.getUrl(fileRecord, fileRecord['file']);
    }

    if (this.isEditingPromo && this.editingPromoId) {
      const promoForm: any = {
        name: this.newPromo.name || '',
        description: `${this.newPromo.description || ''}\nFecha: ${this.newPromo.date || ''}`,
        userId: this.auth.currentUser?.id || '',
        price,
        currency: this.newPromo.currency || 'COP',
        country: this.newPromo.country || 'CO',
      };

      if (imageUrl) {
        promoForm.files = [imageUrl];
      }

      await this.pb.collection('promos').update(this.editingPromoId, promoForm, {
        requestKey: null
      });

    } else {
      const promoForm = new FormData();

      promoForm.append('name', this.newPromo.name || '');
      promoForm.append('description', `${this.newPromo.description || ''}\nFecha: ${this.newPromo.date || ''}`);
      promoForm.append('userId', this.auth.currentUser?.id || '');
      promoForm.append('price', String(price));
      promoForm.append('currency', this.newPromo.currency || 'COP');
      promoForm.append('country', this.newPromo.country || 'CO');

      if (imageUrl) {
        promoForm.append('files', JSON.stringify([imageUrl]));
      }

      const result = await this.pb.collection('promos').create(promoForm, {
        requestKey: null
      });

      console.log('Promo guardada con imagen:', result);
    }

    await this.loadPromotionsForPartner();

    this.resetPromoForm();
    this.closePromoModal();

    this.showSuccessToast = false;

    setTimeout(() => {
      this.successPromoToast = true;
      setTimeout(() => this.successPromoToast = false, 3000);
    }, 100);

  } catch (error) {
    console.error('Error guardando la promoción:', error);
  }
}

resetPromoForm(): void {
  this.newPromo = {
    name: '',
    description: '',
    date: '',
    files: [],
    userId: '',
    price: null,
    currency: 'COP',
    country: 'CO',
  };

  this.promoImageFile = null;
  this.isEditingPromo = false;
  this.editingPromoId = null;
}

closePromoModal(): void {
  this.modalService.close('promoOptionsModal');

  const modalEl = document.getElementById('promoModal');

  if (modalEl) {
    const modalInstance =
      (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl) ||
      (window as any).bootstrap?.Modal?.getInstance(modalEl);

    if (modalInstance) {
      modalInstance.hide();
    }
  }

  const backdrop = document.querySelector('.modal-backdrop');

  if (backdrop) {
    backdrop.remove();
  }

  document.body.classList.remove('modal-open');
}

  onPromoImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.promoImageFile = file;
    }
  }
  async loadPromotionsForPartner() {
    try {
      const userId = this.auth.currentUser?.id;
      if (!userId) return;

      const records = await this.pb.collection('promos').getFullList({
        filter: `userId="${userId}"`,
        sort: '-created'
      });

      this.global.promosByPartner = records.map((promo: any) => ({
        id: promo.id,
        name: promo.name,
        description: promo.description,
        files: promo.files,
        userId: promo.userId,
        price: Number(promo.price || 0),
currency: promo.currency || 'COP',
country: promo.country || 'CO',

      }));
    } catch (error) {
      console.error('Error cargando promociones:', error);
    }
  }
  cancelPromo() {
  this.resetPromoForm();
  this.closePromoModal();
}
  async deletePromo(promo: any) {
    try {
      await this.pb.collection('promos').delete(promo.id);
      this.loadPromotionsForPartner();
      this.successPromoToast = false;
      setTimeout(() => {
        this.successPromoToast = true;
        setTimeout(() => this.successPromoToast = false, 3000);
      }, 100);

      // Cerrar el modal de la lista de promociones si está abierto
      const promoListModalEl = document.getElementById('promoListModal');
      if (promoListModalEl) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(promoListModalEl) || (window as any).bootstrap?.Modal?.getInstance(promoListModalEl);
        if (modalInstance) {
          modalInstance.hide();
        }
      }
      // Eliminar backdrop manualmente si quedó
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.remove();
      }
      document.body.classList.remove('modal-open');
    } catch (error) {
      console.error('Error eliminando promoción:', error);
    }
  }

editPromo(promo: any) {
  this.newPromo = {
    name: promo.name || '',
    description: promo.description?.split('\nFecha:')[0] || '',
    date: promo.description?.split('\nFecha:')[1]?.trim() || '',
    files: promo.files || [],
    userId: promo.userId || '',
    price: Number(promo.price || 0),
    currency: promo.currency || 'COP',
    country: promo.country || 'CO',
  };

  this.editingPromoId = promo.id;
  this.isEditingPromo = true;
  this.promoImageFile = null;

  setTimeout(() => {
    const modalEl = document.getElementById('promoModal');

    if (modalEl) {
      const modalInstance =
        (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl) ||
        (window as any).bootstrap?.Modal?.getInstance(modalEl);

      if (modalInstance) {
        modalInstance.show();
      }
    }
  }, 100);
}

  openPromoModal() {
    this.modalService.close('promoOptionsModal'); // Cierra el modal de opciones

    // Limpieza antes de abrir
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
    document.body.classList.remove('modal-open');

    const modalEl = document.getElementById('promoModal');
    if (modalEl) {
      const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl) || (window as any).bootstrap?.Modal?.getInstance(modalEl);
      if (modalInstance) {
        modalInstance.show();
      }
    }
    setTimeout(() => {
      this.modalService.open('promoModal');
    }, 150);

  }

  async guardarPerfil() {
    if (!this.coordenadasSeleccionadas) return;

    const { lat, lng } = this.coordenadasSeleccionadas;
    await this.pb.collection('usuariosPartner').update(this.global.profileDataPartner.id, {
      lat: lat.toString(),
      lng: lng.toString()
    });

    alert('Ubicación actualizada correctamente');
  }


  onMapClick(event: mapboxgl.MapMouseEvent): void {
    const { lng, lat } = event.lngLat;

    this.selectedLat = lat;
    this.selectedLng = lng;

    // Actualiza marcador
    if (this.marker) {
      this.marker.setLngLat([lng, lat]);
    } else {
      this.marker = new mapboxgl.Marker({ color: '#FF50A2' })
        .setLngLat([lng, lat])
        .addTo(this.map!);
    }

    // Feedback opcional
    console.log(`Nueva ubicación: ${lat}, ${lng}`);
  }

  async guardarUbicacion(): Promise<void> {
    if (this.selectedLat !== null && this.selectedLng !== null) {
      try {
        const userId = this.auth.currentUser?.id || this.global.profileDataPartner.userId;
        const partner = await this.pb.collection('usuariosPartner').getFirstListItem(`userId="${userId}"`);
        const partnerId = partner.id;

        const result = await this.pb.collection('usuariosPartner').update(partnerId, {
          lat: this.selectedLat.toString(),
          lng: this.selectedLng.toString(),
        });

        this.global.profileDataPartner.lat = result['lat'];
        this.global.profileDataPartner.lng = result['lng'];

        this.showAppToast('Ubicación guardada correctamente', 'success');
      } catch (error) {
        console.error(error);
        this.showAppToast('No se pudo guardar la ubicación', 'error');
      }
    } else {
      this.showAppToast('Haz clic en el mapa para seleccionar una ubicación', 'info');
    }
  }
  openProductOptions() {
    const modalEl = document.getElementById('productOptionsModal');
    if (modalEl) {
      const modalInstance = new bootstrap.Modal(modalEl);
      modalInstance.show();
    } else {
      console.warn('No se encontró el modal de productos en el DOM');
    }
  }

  onProductImageSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.productImageFile = file;
    }
  }

  async loadPartnerProducts() {
    try {
      const userId = this.auth.currentUser?.id;
      if (!userId) return;

      const records = await this.pb.collection('partnerProducts').getFullList({
        filter: `userId="${userId}"`,
        sort: '-created'
      });

      this.partnerProducts = records.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        price: item.price,
        currency: item.currency || this.getDefaultCurrencyByCountry(this.global.profileDataPartner.country || 'CO'),
        country: item.country || this.global.profileDataPartner.country || 'CO',
        isAvailable: item.isAvailable,
        userId: item.userId,
        partnerId: item.partnerId,
        image: item.image ? this.pb.files.getUrl(item, item.image) : ''
      }));
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  }

  async saveProduct() {
    try {
      const userId = this.auth.currentUser?.id;
      if (!userId) {
        this.showAppToast('No hay usuario autenticado', 'error');
        return;
      }

      const partner = await this.pb.collection('usuariosPartner').getFirstListItem(`userId="${userId}"`);

      const formData = new FormData();
      const price = Number(this.newProduct.price);

if (Number.isNaN(price) || price <= 0) {
  this.showAppToast('Ingresa un precio válido', 'error');
  return;
}
      formData.append('name', this.newProduct.name || '');
      formData.append('description', this.newProduct.description || '');
      formData.append('category', this.newProduct.category || '');
formData.append('price', String(price));
      formData.append('isAvailable', String(this.newProduct.isAvailable));
      formData.append('userId', userId);
      formData.append('partnerId', partner.id);
      formData.append('currency', this.newProduct.currency || 'COP');
      formData.append('country', this.newProduct.country || this.global.profileDataPartner.country || 'CO');
      if (this.productImageFile) {
        formData.append('image', this.productImageFile);
      }

      if (this.isEditingProduct && this.editingProductId) {
        await this.pb.collection('partnerProducts').update(this.editingProductId, formData);
      } else {
        await this.pb.collection('partnerProducts').create(formData);
      }

      this.cancelProduct();
      await this.loadPartnerProducts();

      const modalEl = document.getElementById('productModal');
      if (modalEl) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInstance.hide();
      }

      this.showAppToast(
        this.isEditingProduct ? 'Producto actualizado correctamente' : 'Producto agregado correctamente',
        'success'
      );
    } catch (error) {
      console.error('Error guardando producto:', error);
      this.showAppToast('No se pudo guardar el producto', 'error');
    }
  }

  editProduct(product: any) {
    this.newProduct = {
      name: product.name || '',
      description: product.description || '',
      category: product.category || '',
      price: product.price || null,
      currency: product.currency || this.getDefaultCurrencyByCountry(product.country || this.global.profileDataPartner.country || 'CO'),
      country: product.country || this.global.profileDataPartner.country || 'CO',
      isAvailable: product.isAvailable ?? true,
      userId: product.userId || '',
      partnerId: product.partnerId || ''
    };

    this.editingProductId = product.id;
    this.isEditingProduct = true;
    this.productImageFile = null;

    const listModalEl = document.getElementById('productListModal');
    const productModalEl = document.getElementById('productModal');

    if (listModalEl) {
      const listInstance = bootstrap.Modal.getOrCreateInstance(listModalEl);
      listInstance.hide();
    }

    setTimeout(() => {
      if (productModalEl) {
        const productInstance = bootstrap.Modal.getOrCreateInstance(productModalEl);
        productInstance.show();
      }
    }, 200);
  }

  async deleteProduct(product: any) {
    try {
      await this.pb.collection('partnerProducts').delete(product.id);
      await this.loadPartnerProducts();
      this.showAppToast('Producto eliminado correctamente', 'success');
    } catch (error) {
      console.error('Error eliminando producto:', error);
      this.showAppToast('No se pudo eliminar el producto', 'error');
    }
  }

  cancelProduct() {
  const partnerCountry = this.global.profileDataPartner.country || 'CO';

  this.newProduct = {
    name: '',
    description: '',
    category: '',
    price: null,
    currency: this.getDefaultCurrencyByCountry(partnerCountry),
    country: partnerCountry,
    isAvailable: true,
    userId: '',
    partnerId: ''
  };

  this.productImageFile = null;
  this.isEditingProduct = false;
  this.editingProductId = null;
}

  async subscribeToPlan(plan: any): Promise<void> {
    if (this.subscribingPlanId) return;
    if (this.isFreePartnerPlan(plan)) {
      Swal.fire({
        icon: 'info',
        title: 'Plan gratuito',
        text: 'Este plan ya está incluido al registrarte.'
      });
      return;
    }
    if (this.selectedPaymentCountry === 'VE') {
      this.selectedPlan = plan;
      this.openManualPaymentModal(plan);
      return;
    }
    try {
      this.subscribingPlanId = plan.id;

      await this.auth.restoreSession();

      const user = this.auth.getCurrentUser();

      if (!user?.id) {
        Swal.fire({
          icon: 'warning',
          title: 'Inicia sesión',
          text: 'Debes iniciar sesión para comprar una suscripción.'
        });
        return;
      }

      const partnerRecord = await this.pb
        .collection('usuariosPartner')
        .getFirstListItem(`userId="${user.id}"`, { requestKey: null });

      const amountCOP = Number(plan.priceCOP || 0);

      if (!amountCOP || amountCOP <= 0) {
        Swal.fire({
          icon: 'warning',
          title: 'Plan no válido',
          text: 'Este plan no tiene un precio válido.'
        });
        return;
      }

      const intent = await firstValueFrom(
        this.http.post<any>('https://db.ongomatch.com:5055/partner/subscription-intent', {
          userId: user.id,
          partnerId: partnerRecord.id,
          planId: plan.id,
          planName: plan.name,
          price: amountCOP,
          customerEmail: user.email || partnerRecord['email'] || ''
        })
      );

      const result = await this.wompi.openCheckout({
        amountInCents: intent.amountInCents,
        reference: intent.reference,
        currency: 'COP',
        customerEmail: user.email || partnerRecord['email'] || '',
        signature: intent.signature,
        publicKey: intent.publicKey,
        redirectUrl: intent.redirectUrl
      });

      const transaction = result?.transaction;

      await firstValueFrom(
        this.http.post<any>('https://db.ongomatch.com:5055/partner/confirm-subscription', {
          reference: intent.reference,
          status: transaction?.status || 'UNKNOWN',
          transactionId: transaction?.id || '',
          paymentData: result
        })
      );

      if (transaction?.status === 'APPROVED') {
        await this.loadProfileDataPartner();

        Swal.fire({
          icon: 'success',
          title: 'Suscripción activa',
          text: `Tu plan ${plan.name} fue activado correctamente.`,
          timer: 1800,
          showConfirmButton: false,
          background: '#101935',
          color: '#fff'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Pago no aprobado',
          text: 'La suscripción no fue activada porque el pago no fue aprobado.'
        });
      }

    } catch (error: any) {
      console.error('Error creando suscripción partner:', error);

      Swal.fire({
        icon: 'error',
        title: 'No se pudo procesar',
        text: error?.error?.error || error?.message || 'Ocurrió un error al procesar la suscripción.'
      });

    } finally {
      this.subscribingPlanId = null;
    }
  }
  getDefaultCurrencyByCountry(country: string): 'COP' | 'VES' {
    return country === 'VE' ? 'VES' : 'COP';
  }

  onProductCountryChange(): void {
    this.newProduct.currency = this.getDefaultCurrencyByCountry(this.newProduct.country);
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
  openManualPaymentModal(plan: any): void {
    this.selectedPlan = plan;

    const modalEl = document.getElementById('manualPaymentModal');
    if (modalEl) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  }

  onPaymentProofSelected(event: any): void {
    const file = event.target.files?.[0];
    this.paymentProofFile = file || null;
  }
  usarMiUbicacionActual(): void {
    if (!navigator.geolocation) {
      this.showAppToast('Tu navegador no soporta geolocalización.', 'error');
      return;
    }

    this.showAppToast('Obteniendo tu ubicación actual...', 'info');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        this.selectedLat = lat;
        this.selectedLng = lng;

        this.global.profileDataPartner.lat = lat;
        this.global.profileDataPartner.lng = lng;

        if (this.map) {
          this.map.flyTo({
            center: [lng, lat],
            zoom: 17,
            speed: 0.8,
            essential: true
          });

          this.placeMarker(lng, lat);
        }

        await this.guardarUbicacion();

        this.showAppToast('Ubicación actual guardada correctamente.', 'success');
      },
      (error) => {
        console.error('Error obteniendo ubicación:', error);
        this.showAppToast('No se pudo obtener tu ubicación actual.', 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }
  newPaymentMethod = {
    type: 'pago_movil',
    bank: '',
    holder: '',
    document: '',
    phone: '',
    accountType: 'corriente',
    accountNumber: ''
  };

  venezuelanBanks = [
    '0102 Banco de Venezuela',
    '0104 Venezolano de Crédito',
    '0105 Mercantil',
    '0108 Provincial',
    '0134 Banesco',
    '0172 Bancamiga',
    '0175 Bicentenario',
    '0191 BNC'
  ];

  addPaymentMethod() {
    if (!this.global.profileDataPartner.paymentMethods) {
      this.global.profileDataPartner.paymentMethods = [];
    }

    this.global.profileDataPartner.paymentMethods.push({
      ...this.newPaymentMethod
    });

    this.newPaymentMethod = {
      type: 'pago_movil',
      bank: '',
      holder: '',
      document: '',
      phone: '',
      accountType: 'corriente',
      accountNumber: ''
    };
  }

  removePaymentMethod(index: number) {
    this.global.profileDataPartner.paymentMethods.splice(index, 1);
  }
}
