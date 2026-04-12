import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { CommonModule } from '@angular/common';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { RealtimeClientesService } from '../../services/realtime-clientes.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OnInit } from '@angular/core';
import PocketBase from 'pocketbase';
import * as bootstrap from 'bootstrap';
import 'swiper/css';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ FormsModule, ReactiveFormsModule, CommonModule],  
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile implements OnInit {
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
){}


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
    const userData = await this.pb.collection('usuariosClient').getFirstListItem(`userId="${user.id}"`);

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

    // Procesar las fotos
    this.photos = this.parsePhotos(userData['photos']);
    // Procesar los intereses
    this.selectedInterests = this.profileData.interests ? this.profileData.interests.split(',').map((i: string) => i.trim()) : [];

  } catch (error) {
  }
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

saveRelationshipGoal() {
  // Guardar en perfil
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

saveSexualOrientation() {
  // Guardar en perfil
}

saveGender() {
  // Guardar en perfil
}

 async saveProfile() {
    try {
      // Subir fotos nuevas
      const uploadedPhotos = [];
      for (const photo of this.photos) {
        if (photo.file) {
          const formData = new FormData();
          formData.append('file', photo.file);
  
          // Subir la imagen a PocketBase
          const record = await this.pb.collection('files').create(formData);
          // Obtener URL de la imagen subida
          const url = this.pb.files.getUrl(record, record['file']);
          uploadedPhotos.push(url);
        } else if (photo.url) {
          // Mantener las URLs existentes
          uploadedPhotos.push(photo.url);
        }
      }
  
      // Subir nuevo avatar si existe
      let avatarUrl = this.profileData.avatar;
      if (this.avatar) {
        const avatarFormData = new FormData();
        avatarFormData.append('file', this.avatar);
        avatarFormData.append('userId', this.auth.currentUser?.id || '');
        avatarFormData.append('type', 'avatar');
  
        // Subir avatar a la colección files
        const avatarRecord = await this.pb.collection('files').create(avatarFormData);
        avatarUrl = this.pb.files.getUrl(avatarRecord, avatarRecord['file']);
      }
  
      // Preparar datos para PocketBase
      const data: any = {
        name: this.profileData.name,
        birthday: this.profileData.birthday,
        interestedIn: this.profileData.interestedIn,
        lookingFor: this.profileData.lookingFor,
        language: this.profileData.language,
        orientation: this.profileData.orientation,
        age: this.profileData.age,
        gender: this.profileData.gender,
        address: this.profileData.address,
        about: this.profileData.about,
        photos: JSON.stringify(uploadedPhotos),
        email: this.auth.currentUser?.email,
        userId: this.auth.currentUser?.id,
        status: this.auth.currentUser?.status,
        interests: this.profileData.interests,
        avatar: avatarUrl,
      };
  
      // Actualizar o crear perfil
      const existingProfile = await this.pb.collection('usuariosClient').getFirstListItem(
        `userId="${this.auth.currentUser?.id}"`,
        { silent: true }
      ).catch(() => null);
  
      if (existingProfile) {
        await this.pb.collection('usuariosClient').update(existingProfile.id, data);
      } else {
        data.userId = this.auth.currentUser?.id;
        await this.pb.collection('usuariosClient').create(data);
      }
      const updated = await this.pb.collection('usuariosClient').getOne(existingProfile?.id || '');
      this.global.profileDataPartner.avatar = this.pb.files.getUrl(updated, updated['avatar']);

      console.log('Perfil actualizado correctamente');
      this.isEditProfile = false;
    } catch (error) {
      console.error('Error guardando perfil:', error);
      console.log('Error al guardar los cambios');
    }
  }

cancelEdit() {
  this.loadProfile();
  this.avatarPreview = null;
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
