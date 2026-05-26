import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { GlobalService } from '../../services/global.service';

@Component({
  selector: 'app-wallet-partner',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  templateUrl: './wallet-partner.html',
  styleUrl: './wallet-partner.scss',
})
export class WalletPartner implements OnInit {

  partnerWallet: any = null;
  partnerTransactions: any[] = [];
  loading = false;
  errorMessage = '';

  constructor(private global: GlobalService) {}

  async ngOnInit(): Promise<void> {
    await this.loadPartnerWallet();
  }

  async loadPartnerWallet(): Promise<void> {
    const partnerId = this.global.profileDataPartner?.id;

    if (!partnerId) {
      this.errorMessage = 'No se encontró el perfil del local.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      try {
        this.partnerWallet = await this.global.pb.collection('partner_wallet').getFirstListItem(
          `partnerId="${partnerId}"`,
          { requestKey: null }
        );
      } catch {
        this.partnerWallet = await this.global.pb.collection('partner_wallet').create({
          partnerId,
          currency: 'COP',
          status: 'active',
          balance: 0,
          pendingBalance: 0,
          paidBalance: 0
        }, { requestKey: null });
      }

      this.partnerTransactions = await this.global.pb
        .collection('partner_wallet_transactions')
        .getFullList({
          filter: `partnerId="${partnerId}"`,
          sort: '-created',
          expand: 'productOrderId',
          requestKey: null
        });

    } catch (error) {
      console.error('Error cargando wallet del local:', error);
      this.errorMessage = 'No se pudo cargar la billetera del local.';
    } finally {
      this.loading = false;
    }
  }

  get totalBalance(): number {
    return Number(this.partnerWallet?.balance || 0);
  }

  get pendingBalance(): number {
    return Number(this.partnerWallet?.pendingBalance || 0);
  }

  get paidBalance(): number {
    return Number(this.partnerWallet?.paidBalance || 0);
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'completed': return 'Completado';
      case 'paid': return 'Pagado';
      case 'cancelled': return 'Cancelado';
      default: return status || 'Sin estado';
    }
  }
}