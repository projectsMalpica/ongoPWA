
import { Injectable, OnDestroy } from '@angular/core';
import PocketBase from 'pocketbase';
import { BehaviorSubject, Observable } from 'rxjs';

export interface PlanningPartner {
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
export class RealtimePlanningPartnerService implements OnDestroy {
  private pb: PocketBase;
  private planningPartnerSubject = new BehaviorSubject<PlanningPartner[]>([]);

  // Observable for components to subscribe to
  public planningPartner$: Observable<PlanningPartner[]> =
    this.planningPartnerSubject.asObservable();

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
      this.pb.collection('planningPartners').subscribe('*', (e : any) => {
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
      const records = await this.pb.collection('planningPartners').getFullList<PlanningPartner>(200, {
        sort: '-created', // Sort by creation date
      });

      // Ensures each record conforms to Partner structure
      const planningPartner = records.map((record: any) => ({
        ...record,
        images: Array.isArray(record.images) ? record.images : [],
        items: Array.isArray(record.items) ? record.items : [],
      })) as PlanningPartner[];

      this.planningPartnerSubject.next(planningPartner);
    } catch (error) {
      console.error('Error updating planningPartner list:', error);
    }
  }

  ngOnDestroy() {
    // Unsubscribe when the service is destroyed
    this.pb.collection('planningPartners').unsubscribe('*');
  }
}
