
import { Injectable, OnDestroy } from '@angular/core';
import PocketBase from 'pocketbase';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Service {
  name: string;
  images?: string[]; // JSON array
  status?: string;
}

export interface Promo {
  id: string;
  name: string;
  gender: string;
  images?: string[]; // JSON array
  services?: Service[];
  IdMember?: string;
  status?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RealtimePromosService implements OnDestroy {
  private pb: PocketBase;
  private promosSubject = new BehaviorSubject<Promo[]>([]);

  // Observable for components to subscribe to
  public promos$: Observable<Promo[]> =
    this.promosSubject.asObservable();

  constructor() {
    this.pb = new PocketBase('https://db.ongomatch.com:8090');
    this.subscribeToPromos();
  }

  private async subscribeToPromos() {
    try {
      // (Optional) Authentication
      await this.pb
        .collection('users')
        .authWithPassword('admin@email.com', 'admin1234');

      // Subscribe to changes in any record of the 'professionals' collection
      this.pb.collection('promos').subscribe('*', (e : any) => {
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
      const records = await this.pb.collection('promos').getFullList<Promo>(200, {
        sort: '-created', // Sort by creation date
      });

      // Ensures each record conforms to Partner structure
      const promos = records.map((record: any) => ({
        ...record,
        images: Array.isArray(record.images) ? record.images : [],
        services: Array.isArray(record.services) ? record.services : [],
      })) as Promo[];

      this.promosSubject.next(promos);
    } catch (error) {
      console.error('Error updating promos list:', error);
    }
  }

  ngOnDestroy() {
    // Unsubscribe when the service is destroyed
    this.pb.collection('promos').unsubscribe('*');
  }
}
