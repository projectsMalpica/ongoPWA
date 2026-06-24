import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { Router } from '@angular/router';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import PocketBase from 'pocketbase';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-detailprofile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detailprofile.html',
  styleUrl: './detailprofile.scss',
})
export class Detailprofile implements OnInit {
  showGiftModal = false;
  giftReceiver: any = null;
  partnerProducts: any[] = [];
  selectedGiftProduct: any = null;
  giftMessage = '';
  walletBalance = 0;
  currentWallet: any = null;
  isSendingGift = false;
  interests: string[] = [];

  pb: PocketBase;

  constructor(
    public global: GlobalService,
    private router: Router,
    private authPocketbaseService: AuthPocketbaseService
  ) {
    this.pb = this.authPocketbaseService.pb;
  }

  ngOnInit(): void {
    this.interests = this.parseInterests(this.global.selectedClient?.interests);
  }

  parseInterests(interests: string | string[]): string[] {
    if (!interests) return [];

    if (Array.isArray(interests)) {
      return interests;
    }

    return interests
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  getReceiverUserId(cliente: any): string {
    return cliente?.userId || cliente?.id || '';
  }

  async abrirChat(cliente: any) {
    if (!cliente) return;

    const receiverUserId = this.getReceiverUserId(cliente);

    this.global.selectedClient = { ...cliente };
    this.global.chatReceiverId = receiverUserId;

    await this.router.navigate(['/chat-detail', receiverUserId]);
  }

  irAWallet(cliente: any) {
    if (!cliente) return;

    this.global.selectedClient = { ...cliente };
    this.router.navigate(['/wallet']);
  }

  onGiftClick(event: Event, cliente: any) {
    event.stopPropagation();
    event.preventDefault();

    this.openGiftFromHome(cliente);
  }

  async openGiftFromHome(cliente: any) {
    if (!cliente?.id) return;

    this.giftReceiver = cliente;
    this.showGiftModal = true;

    const partnerId = cliente.currentPartnerId;

    await Promise.all([
      this.loadProductsForPartner(partnerId || undefined),
      this.loadWallet()
    ]);
  }

  async loadProductsForPartner(partnerId?: string) {
    let filter = 'isAvailable=true';

    if (partnerId) {
      filter = `partnerId="${partnerId}" && isAvailable=true`;
    }

    const records = await this.pb.collection('partnerProducts').getList(1, 20, {
      filter,
      sort: '-created',
      expand: 'partnerId',
      requestKey: null
    });

    this.partnerProducts = records.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      partnerId: item.partnerId,
      partnerName:
        item.expand?.partnerId?.venueName ||
        item.expand?.partnerId?.name ||
        'Local',
      image: item.image ? this.pb.files.getUrl(item, item.image) : ''
    }));
  }

  async loadWallet(): Promise<void> {
    const userId = this.authPocketbaseService.currentUser?.id;

    if (!userId) return;

    try {
      const wallet = await this.pb.collection('wallet').getFirstListItem(
        `userId="${userId}"`,
        { requestKey: null }
      );

      this.currentWallet = wallet;
      this.walletBalance = Number(wallet['balance'] || 0);

    } catch {
      const wallet = await this.pb.collection('wallet').create({
        userId,
        balance: 0,
        currency: 'COP',
        status: 'active'
      });

      this.currentWallet = wallet;
      this.walletBalance = 0;
    }
  }

  closeGiftModal(): void {
    if (this.isSendingGift) return;

    this.showGiftModal = false;
    this.giftReceiver = null;
    this.partnerProducts = [];
    this.selectedGiftProduct = null;
    this.giftMessage = '';
  }
}