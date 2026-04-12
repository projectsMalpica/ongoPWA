import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { CommonModule } from '@angular/common';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { RealtimeClientesService } from '../../services/realtime-clientes.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AfterViewInit, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import PocketBase from 'pocketbase';
import * as bootstrap from 'bootstrap';
import 'swiper/css';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';
import Swiper from 'swiper';
import { Pagination } from 'swiper/modules';
import 'swiper/css/pagination';
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('clientPlansSwiper', { static: false })
clientPlansSwiperRef?: ElementRef<HTMLDivElement>;

@ViewChild('clientPlansPagination', { static: false })
clientPlansPaginationRef?: ElementRef<HTMLDivElement>;

private clientPlansSwiper?: Swiper;
private clientPlansSwiperSub?: Subscription;
  profileData: any = {
    name: '',
    gender: '',
    userId: '',
    status: '',
    photos: [],
    birthday: '',
    interestedIn: '',
    email: '',
    orientation: '',
    lookingFor: '',
    address: '',
    language: '',
    about: '',
    age: null,
    interests: [],
    avatar: '',

  };
  isSaving = false;
  photos: any[] = Array(6).fill({});
  selectedInterests: string[] = [];
  interestSearch: string = '';
  allInterests: string[] = [
    'Ludo', 'Football', 'Cricket', 'Tea', 'Brunch', 'Compras', 'Instagram',
    'Collecting', 'Video juegos', 'Café', 'Peliculas', 'Bailar', 'Bicicletas', 'Autos',
    'Estudiar', 'Walking', 'Correr', 'Manga', 'Fotografia', 'Arte', 'Musica'
  ];
  filteredInterests: string[] = [...this.allInterests];

  lookingFor = [
    { value: 'Relación seria', label: 'Relación seria', icon: '../assets/images/w3tinder/svg/love.svg' },
    { value: 'Diversión a corto plazo', label: 'Diversión a corto plazo', icon: '../assets/images/w3tinder/svg/smile-emoji.svg' },
    { value: 'Amistad', label: 'Amistad', icon: '../assets/images/w3tinder/svg/toast.svg' },
    { value: 'Citas casuales', label: 'Citas casuales', icon: '../assets/images/w3tinder/svg/party.svg' },
    { value: 'Abiert@ a opciones', label: 'Abiert@ a opciones', icon: '../assets/images/w3tinder/svg/hello.svg' },
    { value: 'Averiguarlo', label: 'Averiguarlo', icon: '../assets/images/w3tinder/svg/think.svg' }
  ];

  languages = [
    { name: 'Indio', flag: '../assets/images/flags/india.svg' },
    { name: 'Ingles', flag: '../assets/images/flags/united-states.svg' },
    { name: 'Aleman', flag: '../assets/images/flags/germany.svg' },
    { name: 'Italiano', flag: '../assets/images/flags/italy.svg' },
    { name: 'Espanol', flag: '../assets/images/flags/spain.svg' }
  ];

  orientation = [
    { value: 'Heterosexual', label: 'Heterosexual' },
    { value: 'Gay', label: 'Gay' },
    { value: 'Lesbian', label: 'Lesbian' },
    { value: 'Bisexual', label: 'Bisexual' },
    { value: 'Asexual', label: 'Asexual' },
    { value: 'Queer', label: 'Queer' },
    { value: 'Demisexual', label: 'Demisexual' }
  ];

  gender = [
    { value: 'Masculino', label: 'Masculino' },
    { value: 'Femenino', label: 'Femenino' },
    { value: 'Otro', label: 'Otro' }
  ];

  interestedIn = [
    { value: 'Hombres', label: 'Hombres' },
    { value: 'Mujeres', label: 'Mujeres' },
    { value: 'Otro', label: 'Otro' }
  ];

  private pb = new PocketBase('https://db.ongomatch.com:8090');
  isEditProfile: boolean = false;
  newAvatar: File | null = null;
  avatar: File | null = null;
  avatarPreview: string | ArrayBuffer | null = null;
  planningClients: any[] = [];
  constructor(
    public global: GlobalService,
    public auth: AuthPocketbaseService,
    public realtimeClientes: RealtimeClientesService
  ) { }


  async ngOnInit() {
    this.fetchClientData();

    await this.auth.restoreSession();

    // ✔️ Siempre carga el perfil actualizado del backend
    await this.loadProfile();

    // ✔️ Guarda el perfil actualizado en auth y global
    this.auth.profile = { ...this.profileData };
    localStorage.setItem('profile', JSON.stringify(this.profileData));
    this.global.profileData = { ...this.profileData };


    // ✔️ Inicializa realtime solo si estás logueado
    await this.global.initClientesRealtime();
    await this.global.initPlanningClientsRealtime();
  }

  countries = [
    { code: '+57', name: 'Colombia', flag: '🇦🇷' },
    { code: '+56', name: 'Chile', flag: '🇨🇱' },
    { code: '+54', name: 'Argentina', flag: '🇦🇷' }
  ];
  selectedCountry = this.countries[0]; // Default to colombia
  getCountryFromPhone(phone: string): typeof this.countries[0] {
    if (!phone) return this.countries[0];

    for (const country of this.countries) {
      if (phone.startsWith(country.code)) {
        return country;
      }
    }
    return this.countries[0];
  }
  async fetchClientData(): Promise<void> {
    try {
      const userId = this.auth.getUserId();
      const clientRecord = await this.auth.findClientByUserId(userId);

      if (clientRecord) {
        this.profileData = {
          name: clientRecord.name || '',
          email: clientRecord.email || '',
          phone: clientRecord.phone || '',
          gender: clientRecord.gender || ''
        };
        // Set the correct country based on the loaded phone number
        if (this.profileData.phone) {
          this.selectedCountry = this.getCountryFromPhone(this.profileData.phone);
        }
      }
    } catch (error) {
    }
  }

async loadProfile() {
  const user = this.auth.getCurrentUser();
  console.log('Cargando perfil de usuario:', user);

  if (!user?.id) {
    console.error('No hay usuario autenticado');
    return;
  }

  try {
    const userData = await this.pb
      .collection('usuariosClient')
      .getFirstListItem(`userId="${user.id}"`);

    const rawInterests = userData['interests'];
    let interestsArray: string[] = [];

    if (typeof rawInterests === 'string' && rawInterests.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(rawInterests);
        interestsArray = Array.isArray(parsed)
          ? parsed.map((item: any) => String(item).trim()).filter(Boolean)
          : [];
      } catch (e) {
        console.warn('No se pudo parsear interests como JSON:', e);
        interestsArray = [];
      }
    } else if (Array.isArray(rawInterests)) {
      interestsArray = rawInterests
        .map((item: any) => String(item).trim())
        .filter(Boolean);
    } else if (typeof rawInterests === 'string' && rawInterests.trim()) {
      interestsArray = rawInterests
        .split(',')
        .map((item: string) => item.trim())
        .filter(Boolean);
    }

    this.profileData = {
      name: userData['name'] || '',
      interestedIn: userData['interestedIn'] || '',
      lookingFor: userData['lookingFor'] || '',
      language: userData['language'] || '',
      orientation: userData['orientation'] || '',
      birthday: userData['birthday'] || '',
      gender: userData['gender'] || '',
      address: userData['address'] || '',
      about: userData['about'] || '',
      age: userData['age'] ?? null,
      photos: userData['photos'] || [],
      email: userData['email'] || '',
      userId: userData['userId'] || '',
      status: userData['status'] || '',
      interests: interestsArray.join(', '),
      avatar: userData['avatar'] || '',
    };

    this.selectedInterests = [...interestsArray];
    this.photos = this.parsePhotos(userData['photos']);

    this.global.profileData = { ...this.profileData };
  } catch (error) {
    console.error('Error cargando perfil:', error);

    this.profileData = {
      name: '',
      gender: '',
      userId: '',
      status: '',
      photos: [],
      birthday: '',
      interestedIn: '',
      email: '',
      orientation: '',
      lookingFor: '',
      address: '',
      language: '',
      about: '',
      age: null,
      interests: '',
      avatar: '',
    };

    this.selectedInterests = [];
    this.photos = Array(6).fill({ url: '' });
  }
}
ngAfterViewInit(): void {
  this.bindClientPlansSwiper();
}
private bindClientPlansSwiper(): void {
  this.clientPlansSwiperSub?.unsubscribe();

  this.clientPlansSwiperSub = this.global.planningClients$.subscribe((plans) => {
    if (!plans || !plans.length) return;

    setTimeout(() => {
      this.initClientPlansSwiper();
    }, 0);
  });
}
ngOnDestroy(): void {
  this.clientPlansSwiper?.destroy(true, true);
  this.clientPlansSwiperSub?.unsubscribe();
}

private initClientPlansSwiper(): void {
  if (!this.clientPlansSwiperRef?.nativeElement || !this.clientPlansPaginationRef?.nativeElement) {
    return;
  }

  if (this.clientPlansSwiper) {
    this.clientPlansSwiper.destroy(true, true);
  }

  this.clientPlansSwiper = new Swiper(this.clientPlansSwiperRef.nativeElement, {
    modules: [Pagination],
    slidesPerView: 1.08,
    spaceBetween: 12,
    grabCursor: true,
    observer: true,
    observeParents: true,
    watchOverflow: true,
    pagination: {
      el: this.clientPlansPaginationRef.nativeElement,
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
  parsePhotos(photosData: any): any[] {
    let photosArray: { url: string }[] = [];

    if (Array.isArray(photosData)) {
      photosArray = photosData.map((url: string) => ({ url }));
    } else if (typeof photosData === 'string' && photosData.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(photosData);
        photosArray = Array.isArray(parsed) ? parsed.map((url: string) => ({ url })) : [];
      } catch (error) {
        console.warn('No se pudo parsear photos:', error);
      }
    }

    // Rellenar hasta 6 slots
    while (photosArray.length < 6) {
      photosArray.push({ url: '' });
    }

    return photosArray;
  }


  async loadProfileData() {
    const user = this.auth.getCurrentUser();
    if (!user?.id) {
      console.error('No hay usuario autenticado');
      return;
    }

    try {
      const userData = await this.pb.collection('usuariosClient').getFirstListItem(
        `userId="${user.id}"`
      );
      // Dentro de loadProfileData()
      this.profileData = {
        name: userData['name'] || '',
        interestedIn: userData['interestedIn'] || '',
        lookingFor: userData['lookingFor'] || '',
        language: userData['language'] || '',
        orientation: userData['orientation'] || '',
        birthday: userData['birthday'] || '',
        gender: userData['gender'] || '',
        address: userData['address'] || '',
        about: userData['about'] || '',
        age: userData['age'] || '',
        photos: userData['photos'] || [],
        email: userData['email'] || '',
        userId: userData['userId'] || '',
        status: userData['status'] || '',
        interests: userData['interests'] || '',
        avatar: userData['avatar'] || '',
      };

      // Cargar fotos si existen
      if (userData['photos'] && typeof userData['photos'] === 'string' && userData['photos'].trim().startsWith('[')) {
        try {
          const photosData = JSON.parse(userData['photos']);
          this.photos = Array.isArray(photosData) ? photosData.map((url: string) => ({ url })) : [];
        } catch (error) {
          console.warn('No se pudo parsear photos:', error);
          this.photos = Array(6).fill({});
        }
      } else {
        // Si no hay fotos o es un string vacío, inicializa el arreglo vacío
        this.photos = Array(6).fill({});
      }


      // Inicializar intereses seleccionados
      if (this.profileData.interests) {
        this.selectedInterests = this.profileData.interests.split(',').map((i: string) => i.trim());
      }
      // Al final de loadProfileData()
      this.global.profileData = { ...this.profileData };
    } catch (error) {
      console.error('Error cargando perfil:', error);
    }
  }

  filterInterests() {
    if (!this.interestSearch) {
      this.filteredInterests = [...this.allInterests];
      return;
    }

    this.filteredInterests = this.allInterests.filter(interest =>
      interest.toLowerCase().includes(this.interestSearch.toLowerCase())
    );
  }


  toggleInterest(interest: string) {
    const index = this.selectedInterests.indexOf(interest);
    if (index >= 0) {
      this.selectedInterests.splice(index, 1);
    } else {
      this.selectedInterests.push(interest);
    }
  }

  saveInterests() {
    this.profileData.interests = this.selectedInterests.join(', ');
  }


  async enableEditProfile() {
    await this.loadProfile();
    this.avatarPreview = null; // Limpia la previsualización previa del avatar
    this.isEditProfile = true;
  }

  selectLanguage(lang: any) {
    this.profileData.language = lang.name;
    // Cerrar el offcanvas después de seleccionar
    const offcanvas = document.getElementById('offcanvasLang');
    const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvas as Element);
    if (bsOffcanvas) {
      bsOffcanvas.hide();
    }
  }

private closeAllOffcanvas(): void {
  const elements = document.querySelectorAll('.offcanvas.show');

  elements.forEach((el) => {
    const instance =
      bootstrap.Offcanvas.getInstance(el as Element) ||
      new bootstrap.Offcanvas(el as Element);

    instance.hide();
  });

  document.querySelectorAll('.offcanvas-backdrop').forEach((el) => el.remove());

  document.body.classList.remove('modal-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
}
  async saveProfile() {
  if (this.isSaving) return;

  try {
    this.isSaving = true;

    Swal.fire({
      title: 'Guardando perfil...',
      text: 'Espera un momento',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const uploadedPhotos: string[] = [];

    for (const photo of this.photos) {
      if (photo?.file) {
        const formData = new FormData();
        formData.append('file', photo.file);

        const record = await this.pb.collection('files').create(formData);
        const url = this.pb.files.getUrl(record, record['file']);
        uploadedPhotos.push(url);
      } else if (photo?.url) {
        uploadedPhotos.push(photo.url);
      }
    }

    let avatarUrl = this.profileData.avatar || '';

    if (this.avatar) {
      const avatarFormData = new FormData();
      avatarFormData.append('file', this.avatar);
      avatarFormData.append('userId', this.auth.currentUser?.id || '');
      avatarFormData.append('type', 'avatar');

      const avatarRecord = await this.pb.collection('files').create(avatarFormData);
      avatarUrl = this.pb.files.getUrl(avatarRecord, avatarRecord['file']);
    }

    const data: any = {
      name: this.profileData.name || '',
      birthday: this.profileData.birthday || '',
      interestedIn: this.profileData.interestedIn || '',
      lookingFor: this.profileData.lookingFor || '',
      language: this.profileData.language || '',
      orientation: this.profileData.orientation || '',
      age: this.profileData.age || null,
      gender: this.profileData.gender || '',
      address: this.profileData.address || '',
      about: this.profileData.about || '',
      photos: JSON.stringify(uploadedPhotos),
      email: this.auth.currentUser?.email || '',
      userId: this.auth.currentUser?.id || '',
      status: this.auth.currentUser?.status || '',
      interests: JSON.stringify(this.selectedInterests),
      avatar: avatarUrl,
    };

    const existingProfile = await this.pb
      .collection('usuariosClient')
      .getFirstListItem(`userId="${this.auth.currentUser?.id}"`)
      .catch(() => null);

    if (existingProfile) {
      await this.pb.collection('usuariosClient').update(existingProfile.id, data);
    } else {
      await this.pb.collection('usuariosClient').create(data);
    }

    await this.loadProfile();

    this.global.profileData = { ...this.profileData };
    this.auth.profile = { ...this.profileData };
    localStorage.setItem('profile', JSON.stringify(this.profileData));

    this.avatarPreview = null;
    this.avatar = null;

this.closeAllOffcanvas();

setTimeout(() => {
  this.isSaving = false;
  this.isEditProfile = false;
}, 200);
    this.isSaving = false;
    this.isEditProfile = false;

    Swal.close();

    Swal.fire({
      icon: 'success',
      title: 'Perfil actualizado',
      text: 'Tus cambios se guardaron correctamente',
      timer: 1400,
      showConfirmButton: false
    });

  } catch (error: any) {
    console.error('Error guardando perfil:', error);

    this.isSaving = false;
    Swal.close();

    Swal.fire({
      icon: 'error',
      title: 'No se pudo guardar',
      text: error?.message || 'Ocurrió un error al guardar los cambios',
      confirmButtonText: 'Aceptar'
    });
  }
}
  private normalizeStringArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) return [];

    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed)
          ? parsed.map(v => String(v).trim()).filter(Boolean)
          : [];
      } catch {
        return [];
      }
    }

    return trimmed.split(',').map(v => v.trim()).filter(Boolean);
  }

  return [];
}
  saveInterestedIn() {
    this.profileData.interestedIn = this.profileData.interestedIn || '';
  }
  saveRelationshipGoal() {
    this.profileData.lookingFor = this.profileData.lookingFor || '';
  }

  saveSexualOrientation() {
    this.profileData.orientation = this.profileData.orientation || '';
  }

  saveGender() {
    this.profileData.gender = this.profileData.gender || '';
  }

  async cancelEdit() {
    await this.loadProfile();
    this.avatarPreview = null;
    this.avatar = null;
    this.isEditProfile = false;
  }

  onPhotoSelected(event: any, index: number) {
    const file = event.target.files[0];
    if (file) {
      // Crear URL temporal para previsualización
      const url = URL.createObjectURL(file);
      this.photos[index] = {
        url: url,
        file: file
      };
    }
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.avatar = input.files[0];

      const reader = new FileReader();
      reader.onload = (e) => {
        this.avatarPreview = e.target?.result ?? null;
      };
      reader.readAsDataURL(this.avatar);
    }
  }
  async uploadAvatarFile(): Promise<any> {
    if (!this.avatar) return null;

    const formData = new FormData();
    formData.append('file', this.avatar);
    formData.append('userId', this.auth.currentUser?.id || '');
    formData.append('type', 'avatar');

    // PocketBase SDK permite pasar FormData directamente
    const fileRecord = await this.pb.collection('files').create(formData);
    return fileRecord;
  }
  removePhoto(index: number) {
    this.photos[index] = {};
    // Limpiar el input file
    const fileInput = document.getElementById('imageUpload' + index) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  addPhoto() {
    const emptyIndex = this.photos.findIndex(p => !p.url);
    if (emptyIndex !== -1) {
      const inputId = 'imageUpload' + emptyIndex;
      document.getElementById(inputId)?.click();
    } else {
      console.log('Máximo de fotos alcanzado');
    }
  }
}
