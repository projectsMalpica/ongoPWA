import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatPocketbaseService } from '../../services/chat.service';
import { ChangeDetectorRef, NgZone } from '@angular/core';
@Component({
  selector: 'app-chat-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './chat-detail.html',
  styleUrl: './chat-detail.scss',
})
export class ChatDetail implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollBottom') scrollBottom!: ElementRef;
  receiverProfile: any = null;
  form: FormGroup;
  messages: any[] = [];
  currentUserId = '';
  receiverId = '';
  isMatched = false;
  currentMatch: any = null;
  insideSameLocal = false;
  private messagesSub?: Subscription;
  showGiftOptions = false;
  showDrinkOptions = false;

 giftOptions = [
  {
    id: 'flower',
    name: 'Flor',
    icon: '🌹',
    prices: {
      CO: { amount: 3000, currency: 'COP' },
      VE: { amount: 1, currency: 'USD' }
    },
    message: 'Te enviaron una flor 🌹'
  },
  {
    id: 'heart',
    name: 'Corazón',
    icon: '💖',
    prices: {
      CO: { amount: 2500, currency: 'COP' },
      VE: { amount: 1, currency: 'USD' }
    },
    message: 'Te enviaron un corazón 💖'
  },
  {
    id: 'spark',
    name: 'Chispa',
    icon: '✨',
    prices: {
      CO: { amount: 2000, currency: 'COP' },
      VE: { amount: 1, currency: 'USD' }
    },
    message: 'Te enviaron una chispa ✨'
  },
  {
    id: 'kiss',
    name: 'Besito',
    icon: '😘',
    prices: {
      CO: { amount: 3500, currency: 'COP' },
      VE: { amount: 1, currency: 'USD' }
    },
    message: 'Te enviaron un besito 😘'
  }
];

  localProducts: any[] = [];
  walletBalance = 0;
  currentWallet: any = null;
  distanceText = '';
  constructor(
    private chatService: ChatPocketbaseService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.form = this.fb.group({
      message: ['']
    });
  }

  async ngOnInit() {
    this.currentUserId = await this.chatService.resolveUserId(
      this.chatService.getCurrentUserId()
    );

    const rawReceiverId =
      this.route.snapshot.paramMap.get('id') ||
      this.chatService.chatReceiverId ||
      '';

    this.receiverId = await this.chatService.resolveUserId(rawReceiverId);
    if (!this.currentUserId || !this.receiverId) {
      console.warn('Falta currentUserId o receiverId');
      return;
    }
    this.isMatched = await this.checkMatchStatus();

    this.chatService.chatReceiverId = this.receiverId;

    this.messagesSub = this.chatService.messages$.subscribe(messages => {
      this.ngZone.run(() => {
        this.messages = [...messages];
        this.cdr.detectChanges();
        this.scrollToBottom();
      });
    });

    this.receiverProfile = await this.chatService.getUserProfile(this.receiverId);
    this.receiverProfile = await this.chatService.getUserProfile(this.receiverId);

    await this.chatService.loadMessages(this.receiverId);
    await this.chatService.markMessagesAsRead(this.receiverId);
await this.loadWallet();
    this.cdr.detectChanges();

  }
  async checkMatchStatus(): Promise<boolean> {
    try {
      const match = await this.chatService.pb
        .collection('matches')
        .getFirstListItem(
          `
        (
          userAAuthId="${this.currentUserId}" && userBAuthId="${this.receiverId}"
        ) || (
          userAAuthId="${this.receiverId}" && userBAuthId="${this.currentUserId}"
        )
        `,
          {
            requestKey: null
          }
        );

      this.currentMatch = match;
      this.insideSameLocal = !!match['insideSameLocal'];

      return match['status'] === 'active';

    } catch (error) {
      this.currentMatch = null;
      this.insideSameLocal = false;
      return false;
    }
  }
  async send() {
    const message = this.form.value.message?.trim();

    if (!message || !this.receiverId) return;

    this.form.patchValue({ message: '' });

    try {
      await this.chatService.sendMessage(this.receiverId, message);
      this.form.reset({ message: '' });
      this.cdr.detectChanges();
    } catch (error) {
      console.error('No se pudo enviar el mensaje:', error);
    }
  }

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.messagesSub?.unsubscribe();
  }

  scrollToBottom() {
    setTimeout(() => {
      this.scrollBottom?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
  async loadWallet(): Promise<void> {
  const userId = this.currentUserId;
  if (!userId) return;

  try {
    const wallet = await this.chatService.pb.collection('wallet').getFirstListItem(
      `userId="${userId}"`,
      { requestKey: null }
    );

    this.currentWallet = wallet;
    this.walletBalance = Number(wallet['balance'] || 0);
  } catch {
    const wallet = await this.chatService.pb.collection('wallet').create({
      userId,
      balance: 0,
      currency: 'COP',
      status: 'active'
    }, { requestKey: null });

    this.currentWallet = wallet;
    this.walletBalance = 0;
  }
}
async sendSymbolicGift(gift: any): Promise<void> {
  const price = this.getGiftPrice(gift);
  const amount = Number(price.amount || 0);
  const currency = price.currency || 'COP';

  if (!this.isWalletCurrency(currency)) {
    alert('Este regalo está en USD/VES. Debe pagarse por comprobante manual.');
    return;
  }

  await this.loadWallet();

  const balanceBefore = Number(this.currentWallet?.balance || 0);

  if (balanceBefore < amount) {
    alert('Saldo insuficiente.');
    return;
  }

  const balanceAfter = balanceBefore - amount;

  await this.chatService.pb.collection('wallet').update(this.currentWallet.id, {
    balance: balanceAfter
  }, { requestKey: null });

  const order = await this.chatService.pb.collection('product_orders').create({
    buyerUserId: this.currentUserId,
    receiverUserId: this.receiverId,
    partnerId: '',
    productId: gift.id,
    productName: `${gift.icon} ${gift.name}`,
    productImage: '',
    amount,
    currency,
    paymentMethod: 'wallet',
    status: 'paid',
    orderStatus: 'symbolic_sent',
    orderType: 'symbolic_gift',
    redeemCode: '',
    redeemQr: '',
    message: gift.message
  }, { requestKey: null });

  await this.chatService.pb.collection('wallet_transactions').create({
    walletId: this.currentWallet.id,
    userId: this.currentUserId,
    type: 'symbolic_gift',
    amount,
    currency,
    direction: 'debit',
    balanceBefore,
    balanceAfter,
    referenceType: 'product_order',
    referenceId: order.id,
    status: 'completed',
    description: `Regalo simbólico enviado: ${gift.name}`
  }, { requestKey: null });

  this.walletBalance = balanceAfter;
  this.currentWallet.balance = balanceAfter;

  await this.chatService.sendMessage(this.receiverId, gift.message);

  this.showGiftOptions = false;
  this.cdr.detectChanges();
}
async openDrinkOptions(): Promise<void> {
  const partnerId = this.currentMatch?.partnerId;

  if (!partnerId) {
    alert('No se encontró el local del match.');
    return;
  }

  try {
    const records = await this.chatService.pb.collection('partnerProducts').getFullList({
      filter: `partnerId="${partnerId}" && isAvailable=true`,
      sort: '-created',
      requestKey: null
    });

    this.localProducts = records.map((item: any) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price || 0),
      currency: item.currency || 'COP',
      country: item.country || 'CO',
      partnerId: item.partnerId,
      image: item.image
        ? this.chatService.pb.files.getUrl(item, item.image)
        : ''
    }));

    this.showDrinkOptions = true;
    this.showGiftOptions = false;
    this.cdr.detectChanges();

  } catch (error) {
    console.error('Error cargando productos del local:', error);
    alert('No se pudieron cargar los productos del local.');
  }
}
async sendDrinkProduct(product: any): Promise<void> {
  const currency = product.currency || 'COP';

if (!this.isWalletCurrency(currency)) {
  alert('Este producto está en USD/VES. Debe pagarse por comprobante manual.');
  return;
}
  await this.loadWallet();

  const amount = Number(product.price || 0);
  const balanceBefore = Number(this.currentWallet?.balance || 0);

  if (balanceBefore < amount) {
    alert('Saldo insuficiente.');
    return;
  }

  const balanceAfter = balanceBefore - amount;
  const redeemCode = `DRINK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const redeemQr = `${window.location.origin}/redeem/${redeemCode}`;

  await this.chatService.pb.collection('wallet').update(this.currentWallet.id, {
    balance: balanceAfter
  }, { requestKey: null });

  const order = await this.chatService.pb.collection('product_orders').create({
    buyerUserId: this.currentUserId,
    receiverUserId: this.receiverId,
    partnerId: product.partnerId,
    productId: product.id,
    productName: product.name,
    productImage: product.image || '',
    amount,
    paymentMethod: 'wallet',
    status: 'paid',
    orderStatus: 'pending_redeem',
    orderType: 'drink_gift',
    redeemCode,
    redeemQr,
    message: 'Te enviaron una copa 🍸'
  }, { requestKey: null });

  await this.chatService.pb.collection('wallet_transactions').create({
    walletId: this.currentWallet.id,
    userId: this.currentUserId,
    partnerId: product.partnerId,
    type: 'drink_sent',
    amount,
    direction: 'debit',
    balanceBefore,
    balanceAfter,
    referenceType: 'product_order',
    referenceId: order.id,
    status: 'completed',
    description: `Copa enviada: ${product.name}`
  }, { requestKey: null });

  this.walletBalance = balanceAfter;
  this.currentWallet.balance = balanceAfter;

  await this.chatService.sendMessage(
    this.receiverId,
    `🍸 Te envié una copa: ${product.name}. Código: ${redeemCode}`
  );

  this.showDrinkOptions = false;
}
showDistance(): void {
  const myLat = Number(this.currentMatch?.myLat || 0);
  const myLng = Number(this.currentMatch?.myLng || 0);
  const receiverLat = Number(this.receiverProfile?.lat || 0);
  const receiverLng = Number(this.receiverProfile?.lng || 0);

  if (!receiverLat || !receiverLng) {
    alert('No se pudo calcular la distancia.');
    return;
  }

  alert('Esta persona está cerca de ti.');
}
openGiftOptions(): void {
  this.showGiftOptions = true;
  this.showDrinkOptions = false;
  this.cdr.detectChanges();
}
getUserCountry(): 'CO' | 'VE' {
  const country =
    this.receiverProfile?.country ||
    this.currentMatch?.country ||
    'CO';

  return country === 'VE' ? 'VE' : 'CO';
}

getGiftPrice(gift: any): { amount: number; currency: string } {
  const country = this.getUserCountry();
  return gift.prices?.[country] || gift.prices?.CO || { amount: 0, currency: 'COP' };
}

getMoneyLabel(amount: number, currency: string = 'COP'): string {
  const value = Number(amount || 0);

  if (currency === 'USD') {
    return `${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} USD`;
  }

  if (currency === 'VES') {
    return `${value.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} Bs`;
  }

  return `${value.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })} COP`;
}

isWalletCurrency(currency: string): boolean {
  return currency === 'COP';
}
}