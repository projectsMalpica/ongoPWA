
import { Injectable, OnDestroy } from '@angular/core';
import PocketBase from 'pocketbase';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Service {
  name: string;
  images?: string[]; // JSON array
  status?: string;
}

export interface Partner {
  id: string;
  vuename: string;
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
export class RealtimePartnerService implements OnDestroy {
  private pb: PocketBase;
  private partnersSubject = new BehaviorSubject<Partner[]>([]);

  // Observable for components to subscribe to
  public partners$: Observable<Partner[]> =
    this.partnersSubject.asObservable();

  constructor() {
    this.pb = new PocketBase('https://db.ongomatch.com:8090');
    this.subscribeToPartners();
  }

  private async subscribeToPartners() {
    try {
      // (Optional) Authentication
      await this.pb
        .collection('users')
        .authWithPassword('admin@email.com', 'admin1234');

      // Subscribe to changes in any record of the 'professionals' collection
      this.pb.collection('usuariosPartner').subscribe('*', (e : any) => {
        this.handleRealtimeEvent(e);
      });

      // Initialize the list of professionals
      this.updatePartnerList();
    } catch (error) {
      console.error('Error during subscription:', error);
    }
  }

  private handleRealtimeEvent(event: any) {
    console.log(`Event Action: ${event.action}`);
    console.log(`Event Record:`, event.record);

    // Update the list of professionals
    this.updatePartnerList();
  }

  private async updatePartnerList() {
    try {
      // Get the updated list of professionals
      const records = await this.pb.collection('usuariosPartner').getFullList<Partner>(200, {
        sort: '-created', // Sort by creation date
      });

      // Ensures each record conforms to Partner structure
      const partners = records.map((record: any) => ({
        ...record,
        images: Array.isArray(record.images) ? record.images : [],
        services: Array.isArray(record.services) ? record.services : [],
        avatar: record.avatar,
      })) as Partner[];

      this.partnersSubject.next(partners);
    } catch (error) {
      console.error('Error updating partners list:', error);
    }
  }

  ngOnDestroy() {
    // Unsubscribe when the service is destroyed
    this.pb.collection('usuariosPartner').unsubscribe('*');
  }
}
