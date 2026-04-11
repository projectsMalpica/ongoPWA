import { Injectable } from '@angular/core';
import PocketBase from 'pocketbase';
import { BehaviorSubject } from 'rxjs';
import { UserInterface } from '../interface/user-interface ';

@Injectable({
  providedIn: 'root',
})
export class GlobalService {
  /* activeRoute: string = 'register'; */
  activeRoute: string = ''; // Sin valor inicial
  pb = new PocketBase('https://db.ongomatch.com:8090');
  
  // Observables de datos
  private clientesSubject = new BehaviorSubject<any[]>([]);
  clientes$ = this.clientesSubject.asObservable();
  private partnersSubject = new BehaviorSubject<any[]>([]);
  partners$ = this.partnersSubject.asObservable();
  private promosSubject = new BehaviorSubject<any[]>([]);
  promos$ = this.promosSubject.asObservable();
  private planningPartnersSubject = new BehaviorSubject<any[]>([]);
  planningPartners$ = this.planningPartnersSubject.asObservable();
  private planningClientsSubject = new BehaviorSubject<any[]>([]);
  planningClients$ = this.planningClientsSubject.asObservable();

  // Variables de navegación y selección
  selectedPartner: any = null;
  selectedClient: any = null;
  chatReceiverId: string = '';
  profileData: any = {};
  profileDataPartner: any = {};
  previewCard: any = null;
  promosByPartner: any[] = [];
  selectedServicesPartner: any[] = [];
  allServices: { value: string; label: string }[] = [];
  
  currentUser: any;
  constructor() {
    this.clearUrlHash();
  }

  /**
   * ✅ Llama este método DESPUÉS del login
   */
  async initialize() {
    await this.loadProfile();
    await this.initRealtimeData();
  }

  /**
   * ✅ Carga datos realtime SOLO si hay sesión válida
   */
  private async initRealtimeData() {
    if (!this.pb.authStore.isValid) {
      console.warn('No autenticado, omitiendo realtime');
      return;
    }

    await this.initClientesRealtime();
    await this.initPartnersRealtime();
    await this.initPromosRealtime();
    await this.initPlanningPartnersRealtime();
    await this.initPlanningClientsRealtime();
  }

  setRoute(route: string) {
    this.activeRoute = route;
  }
  
  getRoute(): string {
    return this.activeRoute;
  }

  previewPartner(partner: any) {
    this.selectedPartner = partner;
    this.activeRoute = 'detail-profile-local';
  }

  previewClient(client: any) {
    this.selectedClient = client;
    this.activeRoute = 'detail-profile';
  }

  /**
   * ✅ Carga el perfil y lo guarda en memoria y localStorage
   */

      async loadProfile() {
      if (!this.pb.authStore.isValid) {
        console.warn('No autenticado, omitiendo realtime');
        return;
      }
      const user = this.getCurrentUser();
      if (!user?.id) {
        console.error('No hay usuario autenticado');
        return;
      }
    
      try {
        let userData;
        if (user.type === 'partner') {
          userData = await this.pb
            .collection('usuariosPartner')
            .getFirstListItem(`userId="${user.id}"`);
        } else {
          userData = await this.pb
            .collection('usuariosClient')
            .getFirstListItem(`userId="${user.id}"`);
        }
        this.profileData = userData;
        this.setUser(userData as unknown as UserInterface);
        localStorage.setItem('profile', JSON.stringify(userData));
      } catch (error: any) {
        if (error && error.status === 404) {
          console.warn('No se encontró el perfil del usuario en la colección correspondiente.');
          // Aquí podrías redirigir a completar perfil o mostrar un aviso al usuario
        } else {
          console.error('Error al cargar el perfil:', error);
        }
      }
    }  
    setUser(user: UserInterface) {
    this.currentUser = user;
  }

  getCurrentUser() {
    if (!this.currentUser) {
      const userString = localStorage.getItem('user');
      if (userString) {
        this.currentUser = JSON.parse(userString);
      }
    }
    return this.currentUser;
  }

  // ========================== //
  // Realtime Collections       //
  // ========================== //

  public async initClientesRealtime() {
    const result = await this.pb.collection('usuariosClient').getFullList();
    this.clientesSubject.next(result);
    this.subscribeRealtime('usuariosClient', this.clientesSubject);
  }

  public async initPartnersRealtime() {
    const result = await this.pb.collection('usuariosPartner').getFullList();
    this.partnersSubject.next(result);
    this.subscribeRealtime('usuariosPartner', this.partnersSubject);

    const parsed = result.map(p => ({
      ...p,
      avatar: this.pb.getFileUrl(p, p['avatar'])
    }));
    this.partnersSubject.next(parsed);
  }

  public async initPromosRealtime() {
    const result = await this.pb.collection('promos').getFullList();
    this.promosSubject.next(result);
    this.subscribeRealtime('promos', this.promosSubject);
  }
  public async initPlanningPartnersRealtime() {
    const result = await this.pb.collection('planningPartners').getFullList();
    this.planningPartnersSubject.next(result);
    this.subscribeRealtime('planningPartners', this.planningPartnersSubject);
  }

  public async initPlanningClientsRealtime() {
    const result = await this.pb.collection('planningClients').getFullList();
    this.planningClientsSubject.next(result);
    this.subscribeRealtime('planningClients', this.planningClientsSubject);
  }

  /**
   * ✅ Simplificación del patrón de actualización realtime
   */
  public subscribeRealtime(collection: string, subject: BehaviorSubject<any[]>) {
    this.pb.collection(collection).subscribe('*', (e: any) => {
      let current = subject.getValue();
      if (e.action === 'create') {
        current = [...current, e.record];
      } else if (e.action === 'update') {
        current = current.map((c: any) => (c.id === e.record.id ? e.record : c));
      } else if (e.action === 'delete') {
        current = current.filter((c: any) => c.id !== e.record.id);
      }
      subject.next(current);
    });
  }
  public clearUrlHash() {
    history.replaceState(null, '', window.location.pathname);  }
  
}

