import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
interface WalletTransaction {
  id: string;
  type: 'topup' | 'gift_sent' | 'gift_received' | 'refund' | 'bonus';
  description: string;
  amount: number;
  direction: 'credit' | 'debit';
  status: 'completed' | 'pending' | 'failed';
  created: string;
}
@Component({
  selector: 'app-wallet-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wallet-history.html',
  styleUrl: './wallet-history.scss',
})
export class WalletHistory {
 transactions: WalletTransaction[] = [
    {
      id: '1',
      type: 'topup',
      description: 'Recarga de wallet',
      amount: 10000,
      direction: 'credit',
      status: 'completed',
      created: '2026-04-08T10:30:00'
    },
    {
      id: '2',
      type: 'gift_sent',
      description: 'Regalo enviado a Andrea',
      amount: 2500,
      direction: 'debit',
      status: 'completed',
      created: '2026-04-08T11:15:00'
    },
    {
      id: '3',
      type: 'bonus',
      description: 'Bono promocional',
      amount: 500,
      direction: 'credit',
      status: 'completed',
      created: '2026-04-08T12:00:00'
    },
    {
      id: '4',
      type: 'topup',
      description: 'Recarga pendiente',
      amount: 25000,
      direction: 'credit',
      status: 'pending',
      created: '2026-04-08T13:00:00'
    }
  ];

  constructor(private router: Router) {}

  goBack() {
    window.history.back();
  }

  getAmountPrefix(direction: 'credit' | 'debit'): string {
    return direction === 'credit' ? '+' : '-';
  }

  getTypeLabel(type: WalletTransaction['type']): string {
    switch (type) {
      case 'topup':
        return 'Recarga';
      case 'gift_sent':
        return 'Regalo enviado';
      case 'gift_received':
        return 'Regalo recibido';
      case 'refund':
        return 'Reembolso';
      case 'bonus':
        return 'Bono';
      default:
        return 'Movimiento';
    }
  }
}
