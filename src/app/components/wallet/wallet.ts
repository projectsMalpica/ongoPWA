import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlobalService } from '../../services/global.service';
import { WompiService } from '../../services/wompi.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';

interface WalletPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  bonus?: number;
  theme: 'plus' | 'gold' | 'platinum';
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wallet.html',
  styleUrl: './wallet.scss',
})
export class Wallet {
activePackageId: string = 'basic';

  currentBalance = 12500;
  currencySymbol = '$';
  showRechargeModal = false;
  selectedRechargePackage: WalletPackage | null = null;
  isProcessingRecharge = false;
  packages: WalletPackage[] = [
    {
      id: 'basic',
      name: 'Wallet Básica',
      credits: 10000,
      price: 10000,
      bonus: 0,
      theme: 'plus'
    },
    {
      id: 'smart',
      name: 'Wallet Smart',
      credits: 25000,
      price: 25000,
      bonus: 3000,
      theme: 'gold'
    },
    {
      id: 'pro',
      name: 'Wallet Pro',
      credits: 50000,
      price: 50000,
      bonus: 8000,
      theme: 'platinum'
    }
  ];

  packageBenefits: Record<string, string[]> = {
    basic: [
      'Recarga saldo para enviar regalos',
      'Visualiza tu saldo disponible',
      'Consulta tus movimientos',
      'Usa créditos dentro de la app',
      'Recarga rápida cuando lo necesites'
    ],
    smart: [
      'Incluye bono adicional de créditos',
      'Mayor capacidad para enviar regalos',
      'Visualiza tu saldo disponible',
      'Consulta tus movimientos',
      'Ideal para usuarios frecuentes'
    ],
    pro: [
      'Mejor valor en recarga',
      'Mayor bono promocional',
      'Más créditos para regalos y compras',
      'Visualiza tu saldo disponible',
      'Consulta tus movimientos completos'
    ]
  };

  constructor(private router: Router, 
    private global: GlobalService,
    private wompiService: WompiService,
   public auth: AuthPocketbaseService
  ) {}

  get activePackage(): WalletPackage | undefined {
    return this.packages.find(pkg => pkg.id === this.activePackageId);
  }

  get activeBenefits(): string[] {
    return this.packageBenefits[this.activePackageId] || [];
  }

  selectPackage(packageId: string) {
    this.activePackageId = packageId;
  }

  goBack() {
    this.global.setRoute('home');
  }

  goToHistory() {
    this.global.setRoute('wallet-history');
  }
   rechargeWallet() {
    const selected = this.activePackage;
    if (!selected) return;

    this.selectedRechargePackage = selected;
    this.showRechargeModal = true;
  }

  closeRechargeModal() {
    if (this.isProcessingRecharge) return;
    this.showRechargeModal = false;
    this.selectedRechargePackage = null;
  }

  private generateReference(pkg: WalletPackage): string {
    const timestamp = Date.now();
    return `wallet_${pkg.id}_${timestamp}`;
  }

  async confirmRecharge() {
  if (!this.selectedRechargePackage || this.isProcessingRecharge) return;

  try {
    this.isProcessingRecharge = true;

    const pkg = this.selectedRechargePackage;
    const reference = this.generateReference(pkg);

    // Cerrar tu modal ANTES de abrir Wompi
    this.showRechargeModal = false;

    // pequeño delay para que Angular pinte bien
    await new Promise(resolve => setTimeout(resolve, 150));

    const result = await this.wompiService.openCheckout({
      amountInCents: pkg.price * 100,
      reference,
      currency: 'COP',
      customerEmail: this.auth.currentUser.email,
      // signature: '...', // solo si la generas desde backend
      // redirectUrl: 'http://localhost:4200/wallet/resultado'
    });

    console.log('Resultado de Wompi:', result);
    this.selectedRechargePackage = null;

  } catch (error) {
    console.error('Error al iniciar recarga con Wompi:', error);
    alert('No se pudo iniciar el pago con Wompi.');
  } finally {
    this.isProcessingRecharge = false;
  }
}
}