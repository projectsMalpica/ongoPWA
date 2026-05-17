import { Component, Input, OnInit } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { CommonModule } from '@angular/common';
import PocketBase from 'pocketbase';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { SwipesService } from '../../services/SwipesService.service';
import { Router } from '@angular/router';

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
  constructor(
    public global: GlobalService,
    public authPocketbaseService: AuthPocketbaseService,
    public swipesService: SwipesService,
    private router: Router
  ) {
    this.pb = this.global.pb;
  }

  async ngOnInit(): Promise<void> {
    this.loadingClients = true;

    this.global.clientes$.subscribe((clientes: any[]) => {
      this.clientes = clientes || [];
      this.loadingClients = false;

      if (this.currentIndex >= this.clientes.length) {
        this.currentIndex = 0;
      }
    });

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
    this.hasDragged = true;
    if (!this.isDragging) return;
    const pos = this.getXY(event);
    this.deltaX = pos.x - this.startX;
    this.deltaY = pos.y - this.startY;
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

resetCard() {
  this.transform = '';
  this.deltaX = 0;
  this.deltaY = 0;
}

async like(cliente: any) {
  await this.registerSwipe(cliente, 'like');
  this.nextCard();
}

async dislike(cliente: any) {
  await this.registerSwipe(cliente, 'dislike');
  this.nextCard();
}

async superLike(cliente: any) {
  await this.registerSwipe(cliente, 'superlike');
  this.nextCard();
}

openProfile(cliente: any) {
  this.global.previewClient(cliente);
  if (this.hasDragged) return;
}
get likeOpacity() {
  return Math.max(0, this.deltaX / 120);
}

get rejectOpacity() {
  return Math.max(0, -this.deltaX / 120);
}
async openChat(cliente: any) {
  this.global.selectedClient = cliente;
  this.global.chatReceiverId = cliente.id;
  await this.router.navigate(['/chat-detail', cliente.id]);
}

  async registerSwipe(cliente: any, action: 'like' | 'dislike' | 'superlike') {
    await this.swipesService.registerSwipe(cliente.id, action);

    if (action === 'superlike') {
      this.showSuperLikeNotification(cliente);
    }

    this.swipeHistory.push({ clientId: cliente.id, action });
  }

  nextCard() {
    this.transform = '';
    this.deltaX = 0;
    this.deltaY = 0;
    this.currentPhotoIndex = 0;
    if (!this.clientes.length) return;

    this.currentIndex = (this.currentIndex + 1) % this.clientes.length;
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
    await this.registerSwipe(cliente, 'superlike');
    this.global.selectedClient = cliente;
    this.global.chatReceiverId = cliente.id;
    await this.router.navigate(['/chat-detail', cliente.id]);
  }

  showSuperLikeNotification(cliente: any) {
    alert(`¡Le diste Super Like a ${cliente.name}!`);
  }
  currentPhotoIndex = 0;

getCurrentPhoto(cliente: any): string {
  if (cliente?.photos?.length) {
    return cliente.photos[this.currentPhotoIndex];
  }

  return cliente?.avatar || 'assets/images/hero-night.png';
}

nextPhoto(event?: Event) {
  event?.stopPropagation();

  const photos = this.clientes[this.currentIndex]?.photos || [];

  if (!photos.length) return;

  this.currentPhotoIndex =
    (this.currentPhotoIndex + 1) % photos.length;
}

prevPhoto(event?: Event) {
  event?.stopPropagation();

  const photos = this.clientes[this.currentIndex]?.photos || [];

  if (!photos.length) return;

  this.currentPhotoIndex =
    this.currentPhotoIndex === 0
      ? photos.length - 1
      : this.currentPhotoIndex - 1;
}
}