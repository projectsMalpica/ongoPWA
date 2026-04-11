import PocketBase from 'pocketbase';
import { Injectable, Inject, PLATFORM_ID, Renderer2, model } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GlobalService } from './global.service';
import { Observable, from, tap, map, of, BehaviorSubject } from 'rxjs';
import { UserInterface } from '../interface/user-interface ';
import { RecordModel } from 'pocketbase';
import { globalUser } from '../state/global-user.signal';
/* import { RealtimeOrdersService } from './realtime-orders.service';  
*/

type UserType = 'admin' | 'partner' | 'client';

interface PocketbaseAuthResponse {
  token: string;
  record: {
    id: string;
    email?: string;
    username?: string;
    name?: string;
    type?: UserType; // <- Asegúrate que este campo exista en tu colección users
    [k: string]: any;
  }
}

@Injectable({
  providedIn: 'root',
})
export class AuthPocketbaseService {
  public pb: PocketBase;
  public currentUser: any; // Usuario actual
  public profile: any = null; // Perfil actual (usuariosClient)
  complete: boolean = false;
  private readonly PB_URL = 'https://db.ongomatch.com:8090';
  private readonly AUTH_ENDPOINT = `${this.PB_URL}/api/collections/users/auth-with-password`;
  private currentUserSubject = new BehaviorSubject<any>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    public global: GlobalService) {
    this.pb = new PocketBase('https://db.ongomatch.com:8090');
    /*  const token = localStorage.getItem('accessToken');
     const userString = localStorage.getItem('user');
     if (token && userString) {
       this.pb.authStore.loadFromCookie(token);
       this.currentUser = JSON.parse(userString);
       localStorage.setItem('isLoggedin', 'true');
       localStorage.setItem('userId', this.currentUser.id);
       // Intenta cargar perfil
       const profileString = localStorage.getItem('profile');
       if (profileString) {
         this.profile = JSON.parse(profileString);
       } else {
         // Si no hay perfil en localStorage, intenta cargarlo del backend
         this.loadProfileFromBackend();
       }
     } */
    const token = localStorage.getItem('accessToken');
    const userString = localStorage.getItem('user');

    if (token && userString) {
      const user = JSON.parse(userString);
      this.pb.authStore.save(token, user);
      this.currentUser = user;
      localStorage.setItem('isLoggedin', 'true');
      localStorage.setItem('userId', this.currentUser.id);

      const profileString = localStorage.getItem('profile');
      if (profileString) {
        this.profile = JSON.parse(profileString);
      } else {
        this.loadProfileFromBackend();
      }
    }
  }
  private readonly STORAGE = {
    TOKEN: 'pb_token',
    USER: 'pb_user',
    TYPE: 'type',
    LOGGED: 'isLoggedin'
  };

  /** Login usando fetch. Devuelve {token, record} de PocketBase */
  async login(email: string, password: string, remember = false): Promise<PocketbaseAuthResponse> {
    const res = await fetch(this.AUTH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Si usas cookies de PB en el mismo dominio/puerto, agrega credentials: 'include'
      // credentials: 'include',
      body: JSON.stringify({ identity: email, password })
    });

    if (!res.ok) {
      const err = await this.safeJson(res);
      throw new Error(err?.message || 'Credenciales inválidas');
    }

    const data: PocketbaseAuthResponse = await res.json();

    // Persistencia básica
    if (remember) {
      localStorage.setItem(this.STORAGE.TOKEN, data.token);
      localStorage.setItem(this.STORAGE.USER, JSON.stringify(data.record));
      localStorage.setItem(this.STORAGE.TYPE, data.record?.type || '');
      localStorage.setItem(this.STORAGE.LOGGED, 'true');
    } else {
      sessionStorage.setItem(this.STORAGE.TOKEN, data.token);
      sessionStorage.setItem(this.STORAGE.USER, JSON.stringify(data.record));
      sessionStorage.setItem(this.STORAGE.TYPE, data.record?.type || '');
      sessionStorage.setItem(this.STORAGE.LOGGED, 'true');
    }

    return data;
  }

  /** Obtiene el perfil extendido según el type del user */
  async fetchProfileByType(userId: string, type: UserType, token?: string): Promise<any | null> {
    const authToken = token ?? this.getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    // Mapea tu “type” a su colección real
    const map: Record<UserType, string> = {
      admin: 'admins',                // si no tienes colección, puedes saltarte el fetch
      partner: 'usuariosPartner',
      client: 'usuariosClient',
    };
    const collection = map[type] || 'usuariosClient';

    // Nota: si no existe la colección para admin, puedes retornar null.
    if (type === 'admin') return null;

    const url = new URL(`${this.PB_URL}/api/collections/${collection}/records`);
    url.searchParams.set('page', '1');
    url.searchParams.set('perPage', '1');
    url.searchParams.set('filter', `userId="${userId}"`);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const err = await this.safeJson(res);
      throw new Error(err?.message || `No se pudo cargar ${collection}`);
    }
    const data = await res.json();
    return data?.items?.[0] ?? null;
  }

  getToken(): string | null {
    return localStorage.getItem(this.STORAGE.TOKEN) ?? sessionStorage.getItem(this.STORAGE.TOKEN);
  }
  getUser(): any | null {
    const raw = localStorage.getItem(this.STORAGE.USER) ?? sessionStorage.getItem(this.STORAGE.USER);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  logout() {
    [this.STORAGE.TOKEN, this.STORAGE.USER, this.STORAGE.TYPE, this.STORAGE.LOGGED].forEach(k => {
      localStorage.removeItem(k); sessionStorage.removeItem(k);
    });
  }

  private async safeJson(res: Response) {
    try { return await res.json(); } catch { return null; }
  }
  async loadProfileFromBackend() {
    if (!this.currentUser?.id) return;
    try {
      const profile = await this.pb.collection('usuariosClient').getFirstListItem(`userId="${this.currentUser.id}"`);
      this.profile = profile;
      localStorage.setItem('profile', JSON.stringify(profile));
    } catch (e) {
      console.warn('No se pudo cargar el perfil del backend:', e);
    }
  }
  async updateUserField(userId: string, updateData: any): Promise<void> {
    await this.pb.collection('users').update(userId, updateData);
  }

  async findPartnerByUserId(userId: string): Promise<any> {
    return await this.pb
      .collection('usuariosPartner')
      .getFirstListItem(`id="${userId}"`);
  }

  async updatePartnerField(partnerId: string, updateData: any): Promise<void> {
    await this.pb.collection('usuariosPartner').update(partnerId, updateData);
  }

  isLogin() {
    return localStorage.getItem('isLoggedin');
  }

  isAdmin() {
    const userType = localStorage.getItem('type');
    return userType === '"admin"';
  }
  isPartner() {
    const userType = localStorage.getItem('type');
    return userType === '"partner"';
  }

  isClient() {
    const userType = localStorage.getItem('type');
    return userType === '"client"';
  }

  async findClientByUserId(userId: string): Promise<any> {
    return await this.pb
      .collection('usuariosClient')
      .getFirstListItem(`userId="${userId}"`);
  }
  registerUser(email: string, password: string, type: string, name: string, address: string // Añadimos el parámetro address
  ): Observable<any> {
    const userData = {
      email: email,
      password: password,
      passwordConfirm: password,
      type: type,
      username: name,
      name: name,
    };

    // Crear usuario y luego crear el registro en usuariosPartner o usuariosClient
    return from(
      this.pb
        .collection('users')
        .create(userData)
        .then((user) => {
          const data = {
            name: name,
            venueName: '',
            address: address,
            capacity: '',
            description: '',
            openingHours: '',
            phone: '',
            userId: user.id,
            status: 'pending',
            birthday: '',
            gender: '',
            orientation: '',
            interestedIn: '',
            lookingFor: '',
            profileComplete: false,
            email: email,
            /* images: {}, */ // Agrega los campos correspondientes aquí
          };
          if (type === 'partner') {
            return this.pb.collection('usuariosPartner').create(data);
          } else if (type === 'client') {
            return this.pb.collection('usuariosClient').create(data);
          } else {
            throw new Error('Tipo de usuario no válido');
          }
        })
    );
  }

  profileStatus() {
    return this.complete;
  }

  onlyRegisterUser(
    email: string,
    password: string,
    type: string,
    name: string
  ): Observable<any> {
    const userData = {
      email: email,
      password: password,
      passwordConfirm: password,
      type: type,
      username: name,
      name: name,
    };

    // Crear usuario y devolver el observable con el usuario creado
    return from(
      this.pb
        .collection('users')
        .create(userData)
        .then((user) => {
          // No se necesita crear ningún registro adicional en clinics aquí
          return user; // Devolver los datos del usuario creado
        })
    );
  }

  loginUser(email: string, password: string): Observable<any> {
    return from(this.pb.collection('users').authWithPassword(email, password)).pipe(
      map((authData) => {
        const pbUser = authData.record;
        const userTypeRaw = pbUser['type'];
        const userType = Array.isArray(userTypeRaw) ? userTypeRaw[0] : userTypeRaw;

        const user: UserInterface = {
          id: pbUser.id,
          email: pbUser['email'],
          password: '',
          name: pbUser['name'],
          phone: pbUser['phone'],
          images: pbUser['images'] || {},
          type: userType,
          username: pbUser['username'],
          address: pbUser['address'],
          created: pbUser['created'],
          updated: pbUser['updated'],
          avatar: pbUser['avatar'] || '',
          status: pbUser['status'] || 'active',
          gender: pbUser['gender'],
        };

        return { ...authData, user };
      }),
      tap(async (authData) => {
        const user = authData.user;
        const token = authData.token;
        // 🚪 Limpia cualquier conexión anterior
        await this.pb.realtime.unsubscribe();
        this.pb.authStore.clear();
        this.pb.authStore.save(token, authData.record);

        // Guarda en localStorage
        this.setUser(user);
        localStorage.setItem('accessToken', token);
        localStorage.setItem('userId', user.id);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('type', JSON.stringify(user.type));

        console.log(`🔎 Login OK. Buscando perfil para tipo=${user.type}, userId=${user.id}`);

        // 🧩 Carga perfil asociado
        try {
          const coll = user.type === 'partner'
            ? 'usuariosPartner'
            : user.type === 'client'
              ? 'usuariosClient'
              : null;

          if (!coll) throw new Error(`Tipo inválido: ${user.type}`);

          const list = await this.pb.collection(coll).getList(1, 1, {
            filter: `userId="${user.id}"`,
          });

          if (list.items.length) {
            this.profile = list.items[0];
            console.log('✅ Perfil cargado:', this.profile);
            localStorage.setItem('profile', JSON.stringify(this.profile));
          } else {
            console.warn(`⚠️ Sin perfil en ${coll} para userId ${user.id}`);
          }
        } catch (err) {
          console.error('[AUTH] Error obteniendo perfil:', err);
        }
      })
    );
  }


  async logoutUser(): Promise<any> {
    await this.pb.realtime.unsubscribe();
    this.pb.authStore.clear();
    localStorage.clear();
    this.global.setRoute('login');
    return of(null);
  }

  setToken(token: string, model: RecordModel): void {
    this.pb.authStore.save(token, model);
  }
  /*  async permision() {
     // Espera hasta que authStore esté listo
     await new Promise(resolve => {
       const check = () => this.pb.authStore.isValid ? resolve(true) : setTimeout(check, 50);
       check();
     });
   
     if (!this.isAuthenticated()) {
       this.global.setRoute('home');
       return;
     }
     
     const user = this.getCurrentUser();
     if (!user?.type) {
       this.global.setRoute('home');
       return;
     }
   
     // Redirige según rol
     if (user.type === 'partner') {
       this.global.setRoute('home-local');
     } else if (user.type === 'client') {
       this.global.setRoute('explorer');
     } else {
       this.global.setRoute('login');
     }
   } */
  async permision() {
    await new Promise(resolve => {
      const check = () => this.pb.authStore.isValid ? resolve(true) : setTimeout(check, 50);
      check();
    });

    if (!this.isAuthenticated()) {
      this.global.setRoute('home');
      return;
    }

    const user = this.getCurrentUser();

    if (!user?.type) {
      this.global.setRoute('home');
      return;
    }

    switch (user.type) {
      case 'admin':
        this.global.setRoute('dashboard'); // o la ruta real de admin
        break;
      case 'partner':
        this.global.setRoute('home-local');
        break;
      case 'client':
        this.global.setRoute('explorer');
        break;
      default:
        this.global.setRoute('login');
        break;
    }
  }



  isAuthenticated(): boolean {
    return !!this.pb.authStore.isValid;
  }

  setUser(user: UserInterface): void {
    this.currentUser = user; // Almacenamos el usuario en la propiedad pública
    let user_string = JSON.stringify(user);
    let type = JSON.stringify(user.type);
    localStorage.setItem('user', user_string);
    localStorage.setItem('type', type);
  }

  getCurrentUser(): any {
    if (!this.currentUser) {
      this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    }
    return this.currentUser;
  }

  getCurrentProfile(): any {
    if (!this.profile) {
      this.profile = JSON.parse(localStorage.getItem('profile') || '{}');
    }
    return this.profile;
  }

  getUserId(): string {
    const userId = localStorage.getItem('userId');
    return userId ? userId : '';
  }

  async restoreSession() {
    try {
      const token = localStorage.getItem('accessToken');
      const recordString = localStorage.getItem('record');
      if (token && recordString) {
        const record = JSON.parse(recordString);
        this.pb.authStore.save(token, record);
        this.currentUser = JSON.parse(localStorage.getItem('user') || '{}');

        // ✔️ Carga siempre el perfil más reciente
        await this.loadProfileFromBackend();
      }
    } catch (e) {
      console.warn('No se pudo restaurar la sesión:', e);
    }
  }

  async waitForAuthUser(retries = 10, delayMs = 300): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
      if (this.currentUser?.id) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.pb.collection('users').requestPasswordReset(email);
      console.log('✔️ Solicitud de reseteo enviada correctamente.');
    } catch (error) {
      console.error('❌ Error al solicitar el reseteo de contraseña:', error);
      throw error;
    }
  }

  async confirmPasswordReset(token: string, newPassword: string, confirmPassword: string): Promise<void> {
    try {
      await this.pb.collection('users').confirmPasswordReset(token, newPassword, confirmPassword);
      console.log('✔️ Contraseña actualizada correctamente');
    } catch (error) {
      console.error('❌ Error al actualizar la contraseña:', error);
      throw error;
    }
  }
  async loginWithGoogle() {
    try {
      const authData = await this.pb.collection('users').authWithOAuth2({
        provider: 'google',
      });

      const pbUser = authData.record;

      if (!pbUser) {
        throw new Error('Google autenticó, pero PocketBase no devolvió usuario.');
      }

      const userTypeRaw = pbUser['type'];
      const userType = Array.isArray(userTypeRaw) ? userTypeRaw[0] : userTypeRaw;

      const user: UserInterface = {
        id: pbUser.id,
        email: pbUser['email'],
        password: '',
        name: pbUser['name'],
        phone: pbUser['phone'],
        images: pbUser['images'] || {},
        type: userType,
        username: pbUser['username'],
        address: pbUser['address'],
        created: pbUser['created'],
        updated: pbUser['updated'],
        avatar: pbUser['avatar'] || '',
        status: pbUser['status'] || 'active',
        gender: pbUser['gender'],
      };

      await this.pb.realtime.unsubscribe();
      this.pb.authStore.clear();
      this.pb.authStore.save(authData.token, authData.record);

      this.setUser(user);
      localStorage.setItem('accessToken', authData.token);
      localStorage.setItem('userId', user.id);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('type', JSON.stringify(user.type));
      localStorage.setItem('isLoggedin', 'true');
      localStorage.setItem('record', JSON.stringify(authData.record));

      globalUser.set(user);
      this.currentUserSubject.next(user);

      try {
        const coll =
          user.type === 'partner'
            ? 'usuariosPartner'
            : user.type === 'client'
              ? 'usuariosClient'
              : null;

        if (coll) {
          const list = await this.pb.collection(coll).getList(1, 1, {
            filter: `userId="${user.id}"`,
          });

          if (list.items.length) {
            this.profile = list.items[0];
            localStorage.setItem('profile', JSON.stringify(this.profile));
          } else {
            console.warn(`⚠️ Sin perfil en ${coll} para userId ${user.id}`);
          }
        }
      } catch (err) {
        console.error('[AUTH][GOOGLE] Error obteniendo perfil:', err);
      }

      return user;
    } catch (err: any) {
      console.error('Error en login con Google:', err);
      throw this.mapPocketbaseError(err);
    }
  }
  private mapPocketbaseError(err: unknown): Error {
    const e = err as any;
    const payload = (e?.data ?? e?.response ?? {}) as {
      code?: number;
      message?: string;
      data?: Record<string, { code?: string; message?: string }>;
    };

    const status: number = e?.status ?? 0;
    const message: string = e?.message ?? payload?.message ?? 'Error';
    const fields = (payload?.data ?? {}) as Record<string, { code?: string; message?: string }>;

    if (status === 400) {
      if (fields['email']?.code === 'validation_invalid_email') return new Error('El email no es válido.');
      if (fields['email']?.code === 'validation_value_already_in_use') return new Error('Este email ya está registrado.');
      if (fields['username']?.code === 'validation_value_already_in_use') return new Error('El username ya está en uso.');
      if (fields['password']?.code) return new Error('La contraseña no cumple los requisitos.');
      if (fields['role']?.code) return new Error('Rol no permitido.');
      if (message.includes('Failed to create record')) return new Error('Este email ya está registrado.');
    }

    const lower = (message || '').toLowerCase();
    if (lower.includes('failed to authenticate')) {
      return new Error('Credenciales inválidas o usuario no verificado.');
    }

    return new Error(message || 'No se pudo completar la operación.');
  }
  async saveUserLocation(): Promise<void> {
    if (!navigator.geolocation) return;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      // Guarda temporalmente en memoria o localStorage
      localStorage.setItem('user_location', JSON.stringify(coords));

    } catch (err) {
      console.warn('No se pudo obtener ubicación del paciente:', err);
    }
  }

}
