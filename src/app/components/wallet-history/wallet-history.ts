import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { GlobalService } from '../../services/global.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';

interface WalletTransaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  status: string;
  created: string;
  currency?: string;
  paymentMethod?: string;
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

      const walletRecords = await this.global.pb
        .collection('wallet_transactions')
        .getFullList({
          filter: `walletId="${wallet.id}"`,
          sort: '-created',
          requestKey: null
        });

      const rechargeProofs = await this.global.pb
        .collection('wallet_recharge_proofs')
        .getFullList({
          filter: `walletId="${wallet.id}"`,
          sort: '-created',
          requestKey: null
        });

      const walletTransactions: WalletTransaction[] = walletRecords.map((item: any) => ({
        id: item.id,
        type: item.type,
        description: item.description || 'Movimiento wallet',
        amount: Number(item.amount || 0),
        direction: item.direction || 'credit',
        status: item.status || 'completed',
        created: item.created,
        currency: item.currency || 'COP',
        paymentMethod: item.paymentMethod || 'wompi'
      }));

      const manualTransactions: WalletTransaction[] = rechargeProofs.map((item: any) => ({
        id: item.id,
        type: 'manual_topup',
        description: 'Recarga manual Binance',
        amount: Number(item.price || item.amountPaid || 0),
        direction: 'credit',
        status: item.status || 'pending',
        created: item.created,
        currency: item.currency || 'USD',
        paymentMethod: item.paymentMethod || 'binance'
      }));

      this.transactions = [
        ...walletTransactions,
        ...manualTransactions
      ].sort((a, b) =>
        new Date(b.created).getTime() - new Date(a.created).getTime()
      );

    } catch (error) {
      console.error('Error cargando historial wallet:', error);
      this.transactions = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  goBack(): void {
    this.router.navigate(['/wallet']);
  }

  getAmountPrefix(direction: 'credit' | 'debit'): string {
    return direction === 'credit' ? '+' : '-';
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'topup':
        return 'Recarga Wompi';
      case 'manual_topup':
        return 'Recarga manual';
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
      case 'rejected':
        return 'Rechazado';
      default:
        return status || 'Sin estado';
    }
  }

  getPaymentMethodLabel(method?: string): string {
    switch (method) {
      case 'binance':
        return 'Binance Pay';
      case 'wompi':
        return 'Wompi';
      default:
        return method || '';
    }
  }
}