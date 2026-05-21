import { Component, Input, OnInit } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { CommonModule } from '@angular/common';
import PocketBase from 'pocketbase';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { SwipesService } from '../../services/SwipesService.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  @Input() clientes: any[] = [];
  currentIndex = 0;
  startX = 0;
  deltaX = 0;
  deltaY = 0;
  startY = 0;
  swipeHistory: { clientId: string; action: 'like' | 'dislike' | 'superlike' }[] = [];
  transform = '';
  isDragging = false;
  pb: PocketBase;
  touchStartTime = 0;
  hasDragged = false;
  loadingClients = true;
  threshold = 140;
  superlikeThreshold = -180;
  minDragDistance = 35;
  lastTapTime = 0;
  tapDelay = 300;
  currentPhotoIndex = 0;
  showMatchOverlay = false;
  matchedClient: any = null;
  matchDistanceText = '';
  constructor(
    public global: GlobalService,
    public authPocketbaseService: AuthPocketbaseService,
    public swipesService: SwipesService,
    private router: Router
  ) {
    this.pb = this.global.pb;
  }
  getReceiverUserId(cliente: any): string {
    return cliente?.userId || cliente?.id || '';
  }
  async ngOnInit(): Promise<void> {
    this.loadingClients = true;

    this.global.clientes$.subscribe((clientes: any[]) => {

  const myProfileId = this.global.profileData?.id;

  this.clientes = (clientes || []).filter(
    c => c.id !== myProfileId
  );

  this.loadingClients = false;

  if (this.currentIndex >= this.clientes.length) {
    this.currentIndex = 0;
  }
});
    
    await this.updateClientLocation();
    try {
      if (!this.global.getClientesSnapshot().length) {
        await this.global.initClientesRealtime();
      }
    } catch (error) {
      console.error('Error cargando clientes en home:', error);
      this.loadingClients = false;
    }
  }

  startDrag(event: MouseEvent | TouchEvent) {
    this.hasDragged = false;
    this.isDragging = true;
    const pos = this.getXY(event);
    this.startX = pos.x;
    this.startY = pos.y;
  }

  onDrag(event: MouseEvent | TouchEvent) {
    if (!this.isDragging) return;

    const pos = this.getXY(event);
    this.deltaX = pos.x - this.startX;
    this.deltaY = pos.y - this.startY;

    const movedEnough =
      Math.abs(this.deltaX) > this.minDragDistance ||
      Math.abs(this.deltaY) > this.minDragDistance;

    this.hasDragged = movedEnough;

    if (!movedEnough) return;

    this.transform = `translate(${this.deltaX}px, ${this.deltaY}px) rotate(${this.deltaX / 20}deg)`;
  }

  async endDrag(event: MouseEvent | TouchEvent, cliente: any) {
    if (!this.isDragging) return;

    this.isDragging = false;

    const movedEnough =
      Math.abs(this.deltaX) > this.minDragDistance ||
      Math.abs(this.deltaY) > this.minDragDistance;

    if (!movedEnough) {
      this.resetCard();
      return;
    }

    if (this.deltaY < this.superlikeThreshold) {
      await this.superLike(cliente);
      return;
    }

    if (this.deltaX > this.threshold) {
      await this.like(cliente);
      return;
    }

    if (this.deltaX < -this.threshold) {
      await this.dislike(cliente);
      return;
    }

    this.resetCard();
  }
  async handleCardTap(cliente: any) {
    if (!cliente?.id) return;

    // Si venía de un swipe, no abrir chat
    if (this.hasDragged) return;

    const now = Date.now();
    const diff = now - this.lastTapTime;

    if (diff < this.tapDelay) {
      await this.abrirChat(cliente);
      this.lastTapTime = 0;
      return;
    }

    this.lastTapTime = now;
  }
  resetCard() {
    this.transform = '';
    this.deltaX = 0;
    this.deltaY = 0;
  }

  async like(cliente: any) {
    await this.handleSwipeAction(cliente, 'like');
  }

  async dislike(cliente: any) {
    await this.handleSwipeAction(cliente, 'dislike');
  }

  async superLike(cliente: any) {
    await this.handleSwipeAction(cliente, 'superlike');
  }
 async handleSwipeAction(
  cliente: any,
  action: 'like' | 'dislike' | 'superlike'
) {

  if (cliente.id === this.global.profileData?.id) {
    console.warn('No puedes interactuar con tu propio perfil');
    return;
  }

  if (!cliente?.id) return;

  try {

    await this.registerSwipe(cliente, action);

    if (action === 'like') {
      this.transform = 'translateX(420px) rotate(18deg)';
    }

    if (action === 'dislike') {
      this.transform = 'translateX(-420px) rotate(-18deg)';
    }

    if (action === 'superlike') {
      this.transform = 'translateY(-520px) rotate(0deg)';
    }

    setTimeout(() => {
      this.nextCard();
    }, 250);

  } catch (error) {
    console.error('Error registrando swipe:', error);
    this.resetCard();
    alert('No se pudo registrar la interacción');
  }
}
getDistanceLabel(cliente: any): string {
  return this.getClientDistanceText(cliente);
}
getPresenceLabel(cliente: any): string {
  if (!cliente?.locationUpdatedAt && !cliente?.updated) {
    return 'Disponible para conectar';
  }

  const dateValue = cliente.locationUpdatedAt || cliente.updated;
  const lastSeen = new Date(dateValue).getTime();
  const now = Date.now();

  const diffMinutes = Math.floor((now - lastSeen) / 1000 / 60);

  if (diffMinutes <= 3) {
    return '🔥 Acaba de llegar';
  }

  if (diffMinutes <= 10) {
    return '🟢 Activo ahora';
  }

  if (diffMinutes <= 30) {
    return '⚡ Cerca recientemente';
  }

  return '🌙 Disponible para conectar';
}

getPresenceClass(cliente: any): string {
  const label = this.getPresenceLabel(cliente);

  if (label.includes('Acaba')) return 'arrived';
  if (label.includes('Activo')) return 'active';
  if (label.includes('Cerca')) return 'recent';

  return 'available';
}

  openProfile(event: Event, cliente: any) {
    event.stopPropagation();

    if (!cliente?.id) return;

    this.global.selectedClient = cliente;

    this.router.navigate(['/detailprofile', cliente.id]);
  }
  get likeOpacity() {
    return Math.max(0, this.deltaX / 120);
  }

  get rejectOpacity() {
    return Math.max(0, -this.deltaX / 120);
  }
  async openChat(cliente: any) {
    if (!cliente) return;

    const receiverUserId = this.getReceiverUserId(cliente);

    this.global.selectedClient = { ...cliente };
    this.global.chatReceiverId = receiverUserId;

    await this.router.navigate(['/chat-detail', receiverUserId]);
  }

async registerSwipe(cliente: any, action: 'like' | 'dislike' | 'superlike') {
  const targetProfileId = cliente.id;

  const result = await this.swipesService.registerSwipe(targetProfileId, action);

  console.log('RESULTADO SWIPE:', result);

  const isMatch =
  result?.match ||
  result?.matched === true ||
  result?.isMatch === true;

if (isMatch) {
  this.showConnectionOverlay(cliente);
} else if (action === 'superlike') {
  this.showSuperLikeNotification(cliente);

  }

  this.swipeHistory.push({ clientId: cliente.id, action });
}

showConnectionOverlay(cliente: any) {
  console.log('MOSTRANDO OVERLAY MATCH:', cliente);

  this.matchedClient = cliente;
  this.matchDistanceText = this.getClientDistanceText(cliente);
  this.showMatchOverlay = true;

  navigator.vibrate?.([60, 40, 90, 40, 140]);

  setTimeout(() => {
    this.showMatchOverlay = false;
  }, 5200);
}
closeMatchOverlay() {
  this.showMatchOverlay = false;
}

openMatchedChat() {
  if (!this.matchedClient) return;

  const receiverUserId = this.getReceiverUserId(this.matchedClient);

  this.showMatchOverlay = false;

  this.global.selectedClient = { ...this.matchedClient };
  this.global.chatReceiverId = receiverUserId;

  this.router.navigate(['/chat-detail', receiverUserId]);
}

getClientDistanceText(cliente: any): string {
  const myProfile = this.authPocketbaseService.getCurrentProfile();

  const myLat = Number(myProfile?.lat);
  const myLng = Number(myProfile?.lng);
  const clientLat = Number(cliente?.lat);
  const clientLng = Number(cliente?.lng);

  if (!myLat || !myLng || !clientLat || !clientLng) {
    return 'Cerca de ti';
  }

  const meters = this.calculateDistanceMeters(myLat, myLng, clientLat, clientLng);

  if (meters < 1000) {
    return `A ${Math.round(meters)} metros de ti`;
  }

  return `A ${(meters / 1000).toFixed(1)} km de ti`;
}

calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadius = 6371000;

  const toRad = (value: number) => value * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}
  nextCard() {
    this.transform = '';
    this.deltaX = 0;
    this.deltaY = 0;
    this.currentPhotoIndex = 0;

    if (!this.clientes.length) return;

    this.clientes.splice(this.currentIndex, 1);

    if (this.currentIndex >= this.clientes.length) {
      this.currentIndex = 0;
    }
  }
  
  async updateClientLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(async position => {
      const profile = this.authPocketbaseService.getCurrentProfile();

      if (!profile?.id) return;

      await this.pb.collection('usuariosClient').update(profile.id, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        locationUpdatedAt: new Date().toISOString()
      });
    });
  }

  undoLastSwipe() {
    if (this.swipeHistory.length === 0) return;

    const lastSwipe = this.swipeHistory.pop();
    this.currentIndex =
      this.clientes.findIndex((c) => c.id === lastSwipe?.clientId) || 0;
    this.transform = '';
  }

  getXY(event: MouseEvent | TouchEvent): { x: number; y: number } {
    return event instanceof MouseEvent
      ? { x: event.clientX, y: event.clientY }
      : { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  getX(event: MouseEvent | TouchEvent): number {
    return event instanceof MouseEvent
      ? event.clientX
      : event.touches[0].clientX;
  }

  async abrirChat(cliente: any) {
    if (!cliente) return;

    const receiverUserId = this.getReceiverUserId(cliente);

    await this.registerSwipe(cliente, 'superlike');

    this.global.selectedClient = { ...cliente };
    this.global.chatReceiverId = receiverUserId;

    await this.router.navigate(['/chat-detail', receiverUserId]);
  }

  showSuperLikeNotification(cliente: any) {
    Swal.fire({
      toast: true,
      position: 'top',
      timer: 2200,
      timerProgressBar: true,
      showConfirmButton: false,
      background: '#1e1033',
      color: '#fff',
      iconHtml: '⭐',
      customClass: {
        popup: 'superlike-toast'
      },
      title: `¡Super Like para ${cliente.name}!`,
      text: 'Tu perfil destacó automáticamente.',
    });
  }

  getCurrentPhoto(cliente: any): string {
    if (this.currentPhotoIndex === 0 && cliente?.avatar) {
      return cliente.avatar;
    }

    const photos = cliente?.photos || [];

    if (photos.length) {
      return photos[this.currentPhotoIndex - 1] || photos[0];
    }

    return 'assets/images/hero-night.png';
  }
  getTotalPhotos(cliente: any): number {
    const photosCount = cliente?.photos?.length || 0;
    return cliente?.avatar ? photosCount + 1 : photosCount;
  }
  nextPhoto(event?: Event) {
    event?.stopPropagation();

    const total = this.getTotalPhotos(this.clientes[this.currentIndex]);

    if (total <= 1) return;

    this.currentPhotoIndex = (this.currentPhotoIndex + 1) % total;
  }

  prevPhoto(event?: Event) {
    event?.stopPropagation();

    const total = this.getTotalPhotos(this.clientes[this.currentIndex]);

    if (total <= 1) return;

    this.currentPhotoIndex =
      this.currentPhotoIndex === 0 ? total - 1 : this.currentPhotoIndex - 1;
  }

}