import PocketBase from 'pocketbase';
import { Injectable, Inject, PLATFORM_ID, Renderer2, model } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GlobalService } from './global.service';
import { Observable, from, tap, map, of, BehaviorSubject } from 'rxjs';
import { UserInterface } from '../interface/user-interface ';
import { RecordModel } from 'pocketbase';
import { globalUser } from '../state/global-user.signal';
import { Router } from '@angular/router';
import { environment } from '../environments/environment';
import { pocketBase } from './pocketbase-client';
import { PushService } from './push.service';
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

export interface GoogleAuthResult {
  needsRegister: boolean;
  reason?: 'missing_type' | 'incomplete_profile';
  user: any;
  profile?: any | null;
  type: UserType | null;
  selectedType?: 'client' | 'partner';
}

export const PENDING_GOOGLE_REGISTRATION_TYPE = 'ongo_pending_registration_type';

@Injectable({
  providedIn: 'root',
})
export class AuthPocketbaseService {
  public pb: PocketBase;
  public currentUser: any; // Usuario actual
  public profile: any = null; // Perfil actual (usuariosClient)
  complete: boolean = false;
  private readonly PB_URL = environment.pbUrl;
  private readonly AUTH_ENDPOINT = `${this.PB_URL}/api/collections/users/auth-with-password`;
  private currentUserSubject = new BehaviorSubject<any>(null);
  currentUser$ = this.currentUserSubject.asObservable();
  user: any;
  constructor(
    public global: GlobalService,
    public router: Router,
    private pushService: PushService
  ) {
    this.pb = pocketBase;

    const token = localStorage.getItem('accessToken');
    const userString = localStorage.getItem('user');

    if (token && userString) {
      try {
        const user = JSON.parse(userString);

        this.pb.authStore.save(token, user);
        this.currentUser = user;

        localStorage.setItem('isLoggedin', 'true');
        localStorage.setItem('userId', user.id);

        this.loadProfileFromBackend();
      } catch (error) {
        console.warn('No se pudo restaurar sesión local:', error);
        this.clearLocalSession();
      }
    }

    if (this.pb.authStore.isValid && this.pb.authStore.record?.id) {
      void this.repairProfileAfterReload();
    }
  }

  private async repairProfileAfterReload(): Promise<void> {
    const authUser = this.pb.authStore.record;
    const type = this.normalizeUserType(authUser?.['type']);
    if (!authUser?.id || (type !== 'client' && type !== 'partner')) return;

    try {
      const profile = await this.findGoogleProfile(authUser.id, type);
      if (!this.isProfileComplete(profile)) return;
      this.persistGoogleSession(this.pb.authStore.token, authUser, type, profile);
      console.log('[OAuth] Sesión restaurada y perfil verificado:', {
        type,
        userId: this.anonymizeId(authUser.id)
      });
    } catch (error: any) {
      console.error('[OAuth] No se pudo reparar el perfil al recargar:', {
        status: error?.status || 0,
        message: error?.message || 'Error desconocido',
        sessionValid: this.pb.authStore.isValid
      });
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
  async startGoogleOAuth(
    source: 'login' | 'register',
    selectedType?: 'client' | 'partner'
  ): Promise<GoogleAuthResult> {
    if (source === 'register' && !selectedType) {
      throw new Error('Selecciona si deseas registrarte como cliente o partner.');
    }

    this.clearPendingGoogleSession();
    if (source === 'register' && selectedType) {
      sessionStorage.setItem(PENDING_GOOGLE_REGISTRATION_TYPE, selectedType);
    }
    console.log('[OAuth] Inicio:', {
      pocketBaseUrl: this.pb.baseURL,
      provider: 'google',
      redirectUri: `${this.pb.baseURL}/api/oauth2-redirect`
    });

    try {
      const authData = await this.pb.collection('users').authWithOAuth2({
        provider: 'google',
        ...(source === 'register' && selectedType
          ? { createData: { type: selectedType } }
          : {})
      });
      console.log('[OAuth] authWithOAuth2 resuelto:', {
        userId: this.anonymizeId(authData.record?.id),
        sessionValid: this.pb.authStore.isValid
      });
      console.log('[OAuth] Iniciando procesamiento posterior');
      try {
        const result = await this.processGoogleAuthResult(authData, source, selectedType);
        const navigated = await this.resolveAuthenticatedUserDestination(result);
        if (!navigated && source === 'login') {
          await this.router.navigateByUrl('/register');
        }
        return result;
      } catch (profileError: any) {
        if (this.pb.authStore.isValid) {
          console.error('[OAuth] Google autenticó, pero falló el perfil:', {
            message: profileError?.message || 'Error desconocido',
            sessionValid: true
          });
          throw new Error(
            'Google inició sesión correctamente, pero no pudimos preparar tu perfil. Tu sesión se conservó; vuelve a intentarlo.'
          );
        }
        throw profileError;
      }
    } catch (error: any) {
      if (source === 'register' && !this.pb.authStore.isValid) {
        sessionStorage.removeItem(PENDING_GOOGLE_REGISTRATION_TYPE);
      }
      console.error('[OAuth] Fallo:', {
        message: error?.message || 'Error desconocido',
        status: error?.status || 0,
        sessionValid: this.pb.authStore.isValid
      });
      throw error;
    } finally {
      console.log('[OAuth] Finalizado:', { sessionValid: this.pb.authStore.isValid });
    }
  }

  private anonymizeId(id?: string): string {
    if (!id) return 'sin-id';
    return id.length <= 6 ? `${id.slice(0, 2)}…` : `${id.slice(0, 3)}…${id.slice(-3)}`;
  }

  async resolveAuthenticatedUserDestination(result: GoogleAuthResult): Promise<boolean> {
    if (result.needsRegister) return false;
    sessionStorage.removeItem(PENDING_GOOGLE_REGISTRATION_TYPE);

    let destination: '/admin' | '/home-local' | '/maps';
    if (result.type === 'admin') {
      destination = '/admin';
    } else if (result.type === 'partner') {
      await this.global.loadProfile();
      await this.global.initPartnersRealtime();
      destination = '/home-local';
    } else {
      await this.global.loadProfile();
      await this.global.initClientesRealtime();
      destination = '/maps';
    }

    const navigated = await this.router.navigate([destination]);
    console.info('[OAuth] Navegación final', { destination, navigated });
    if (!navigated) {
      throw new Error(`No se pudo navegar a ${destination} después de autenticar con Google.`);
    }
    return true;
  }

  clearPendingGoogleSession(): void {
    sessionStorage.removeItem('pendingGoogleToken');
    sessionStorage.removeItem('pendingGoogleUser');
    localStorage.removeItem('pendingGoogleToken');
    localStorage.removeItem('pendingGoogleUser');
  }

  clearPendingGoogleRegistrationType(): void {
    sessionStorage.removeItem(PENDING_GOOGLE_REGISTRATION_TYPE);
  }

  private persistGoogleSession(token: string, record: any, type: UserType, profile: any | null): any {
    const finalUser = { ...record, type };
    this.pb.authStore.save(token, record);
    this.global.pb.authStore.save(token, record);
    this.currentUser = finalUser;
    this.profile = profile;
    this.currentUserSubject.next(finalUser);

    localStorage.setItem('accessToken', token);
    localStorage.setItem('userId', record.id);
    localStorage.setItem('user', JSON.stringify(finalUser));
    localStorage.setItem('record', JSON.stringify(record));
    localStorage.setItem('type', type);
    localStorage.setItem('isLoggedin', 'true');

    if (type === 'partner' && profile) {
      localStorage.setItem('profilePartner', JSON.stringify(profile));
      localStorage.removeItem('profile');
    } else if (type === 'client' && profile) {
      localStorage.setItem('profile', JSON.stringify(profile));
      localStorage.removeItem('profilePartner');
    }

    return finalUser;
  }

  async completeGoogleRegister(type: 'client' | 'partner', data: any) {
    const token = this.pb.authStore.token;
    const googleUser = this.pb.authStore.record;

    if (!this.pb.authStore.isValid || !token || !googleUser?.id) {
      throw new Error('La sesión de Google ya no es válida. Inicia sesión nuevamente.');
    }

    const existingType = this.normalizeUserType(googleUser?.['type']);
    if (existingType && existingType !== type) {
      throw new Error(
        existingType === 'client'
          ? 'Esta cuenta ya está vinculada como cliente.'
          : 'Esta cuenta ya está vinculada como partner.'
      );
    }

    this.pb.authStore.save(token, googleUser);

    const name =
      data.name ||
      data.venueName ||
      googleUser['name'] ||
      googleUser['email']?.split('@')[0] ||
      'Usuario';

    const email = googleUser['email'];

    if (!email) {
      throw new Error('Google no devolvió un correo válido.');
    }

    const userUpdate: any = { type, name };
    if (!googleUser['username']) userUpdate.username = this.makeSafeUsername(name);

    const updatedUser = await this.pb.collection('users').update(googleUser.id, userUpdate);

    const profileData = {
      ...data,
      userId: googleUser.id,
      email,
      profileComplete: true
    };

    const collection = type === 'partner'
      ? 'usuariosPartner'
      : 'usuariosClient';

    let profile: any;

    try {
      console.log('[OAuth] Buscando perfil para completar registro:', { type });
      const existing = await this.pb
        .collection(collection)
        .getFirstListItem(`userId="${googleUser.id}"`);

      console.log('[OAuth] Actualizando perfil existente:', { type });
      profile = await this.pb.collection(collection).update(existing.id, profileData);

    } catch (error: any) {
      if (error?.status === 404) {
        console.log('[OAuth] Creando perfil faltante:', { type });
        profile = await this.pb.collection(collection).create(profileData);
      } else {
        throw error;
      }
    }

    const finalUser = this.persistGoogleSession(token, updatedUser, type, profile);
    this.clearPendingGoogleRegistrationType();
    return { profile, user: finalUser, record: updatedUser, type, token };
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
    const type = this.normalizeUserType(this.currentUser?.type);

    if (type === 'admin') {
      this.profile = {
        id: this.currentUser.id,
        userId: this.currentUser.id,
        type: 'admin',
        name: this.currentUser?.name || this.currentUser?.email || 'Administrador',
        email: this.currentUser?.email || ''
      };

      localStorage.setItem('profile', JSON.stringify(this.profile));
      localStorage.removeItem('profilePartner');
      return;
    }

    const coll =
      type === 'partner'
        ? 'usuariosPartner'
        : 'usuariosClient';

    const profile = await this.pb
      .collection(coll)
      .getFirstListItem(`userId="${this.currentUser.id}"`);

    this.profile = profile;

    if (type === 'partner') {
      localStorage.setItem('profilePartner', JSON.stringify(profile));
    } else {
      localStorage.setItem('profile', JSON.stringify(profile));
    }

  } catch (e) {
    console.warn('No se pudo cargar el perfil:', e);
  }
}
  async updateUserField(userId: string, updateData: any): Promise<void> {
    await this.pb.collection('users').update(userId, updateData);
  }

  async findPartnerByUserId(userId: string): Promise<any> {
    return await this.pb
      .collection('usuariosPartner')
      .getFirstListItem(`userId="${userId}"`);
  }

  async updatePartnerField(partnerId: string, updateData: any): Promise<void> {
    await this.pb.collection('usuariosPartner').update(partnerId, updateData);
  }

  isLogin() {
    return localStorage.getItem('isLoggedin');
  }
 
  /* isAdmin() {
    const type = this.normalizeUserType(localStorage.getItem('type'));
    return type === 'admin';
  } */
  isAdmin(): boolean {
  const user: any = this.getCurrentUser?.() || this.currentUser;
  const localType = localStorage.getItem('type');

  return user?.type === 'admin' || localType === 'admin';
}

  isPartner() {
    const type = this.normalizeUserType(localStorage.getItem('type'));
    return type === 'partner';
  }

  isClient() {
    const type = this.normalizeUserType(localStorage.getItem('type'));
    return type === 'client';
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
  async initUserSession() {
    const validSession = await this.restoreSession();

    if (!validSession) {
      this.router.navigate(['/login']);
      return;
    }

    const authUser = this.pb.authStore.model;

    if (!authUser?.id) {
      this.clearLocalSession();
      this.router.navigate(['/login']);
      return;
    }

    await this.loadProfileByUserType(authUser);
  }
  async loadProfileByUserType(authUser: any): Promise<any> {
  const userId = authUser?.id;
  const type = this.normalizeUserType(authUser?.type || authUser?.userType);

  if (!userId) {
    throw new Error('No hay authUser.id');
  }

  if (!type) {
    throw new Error('El usuario no tiene type o userType');
  }

  if (type === 'admin') {
    const adminProfile = {
      id: userId,
      userId,
      type: 'admin',
      name: authUser?.name || authUser?.username || authUser?.email || 'Administrador',
      email: authUser?.email || '',
      status: authUser?.status || 'active'
    };

    this.profile = adminProfile;
    this.currentUser = {
      ...authUser,
      type: 'admin'
    };

    localStorage.setItem('type', 'admin');
    localStorage.setItem('profile', JSON.stringify(adminProfile));
    localStorage.removeItem('profilePartner');

    return adminProfile;
  }

  let collectionName = '';

  if (type === 'client') {
    collectionName = 'usuariosClient';
  }

  if (type === 'partner') {
    collectionName = 'usuariosPartner';
  }

  const profile = await this.pb
    .collection(collectionName)
    .getFirstListItem(`userId="${userId}"`);

  if (type === 'client') {
    localStorage.setItem('profile', JSON.stringify(profile));
    localStorage.removeItem('profilePartner');
  }

  if (type === 'partner') {
    localStorage.setItem('profilePartner', JSON.stringify(profile));
    localStorage.removeItem('profile');
  }

  return profile;
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
      username: this.makeSafeUsername(name),
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
  makeSafeUsername(value: string): string {
    const base = (value || 'usuario')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30);

    return `${base || 'usuario'}_${Date.now().toString().slice(-6)}`;
  }
  loginUser(email: string, password: string): Observable<any> {
    return from(this.pb.collection('users').authWithPassword(email, password)).pipe(
      map((authData) => {
        const pbUser = authData.record || this.pb.authStore.record;
        let userTypeRaw = pbUser['type'];
        let userType = Array.isArray(userTypeRaw) ? userTypeRaw[0] : userTypeRaw;



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

        this.currentUser = user;

        localStorage.setItem('accessToken', token);
        localStorage.setItem('userId', user.id);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('record', JSON.stringify(authData.record));
        localStorage.setItem('type', this.normalizeUserType(user.type) || '');
        localStorage.setItem('isLoggedin', 'true');

        this.currentUserSubject.next(user);
        // Guarda en localStorage
        /* this.setUser(user);
        localStorage.setItem('accessToken', token);
        localStorage.setItem('userId', user.id);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('type', JSON.stringify(user.type)); */

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
    await this.pushService.deactivateCurrentDeviceBeforeLogout();
    await this.pb.realtime.unsubscribe();
    this.pb.authStore.clear();
    /* localStorage.clear(); */
    this.clearLocalSession();
    this.global.setRoute('login');
    return of(null);
  }
  normalizeUserType(type: any): 'admin' | 'partner' | 'client' | null {
    if (Array.isArray(type)) return type[0] || null;

    if (typeof type === 'string') {
      try {
        const parsed = JSON.parse(type);
        if (Array.isArray(parsed)) return parsed[0] || null;
        return parsed;
      } catch {
        return type as any;
      }
    }

    return null;
  }
  setToken(token: string, model: RecordModel): void {
    this.pb.authStore.save(token, model);
  }

  async permision() {
    await new Promise(resolve => {
      const check = () => this.pb.authStore.isValid ? resolve(true) : setTimeout(check, 50);
      check();
    });

    if (!this.isAuthenticated()) {
      this.router.navigate(['home']);
      return;
    }

    const user = this.getCurrentUser();

    if (!user?.type) {
      this.router.navigate(['home']);
      return;
    }

    switch (user.type) {
      case 'admin':
        this.router.navigate(['dashboard']);
        break;
      case 'partner':
        this.router.navigate(['home-local']);
        break;
      case 'client':
        this.router.navigate(['explorer']);
        break;
      default:
        this.router.navigate(['login']);
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

  async restoreSession(): Promise<boolean> {
    const token = localStorage.getItem('accessToken');
    const userString = localStorage.getItem('user');

    if (!token || !userString) {
      this.clearLocalSession();
      return false;
    }

    try {
      const user = JSON.parse(userString);

      this.pb.authStore.save(token, user);

      await this.pb.collection('users').authRefresh();

      const refreshedUser = this.pb.authStore.record || this.pb.authStore.model;

      if (!refreshedUser?.id) {
        this.clearLocalSession();
        return false;
      }
      const cleanType = this.normalizeUserType(refreshedUser['type']);

      refreshedUser['type'] = cleanType;

      this.currentUser = refreshedUser;
      this.currentUserSubject.next(refreshedUser);

      localStorage.setItem('accessToken', this.pb.authStore.token);
      localStorage.setItem('user', JSON.stringify(refreshedUser));
      localStorage.setItem('userId', refreshedUser.id);
      localStorage.setItem('type', cleanType || '');
      localStorage.setItem('isLoggedin', 'true');

      await this.loadProfileByUserType(refreshedUser);

      return true;
    } catch (error) {
      console.error('Sesión inválida o expirada:', error);
      /*       this.clearLocalSession();
       */
      console.warn('No limpio sesión durante diagnóstico');
      return false;
    }
  }
  clearLocalSession(): void {
    this.pb.authStore.clear();

    localStorage.removeItem('pocketbase_auth');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('record');
    localStorage.removeItem('userId');
    localStorage.removeItem('type');
    localStorage.removeItem('userType');
    localStorage.removeItem('isLoggedin');
    localStorage.removeItem('profile');
    localStorage.removeItem('profilePartner');
    localStorage.removeItem('pendingGoogleUser');
    localStorage.removeItem('pendingGoogleToken');

    sessionStorage.removeItem('pendingGoogleUser');
    sessionStorage.removeItem('pendingGoogleToken');
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
  async processGoogleAuthResult(
    authData: any,
    source: 'login' | 'register',
    selectedType?: 'client' | 'partner'
  ): Promise<GoogleAuthResult> {
    console.log('[OAuth] Procesando resultado de Google');
    const record = authData.record;
    const token = authData.token;
    const meta: any = authData.meta || {};

    if (!token || !record?.id || !record?.email) {
      throw new Error('Google no devolvió una cuenta válida con correo electrónico.');
    }

    let type = this.normalizeUserType(record['type']);
    if (type && type !== 'admin' && type !== 'partner' && type !== 'client') {
      throw new Error('La cuenta de Google tiene un tipo de usuario no válido.');
    }

    if (!type) {
      if (!selectedType) {
        throw new Error('Esta cuenta todavía no tiene tipo de perfil. Inicia el registro como cliente o partner.');
      }
      type = selectedType;
      console.log('[OAuth] Asignando tipo autorizado:', { type });
      const updatedRecord = await this.pb.collection('users').update(record.id, { type });
      authData.record = updatedRecord;
      this.pb.authStore.save(token, updatedRecord);
    } else if (selectedType && type !== selectedType) {
      console.info('[OAuth] Se conserva el tipo existente de la cuenta:', { type });
    }

    const googleEmail =
      meta?.email ||
      meta?.rawUser?.email ||
      record['email'];

    const googleName =
      meta?.name ||
      meta?.rawUser?.name ||
      record['name'] ||
      record['username'] ||
      googleEmail.split('@')[0] ||
      'Usuario';

    const authUser = this.pb.authStore.record;
    if (!this.pb.authStore.isValid || !authUser?.id) {
      throw new Error('PocketBase no conservó una sesión válida después de Google.');
    }

    const cleanUser = {
      ...authUser,
      id: authUser.id,
      email: googleEmail,
      name: googleName,
      username: record['username'] || '',
      avatarUrl:
        meta?.avatarUrl ||
        record['avatarUrl'] ||
        '',
      type
    };

    this.global.pb.authStore.save(token, authUser);

    const profile = type === 'admin'
      ? null
      : await this.findGoogleProfile(authUser.id, type);

    const finalUser = {
      ...authUser,
      email: googleEmail,
      name: googleName,
      type
    };

    this.persistGoogleSession(token, authUser, type, profile);

    const needsRegister = type !== 'admin' && !this.isProfileComplete(profile);
    if (needsRegister) {
      sessionStorage.setItem(PENDING_GOOGLE_REGISTRATION_TYPE, type);
    }

    return {
      needsRegister,
      user: cleanUser,
      profile,
      type,
      selectedType: type === 'client' || type === 'partner' ? type : undefined
    };
  }

  async findGoogleProfile(userId: string, type: 'client' | 'partner'): Promise<any | null> {
    const collection = type === 'partner' ? 'usuariosPartner' : 'usuariosClient';
    const filter = this.pb.filter('userId = {:userId}', { userId });

    try {
      console.log('[OAuth] Buscando perfil relacionado:', {
        collection,
        userId: this.anonymizeId(userId)
      });
      const existingProfile = await this.pb.collection(collection).getFirstListItem(filter);
      console.log('[OAuth] Perfil existente recuperado:', { collection });
      return existingProfile;
    } catch (error: any) {
      if (error?.status === 404) return null;
      this.logProfileError('buscar', collection, error, ['userId']);
      throw error;
    }
  }

  isProfileComplete(profile: any): boolean {
    return Boolean(profile?.id) && profile?.profileComplete !== false;
  }

  private logProfileError(
    operation: string,
    collection: string,
    error: any,
    fields: string[]
  ): void {
    console.error('[OAuth] Error de perfil:', {
      operation,
      collection,
      status: error?.status || 0,
      message: error?.response?.message || error?.message || 'Error desconocido',
      data: error?.response?.data || {},
      fields
    });
  }

  async getRegistrationStatus(user: any): Promise<{
    completed: boolean;
    type: 'client' | 'partner' | 'admin' | null;
    profile: any | null;
  }> {
    const type = user?.type || this.pb.authStore.record?.['type'];

    if (type === 'admin') {
      return { completed: true, type: 'admin', profile: null };
    }

    if (!type) {
      return { completed: false, type: null, profile: null };
    }

    const collection = type === 'partner'
      ? 'usuariosPartner'
      : 'usuariosClient';

    try {
      console.log('[OAuth] Buscando perfil:', {
        type,
        userId: this.anonymizeId(user?.id)
      });
      const profile = await this.pb
        .collection(collection)
        .getFirstListItem(`userId="${user.id}"`);

      return {
        completed: this.isProfileComplete(profile),
        type,
        profile
      };

    } catch (error: any) {
      if (error?.status !== 404) {
        console.error('No se pudo consultar el estado del perfil Google:', error);
        throw error;
      }
      return {
        completed: false,
        type,
        profile: null
      };
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
