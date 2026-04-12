import { Injectable } from '@angular/core';
import PocketBase from 'pocketbase';
import { BehaviorSubject } from 'rxjs';
import { UserInterface } from '../interface/user-interface ';

@Injectable({
  providedIn: 'root',
})
export class GlobalService {
  activeRoute: string = '';
  pb = new PocketBase('https://db.ongomatch.com:8090');

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

  private clientesSubscribed = false;
  private partnersSubscribed = false;
  private promosSubscribed = false;
  private planningPartnersSubscribed = false;
  private planningClientsSubscribed = false;

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

  async initialize() {
    await this.loadProfile();
    await this.initRealtimeData();
  }

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
        this.profileDataPartner = userData;
      } else {
        userData = await this.pb
          .collection('usuariosClient')
          .getFirstListItem(`userId="${user.id}"`);
        this.profileData = userData;
      }

      this.setUser(userData as unknown as UserInterface);
      localStorage.setItem('profile', JSON.stringify(userData));
    } catch (error: any) {
      if (error && error.status === 404) {
        console.warn('No se encontró el perfil del usuario en la colección correspondiente.');
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


  public async initClientesRealtime() {
    try {
      const result = await this.pb.collection('usuariosClient').getFullList();
      console.log('✅ usuariosClient cargados:', result);

      const parsed = result.map((c: any) => ({
        ...c,
        avatar: c.avatar || null
      }));

      this.clientesSubject.next(parsed);

      if (!this.clientesSubscribed) {
        this.subscribeRealtime('usuariosClient', this.clientesSubject, false);
        this.clientesSubscribed = true;
      }
    } catch (error) {
      console.error('❌ Error en initClientesRealtime:', error);
      this.clientesSubject.next([]);
    }
  }

  public async initPartnersRealtime() {
    try {
      const result = await this.pb.collection('usuariosPartner').getFullList();

      const parsed = result.map((p: any) => ({
        ...p,
        avatar: p.avatar ? this.pb.getFileUrl(p, p.avatar) : null
      }));

      this.partnersSubject.next(parsed);

      if (!this.partnersSubscribed) {
        this.subscribeRealtime('usuariosPartner', this.partnersSubject, true);
        this.partnersSubscribed = true;
      }
    } catch (error) {
      console.error('❌ Error en initPartnersRealtime:', error);
      this.partnersSubject.next([]);
    }
  }

  public async initPromosRealtime() {
    try {
      const result = await this.pb.collection('promos').getFullList();
      this.promosSubject.next(result);

      if (!this.promosSubscribed) {
        this.subscribeRealtime('promos', this.promosSubject);
        this.promosSubscribed = true;
      }
    } catch (error) {
      console.error('❌ Error en initPromosRealtime:', error);
      this.promosSubject.next([]);
    }
  }

  public async initPlanningPartnersRealtime() {
    try {
      const result = await this.pb.collection('planningPartners').getFullList();
      this.planningPartnersSubject.next(result);

      if (!this.planningPartnersSubscribed) {
        this.subscribeRealtime('planningPartners', this.planningPartnersSubject);
        this.planningPartnersSubscribed = true;
      }
    } catch (error) {
      console.error('❌ Error en initPlanningPartnersRealtime:', error);
      this.planningPartnersSubject.next([]);
    }
  }

  public async initPlanningClientsRealtime() {
    try {
      const result = await this.pb.collection('planningClients').getFullList();
      this.planningClientsSubject.next(result);

      if (!this.planningClientsSubscribed) {
        this.subscribeRealtime('planningClients', this.planningClientsSubject);
        this.planningClientsSubscribed = true;
      }
    } catch (error) {
      console.error('❌ Error en initPlanningClientsRealtime:', error);
      this.planningClientsSubject.next([]);
    }
  }

  public subscribeRealtime(
    collection: string,
    subject: BehaviorSubject<any[]>,
    buildFileUrl = false
  ) {
    this.pb.collection(collection).subscribe('*', (e: any) => {
      let record = e.record;

      if (buildFileUrl && record?.avatar) {
        record = {
          ...record,
          avatar: this.pb.getFileUrl(record, record.avatar)
        };
      }

      let current = subject.getValue();

      if (e.action === 'create') {
        current = [...current, record];
      } else if (e.action === 'update') {
        current = current.map((c: any) => (c.id === record.id ? record : c));
      } else if (e.action === 'delete') {
        current = current.filter((c: any) => c.id !== record.id);
      }

      subject.next(current);
    });
  }

  public clearUrlHash() {
    history.replaceState(null, '', window.location.pathname);
  }
  public getClientesSnapshot(): any[] {
  return this.clientesSubject.getValue();
}
}