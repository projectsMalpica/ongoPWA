import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import PocketBase from 'pocketbase';
import * as bootstrap from 'bootstrap';
import * as mapboxgl from 'mapbox-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs'; // para convertir Observable en Promise
import { environment } from '../../environments/environment';
import { GlobalService } from '../../services/global.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { ModalService } from '../../services/modal.service';
import { WompiService } from '../../services/wompi.service';

@Component({
  selector: 'app-profile-local',
  standalone: true,
imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profile-local.html',
  styleUrl: './profile-local.scss',
})
export class ProfileLocal implements OnInit, AfterViewInit {

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
files:[], 
userId: '',
};
showPromos = false;

filteredServices: { value: string; label: string }[] = [...this.servicesPartner];
promoImageFile: File | null = null;
successPromoToast = false
private pb = new PocketBase('https://db.ongomatch.com:8090');
promosByPartner: any[] = [];
seleccionMarker!: mapboxgl.Marker;
selectedMarker!:mapboxgl.Marker;

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
  this.global.initPlanningPartnersRealtime();
  this.initMapIfReady();
  
}

ngAfterViewInit() {
  // Limpia backdrop y clase modal-open al cerrar cualquier modal relevante
  ['promoModal', 'promoListModal', 'promoOptionsModal'].forEach(id => {
    const modalEl = document.getElementById(id);
    if (modalEl) {
      modalEl.addEventListener('hidden.bs.modal', () => {
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();
        document.body.classList.remove('modal-open');
      });
    }
  });
  
  
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

/* async saveProfile() {
try {
  // Subir fotos nuevas
  const uploadedPhotosPartner = [];
  for (const photo of this.photosPartner) {
    if (photo.file) {
      const formData = new FormData();
      formData.append('file', photo.file);

      // Subir la imagen a PocketBase
      const record = await this.pb.collection('files').create(formData);
      // Obtener URL de la imagen subida
      const url = this.pb.files.getUrl(record, record['file']);
      uploadedPhotosPartner.push(url);
    } else if (photo.url) {
      // Mantener las URLs existentes
      uploadedPhotosPartner.push(photo.url);
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
formData.append('lat', String(this.global.profileDataPartner.lat || 0));
formData.append('lng', String(this.global.profileDataPartner.lng || 0));
formData.append('services', this.selectedServices.join(', '));
formData.append('files', JSON.stringify(uploadedPhotosPartner));
formData.append('purchaseLink', this.global.profileDataPartner.purchaseLink || '');

// Fotos
const uploadedPhotos = [];
for (const photo of this.photosPartner) {
if (photo.file) {
const photoForm = new FormData();
photoForm.append('file', photo.file);
const record = await this.pb.collection('files').create(photoForm);
const url = this.pb.files.getUrl(record, record['file']);
uploadedPhotos.push(url);
} else if (photo.url) {
uploadedPhotos.push(photo.url);
}
}
formData.append('files', JSON.stringify(uploadedPhotos));

// Avatar
if (this.newAvatar) {
formData.append('avatar', this.newAvatar); // Este campo debe ser tipo `file` en PocketBase
}

const existingProfile = await this.pb.collection('usuariosPartner').getFirstListItem(
`userId="${this.auth.currentUser?.id}"`,
{ silent: true }
).catch(() => null);

if (existingProfile) {
await this.pb.collection('usuariosPartner').update(existingProfile.id, formData);
} else {
formData.append('userId', this.auth.currentUser?.id || '');
await this.pb.collection('usuariosPartner').create(formData);
}
const updated = await this.pb.collection('usuariosPartner').getOne(existingProfile?.id || '');
this.global.profileDataPartner.avatar = this.pb.files.getUrl(updated, updated['avatar']);
this.showSuccessToast = true;
setTimeout(() => {
this.showSuccessToast = false;
}, 3000); // Desaparece después de 3 segundos

console.log('Perfil actualizado correctamente');
this.avatarPreview = null;
this.newAvatar = null;
this.isEditProfile = false;
} catch (error) {
console.error('Error guardando perfil:', error);
}
} */

async saveProfile() {
  try {
    const userId = this.auth.currentUser?.id;
    if (!userId) {
      console.error('No hay usuario autenticado');
      return;
    }

    // Inicializar servicios si no están cargados
    if (!this.selectedServices.length && this.global.profileDataPartner.services) {
      this.selectedServices = this.global.profileDataPartner.services
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }

    // Subir fotos una sola vez
    const uploadedPhotos: string[] = [];

    for (const photo of this.photosPartner) {
      if (photo.file) {
        const photoForm = new FormData();
        photoForm.append('file', photo.file);

        const record = await this.pb.collection('files').create(photoForm, {
          requestKey: null
        });

        const url = this.pb.files.getUrl(record, record['file']);
        uploadedPhotos.push(url);
      } else if (photo.url) {
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
    formData.append('lat', String(this.global.profileDataPartner.lat || 0));
    formData.append('lng', String(this.global.profileDataPartner.lng || 0));
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

    this.global.profileDataPartner = {
      ...this.global.profileDataPartner,
      id: savedRecord.id,
      userId: savedRecord.userId,
      venueName: savedRecord.venueName,
      description: savedRecord.description,
      email: savedRecord.email,
      phone: savedRecord.phone,
      address: savedRecord.address,
      capacity: savedRecord.capacity,
      openingHours: savedRecord.openingHours,
      lat: savedRecord.lat,
      lng: savedRecord.lng,
      services: savedRecord.services,
      purchaseLink: savedRecord.purchaseLink,
      files: savedRecord.files || uploadedPhotos,
      avatar: savedRecord.avatar
        ? this.pb.files.getUrl(savedRecord, savedRecord.avatar)
        : this.global.profileDataPartner.avatar
    };

    this.showSuccessToast = true;
    setTimeout(() => {
      this.showSuccessToast = false;
    }, 3000);

    this.avatarPreview = null;
    this.newAvatar = null;
    this.isEditProfile = false;

    console.log('Perfil actualizado correctamente');
  } catch (error: any) {
    console.error('Error guardando perfil:', error);

    if (error?.isAbort) {
      console.error('PocketBase canceló la petición automáticamente');
    }

    if (error?.response) {
      console.error('Detalle PocketBase:', error.response);
    }
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
      imageUrl = this.pb.files.getUrl(fileRecord, fileRecord[   'file']);
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
/* openPromoModal() {
  this.modalService.close('promoOptionsModal'); // Cierra el modal de opciones
  setTimeout(() => {
    this.modalService.open('promoModal');
  }, 150); // Pequeño delay para asegurar la transición
} */

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
  if (this.selectedLat && this.selectedLng) {
    try {
      // ID del registro actual de usuariosPartner
      const userId = this.auth.currentUser?.id || this.global.profileDataPartner.userId;
      const partner = await this.pb.collection('usuariosPartner').getFirstListItem(`userId="${userId}"`);
      const partnerId = partner.id;

      // Actualiza solo lat y lng
      const result = await this.pb.collection('usuariosPartner').update(partnerId, {
        lat: this.selectedLat.toString(),
        lng: this.selectedLng.toString(),
      });

      // Actualiza el perfil global con la info nueva (buena práctica)
      this.global.profileDataPartner.lat = result['lat'];
      this.global.profileDataPartner.lng = result['lng'];

      this.toastMessage = 'Ubicación guardada correctamente';
      this.toastType = 'success';
      this.showToast = true;
      setTimeout(() => this.showToast = false, 3000);
    } catch (error) {
      console.error(error);
      this.toastMessage = 'No se pudo guardar la ubicación';
      this.toastType = 'error';
      this.showToast = true;
      setTimeout(() => this.showToast = false, 3000);
    }
  } else {
    this.toastMessage = 'Haz clic en el mapa para seleccionar una ubicación';
    this.toastType = 'info';
    this.showToast = true;
    setTimeout(() => this.showToast = false, 3000);
  }
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
