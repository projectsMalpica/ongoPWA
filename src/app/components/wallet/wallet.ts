import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
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
export class Wallet implements OnInit {
activePackageId: string = 'basic';

  currentBalance = 0;
currentWallet: any = null;
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
   public auth: AuthPocketbaseService,
       private cdr: ChangeDetectorRef

  ) {}
async ngOnInit(): Promise<void> {
  await this.loadWallet();
}

async loadWallet(): Promise<void> {
  const userId = this.auth.currentUser?.id;

  if (!userId) return;

  try {
    const wallet = await this.global.pb.collection('wallet').getFirstListItem(
      `userId="${userId}"`,
      { requestKey: null }
    );

    this.currentWallet = wallet;
    this.currentBalance = Number(wallet['balance'] || 0);

  } catch {
    const wallet = await this.global.pb.collection('wallet').create({
      userId,
      balance: 0,
      currency: 'COP',
      status: 'active'
    });

    this.currentWallet = wallet;
    this.currentBalance = 0;
  }
    this.cdr.detectChanges();
}
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
    this.router.navigate(['/home']);
  }

  goToHistory() {
    this.router.navigate(['/wallet-history']);
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
    this.showRechargeModal = false;

    const intentRes = await fetch('https://db.ongomatch.com:5055/wallet/recharge-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.auth.currentUser.id,
        customerEmail: this.auth.currentUser.email,
        packageId: pkg.id,
        credits: pkg.credits,
        bonus: pkg.bonus || 0,
        price: pkg.price
      })
    });

    const intent = await intentRes.json();
    console.log('Intent response:', intent);
    const result = await this.wompiService.openCheckout({
  amountInCents: intent.amountInCents,
  reference: intent.reference,
  currency: 'COP',
  publicKey: intent.publicKey,
  signature: intent.signature,
  customerEmail: this.auth.currentUser.email,
  // redirectUrl: intent.redirectUrl
});

console.log('Resultado Wompi:', result);

const transaction = result?.transaction;

if (transaction?.reference && transaction?.status) {
  const confirmRes = await fetch('https://db.ongomatch.com:5055/wallet/confirm-recharge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference: transaction.reference,
      status: transaction.status
    })
  });

  const confirmData = await confirmRes.json();

  console.log('Confirmación backend:', confirmData);

  await this.loadWallet();
  this.currentBalance = Number(confirmData.balanceAfter || this.currentBalance);
this.cdr.detectChanges();
}} catch (error) {
    console.error('Error al iniciar recarga:', error);
    alert('No se pudo iniciar el pago.');
  } finally {
    this.isProcessingRecharge = false;
    this.selectedRechargePackage = null;
  }
}
}