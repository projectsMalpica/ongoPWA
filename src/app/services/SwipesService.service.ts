// services/swipes.service.ts
import { Injectable } from '@angular/core';
import PocketBase from 'pocketbase';
import { GlobalService } from './global.service';
import { AuthPocketbaseService } from './authPocketbase.service';

@Injectable({
  providedIn: 'root',
})
export class SwipesService {
  pb: PocketBase;

  constructor(
    public global: GlobalService,
    public authPocketbaseService: AuthPocketbaseService
  ) {
    this.pb = global.pb;
  }

  async registerSwipe(clientId: string, action: 'like' | 'dislike' | 'superlike') {
    return this.pb.collection('swipes').create({
      userId: this.authPocketbaseService.getCurrentUser()?.id,
      clientId,
      action,
    });
  }
  
}
