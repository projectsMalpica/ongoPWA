import { Injectable, OnDestroy } from '@angular/core';
import PocketBase from 'pocketbase';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Service {
  name: string;
  images?: string[]; // JSON array
  status?: string;
}

export interface Cliente {
  id: string;
  name: string;
  gender: string;
  images?: string[]; // JSON array
  services?: Service[];
  IdMember?: string;
  status?: string;
  avatar?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RealtimeClientesService implements OnDestroy {
  private pb: PocketBase;
  private clientesSubject = new BehaviorSubject<Cliente[]>([]);

  // Observable for components to subscribe to
  public clientes$: Observable<Cliente[]> =
    this.clientesSubject.asObservable();

  constructor() {
    this.pb = new PocketBase('https://db.ongomatch.com:8090');
    this.subscribeToClientes();
  }

  private async subscribeToClientes() {
    try {
      // (Optional) Authentication
      await this.pb
        .collection('users')
        .authWithPassword('admin@email.com', 'admin1234');

      // Subscribe to changes in any record of the 'professionals' collection
      this.pb.collection('usuariosClient').subscribe('*', (e : any) => {
        this.handleRealtimeEvent(e);
      });

      // Initialize the list of professionals
      this.updateClientesList();
    } catch (error) {
      console.error('Error during subscription:', error);
    }
  }

  private handleRealtimeEvent(event: any) {
    console.log(`Event Action: ${event.action}`);
    console.log(`Event Record:`, event.record);

    // Update the list of professionals
    this.updateClientesList();
  }

  private async updateClientesList() {
    try {
      // Get the updated list of professionals
      const records = await this.pb.collection('usuariosClient').getFullList<Cliente>(200, {
        sort: '-created', // Sort by creation date
      });

      // Ensures each record conforms to Cliente structure
      const clientes = records.map((record: any) => ({
        ...record,
        images: Array.isArray(record.images) ? record.images : [],
        services: Array.isArray(record.services) ? record.services : [],
        avatar: record.avatar,
      })) as Cliente[];

      this.clientesSubject.next(clientes);
    } catch (error) {
      console.error('Error updating clientes list:', error);
    }
  }

  ngOnDestroy() {
    // Unsubscribe when the service is destroyed
    this.pb.collection('usuariosClient').unsubscribe('*');
  }
}
