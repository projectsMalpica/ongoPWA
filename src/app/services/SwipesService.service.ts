import { Injectable } from '@angular/core';
import { GlobalService } from './global.service';
import { AuthPocketbaseService } from './authPocketbase.service';

@Injectable({
  providedIn: 'root'
})
export class SwipesService {
  constructor(
    private global: GlobalService,
    private auth: AuthPocketbaseService
  ) {}

 async registerSwipe(clientId: string, action: 'like' | 'dislike' | 'superlike') {
  const pb = this.global.pb;
  const currentUser = pb.authStore.model;

  if (!currentUser?.id) {
    throw new Error('No hay usuario autenticado');
  }

  if (!clientId) {
    throw new Error('No hay clientId');
  }

  let userId = this.global.profileData?.id;

if (!userId) {
  const profile = await pb.collection('usuariosClient').getFirstListItem(
    `userId="${currentUser.id}"`
  );

  userId = profile.id;
  this.global.profileData = profile;
}

  console.log('Creando swipe:', {
    action,
    userId,
    clientId,
    currentUserId: currentUser.id,
    currentUserCollection: currentUser.collectionName,
    profileData: this.global.profileData
  });

  try {
    const swipe = await pb.collection('swipes').create({
      action,
      userId,
      clientId
    });

    return {
      swipe,
      match: null,
      notification: null
    };

  } catch (error: any) {
    console.error('Error completo PocketBase:', error);
    console.error('Detalles PocketBase:', error?.data);
    console.error('Data enviada:', {
      action,
      userId,
      clientId
    });

    throw error;
  }
}
}