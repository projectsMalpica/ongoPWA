import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
newProduct = {
  name: '',
  description: '',
  category: '',
  price: null as number | null,
  isAvailable: true,
  userId: '',
  partnerId: ''
};

productImageFile: File | null = null;
isEditingProduct: boolean = false;
editingProductId: string | null = null;
  openSubscriptionsModal() {
    const modalEl = document.getElementById('subscriptionsModal');
    if (modalEl) {
      const modalInstance = new bootstrap.Modal(modalEl);
      modalInstance.show();
    } else {
      console.warn('No se encontró el modal de subscripciones en el DOM');
    }
  }

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
    files: [],
    userId: '',
  };
  showPromos = false;
  isServicesOffcanvasOpen = false;

  filteredServices: { value: string; label: string }[] = [...this.servicesPartner];
  promoImageFile: File | null = null;
  successPromoToast = false
  private pb = new PocketBase('https://db.ongomatch.com:8090');
  promosByPartner: any[] = [];
  seleccionMarker!: mapboxgl.Marker;
  selectedMarker!: mapboxgl.Marker;

  constructor(
    public global: GlobalService,
    public auth: AuthPocketbaseService,
    public modalService: ModalService,
    public http: HttpClient,
    public wompi: WompiService
  ) {
    this.loadPromotionsForPartner();
    this.pb.autoCancellation(false);
  }

  async ngOnInit() {
    this.fetchPartnerData();

    await this.loadProfileDataPartner();
    await this.loadPartnerProducts();
    this.global.initPlanningPartnersRealtime();
    this.initMapIfReady();
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
      };
      this.global.profileDataPartner.avatar = this.pb.files.getUrl(userData, userData['avatar']);

      // Cargar fotos si existen
      if (userData['files']) {
        const photosData = JSON.parse(userData['files']);
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
        avatar: avatarUrl
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
      // Si estamos editando, actualiza la promo existente
      if (this.isEditingPromo && this.editingPromoId) {
        let imageUrl = '';
        if (this.promoImageFile) {
          const fileForm = new FormData();
          fileForm.append('file', this.promoImageFile);
          fileForm.append('userId', this.auth.currentUser?.id || '');
          fileForm.append('type', 'promo');
          const fileRecord = await this.pb.collection('files').create(fileForm);
          imageUrl = this.pb.files.getUrl(fileRecord, fileRecord['file']);
        }
        const promoForm: any = {
          name: this.newPromo.name,
          description: `${this.newPromo.description}\nFecha: ${this.newPromo.date}`,
          userId: this.auth.currentUser?.id || '',
        };
        if (imageUrl) {
          promoForm.files = [imageUrl];
        }
        await this.pb.collection('promos').update(this.editingPromoId, promoForm);
        this.loadPromotionsForPartner();
        this.isEditingPromo = false;
        this.editingPromoId = null;
        this.newPromo = { name: '', description: '', date: '', files: [], userId: '' };
        this.promoImageFile = null;
        // Cierra modal y muestra toast igual que antes
        const modalEl = document.getElementById('promoModal');
        if (modalEl) {
          const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl) || (window as any).bootstrap?.Modal?.getInstance(modalEl);
          if (modalInstance) {
            modalInstance.hide();
          }
        }
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
          backdrop.remove();
        }
        document.body.classList.remove('modal-open');
        this.showSuccessToast = false;
        setTimeout(() => {
          this.successPromoToast = true;
          setTimeout(() => this.successPromoToast = false, 3000);
        }, 100);
        return;
      }
      // Si no, crear promo nueva como antes

      let imageUrl = '';
      // 1. Subir primero la imagen si existe
      if (this.promoImageFile) {
        const fileForm = new FormData();
        fileForm.append('file', this.promoImageFile);
        fileForm.append('userId', this.auth.currentUser?.id || '');
        fileForm.append('type', 'promo');
        // Subir archivo a la colección de archivos
        const fileRecord = await this.pb.collection('files').create(fileForm);
        // Obtener la URL del archivo subido
        imageUrl = this.pb.files.getUrl(fileRecord, fileRecord['file']);
      }

      // 2. Guardar la promoción con el enlace de la imagen
      const promoForm = new FormData();
      promoForm.append('name', this.newPromo.name);
      promoForm.append('description', `${this.newPromo.description}\nFecha: ${this.newPromo.date}`);
      promoForm.append('userId', this.auth.currentUser?.id || '');
      if (imageUrl) {
        // Guardar el enlace como array de string (JSON)
        promoForm.append('files', JSON.stringify([imageUrl]));
      }

      const result = await this.pb.collection('promos').create(promoForm);
      console.log('Promo guardada con imagen:', result);

      // Reset
      this.newPromo = { name: '', description: '', date: '', files: [], userId: '' };
      this.promoImageFile = null;

      // Cerrar modal y limpiar backdrop
      this.modalService.close('promoOptionsModal'); // Cierra el modal de opciones
      const modalEl = document.getElementById('promoModal');
      if (modalEl) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl) || (window as any).bootstrap?.Modal?.getInstance(modalEl);
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

      // Mostrar mensaje distinto
      this.showSuccessToast = false;
      this.loadPromotionsForPartner();
      setTimeout(() => {
        this.successPromoToast = true;
        setTimeout(() => this.successPromoToast = false, 3000);
      }, 100);
    } catch (error) {
      console.error('Error guardando la promoción:', error);
    }
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
        userId: promo.userId

      }));
    } catch (error) {
      console.error('Error cargando promociones:', error);
    }
  }
  cancelPromo() {
    this.newPromo = {
      name: '',
      description: '',
      date: '',
      files: [],
      userId: '',
    };
    this.promoImageFile = null;
    this.isEditingPromo = false;
    this.editingPromoId = null;

    // Cerrar el modal si está abierto y limpiar el backdrop
    const modalEl = document.getElementById('promoModal');
    if (modalEl) {
      const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl) || (window as any).bootstrap?.Modal?.getInstance(modalEl);
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
    // Llena el formulario con la info existente
    this.newPromo = {
      name: promo.name,
      description: promo.description.split('\nFecha:')[0] || '',
      date: promo.description.split('\nFecha:')[1]?.trim() || '',
      files: promo.files || [],
      userId: promo.userId || '',
    };
    this.editingPromoId = promo.id;
    this.isEditingPromo = true;
    this.promoImageFile = null;
    // Abre el modal
    setTimeout(() => {
      const modalEl = document.getElementById('promoModal');
      if (modalEl) {
        const modalInstance = (window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl) || (window as any).bootstrap?.Modal?.getInstance(modalEl);
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
    formData.append('name', this.newProduct.name || '');
    formData.append('description', this.newProduct.description || '');
    formData.append('category', this.newProduct.category || '');
    formData.append('price', String(this.newProduct.price || 0));
    formData.append('isAvailable', String(this.newProduct.isAvailable));
    formData.append('userId', userId);
    formData.append('partnerId', partner.id);

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
  this.newProduct = {
    name: '',
    description: '',
    category: '',
    price: null,
    isAvailable: true,
    userId: '',
    partnerId: ''
  };

  this.productImageFile = null;
  this.isEditingProduct = false;
  this.editingProductId = null;
}
  /* <-- async subscribeToPlan(plan: any) {
    const amount = Number(plan.priceCOP || 0) * 100;
    const userEmail = this.global.profileDataPartner.email || this.auth.currentUser?.email;
  
    const body = {
      amountInCents: amount,
      currency: 'COP',
      customerEmail: userEmail,
      reference: `partner_${Date.now()}`,
      paymentMethod: { type: 'CARD' } // puedes omitir si quieres mostrar opciones
    };
  
    try {
      const res: any = await firstValueFrom(this.http.post('http://localhost:3000/api/pago', body));
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        console.warn('No se recibió checkout_url:', res);
      }
    } catch (err) {
      console.error('Error creando sesión de pago:', err);
    }
  }--> */

  /* async subscribeToPlan(plan: any) {
    const amountInCents = Number(plan.priceCOP || 0) * 100;
    const userEmail = this.global.profileDataPartner?.email || this.auth.currentUser?.email;
  
    const body = {
      amountInCents: Number(plan.priceCOP || 0) * 100,
      currency: 'COP',
      customerEmail: userEmail,
      reference: `partner_${Date.now()}`
    };
    
  
    try {
      const res: any = await firstValueFrom(this.http.post('http://localhost:3000/api/pago', body));
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        console.warn('No se recibió checkout_url:', res);
      }
    } catch (err) {
      console.error('Error creando sesión de pago:', err);
    }
  } */

  private toAmountInCents(priceCOP: string | number): number {
    if (typeof priceCOP === 'number') return Math.round(priceCOP * 100);
    // elimina todo lo que no sea dígito (soporta puntos y comas de miles)
    const onlyDigits = priceCOP.replace(/\D/g, '');
    return Number(onlyDigits) * 100;
  }

  async subscribeToPlan(planning: any) {
    // planning.priceCOP podría venir como "49.500", "49500" o número
    const amountInCents = this.toAmountInCents(planning?.priceCOP ?? 0);
    if (!amountInCents || amountInCents <= 0) {
      console.warn('Precio inválido para el plan:', planning);
      return;
    }

    const reference = `partner_${planning?.id || 'plan'}_${Date.now()}`;
    const redirectUrl = window.location.origin + '/pago-completado';
    const customerEmail = (planning?.email) || ''; // opcional: carga tu email real del perfil

    try {
      const result = await this.wompi.openCheckout({
        amountInCents,
        reference,
        redirectUrl,
        customerEmail,
        // publicKey: environment.WOMPI_PUBLIC_KEY // opcional, ya lo usa el servicio
      });

      // result.transaction: { id, status, reference, ... }
      console.log('Wompi result:', result);
      const tx = result?.transaction;
      if (tx?.id) {
        // Aquí puedes: (1) mostrar feedback, (2) notificar a tu backend para validar por ID
        // Ejemplo: this.paymentsService.verify(tx.id).subscribe(...)
      }
    } catch (e) {
      console.error('No se pudo abrir el widget Wompi:', e);
    }
  }

}
