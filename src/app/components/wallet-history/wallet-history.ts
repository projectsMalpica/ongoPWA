import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GlobalService } from '../../services/global.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
interface WalletTransaction {
  id: string;
  type: 'topup' | 'gift_sent' | 'gift_received' | 'refund' | 'bonus' | string;
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  status: 'completed' | 'pending' | 'failed' | string;
  created: string;
}
@Component({
  selector: 'app-wallet-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wallet-history.html',
  styleUrl: './wallet-history.scss',
})
export class WalletHistory implements OnInit {
  transactions: WalletTransaction[] = [];
  loading = false;

  constructor(
    private router: Router,
    private global: GlobalService,
    private auth: AuthPocketbaseService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadTransactions();
  }

  async loadTransactions(): Promise<void> {
  const userId = this.auth.currentUser?.id;

  if (!userId) return;

  try {
    this.loading = true;

    const wallet = await this.global.pb.collection('wallet').getFirstListItem(
      `userId="${userId}"`,
      { requestKey: null }
    );

    const records = await this.global.pb.collection('wallet_transactions').getFullList({
      filter: `walletId="${wallet.id}"`,
      sort: '-created',
      requestKey: null
    });

    this.transactions = records.map((item: any) => ({
      id: item.id,
      type: item.type,
      description: item.description || 'Movimiento wallet',
      amount: Number(item.amount || 0),
      direction: item.direction,
      status: item.status,
      created: item.created
    }));
this.cdr.detectChanges();
  } catch (error) {
    console.error('Error cargando historial wallet:', error);
    this.transactions = [];
  } finally {
    this.loading = false;
  }
}

  goBack() {
    this.router.navigate(['/wallet']);
  }

  getAmountPrefix(direction: 'credit' | 'debit'): string {
    return direction === 'credit' ? '+' : '-';
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'topup':
        return 'Recarga';
      case 'gift_sent':
        return 'Regalo enviado';
      case 'gift_received':
        return 'Regalo recibido';
      case 'purchase':
        return 'Compra';
      case 'refund':
        return 'Reembolso';
      case 'bonus':
        return 'Bono';
      default:
        return 'Movimiento';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'pending':
        return 'Pendiente';
      case 'failed':
        return 'Fallido';
      case 'approved':
        return 'Aprobado';
      default:
        return status || 'Sin estado';
    }
  }
}