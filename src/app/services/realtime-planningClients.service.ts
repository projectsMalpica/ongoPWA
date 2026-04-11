
import { Injectable, OnDestroy } from '@angular/core';
import PocketBase from 'pocketbase';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PlanningClient {
    name: string;
    images?: string[]; // JSON array
    status?: string;
    description?: string;
    items?: string[];
    priceCOP?: number;
    priceUSD?: number;
}


@Injectable({
  providedIn: 'root',
})
export class RealtimePlanningClientsService implements OnDestroy {
  private pb: PocketBase;
  private planningClientsSubject = new BehaviorSubject<PlanningClient[]>([]);

  // Observable for components to subscribe to
  public planningClients$: Observable<PlanningClient[]> =
    this.planningClientsSubject.asObservable();

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
      this.pb.collection('planningClients').subscribe('*', (e : any) => {
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
      const records = await this.pb.collection('planningClients').getFullList<PlanningClient>(200, {
        sort: '-created', // Sort by creation date
      });

      // Ensures each record conforms to Partner structure
      const planningClients = records.map((record: any) => ({
        ...record,
        images: Array.isArray(record.images) ? record.images : [],
        items: Array.isArray(record.items) ? record.items : [],
      })) as PlanningClient[];

      this.planningClientsSubject.next(planningClients);
    } catch (error) {
      console.error('Error updating planningClients list:', error);
    }
  }

  ngOnDestroy() {
    // Unsubscribe when the service is destroyed
    this.pb.collection('planningClients').unsubscribe('*');
  }
}
