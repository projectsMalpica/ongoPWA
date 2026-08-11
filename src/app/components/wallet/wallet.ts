import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlobalService } from '../../services/global.service';
import { WompiService } from '../../services/wompi.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { FormsModule } from '@angular/forms';

interface WalletPackage {
  id: string;
  name: string;
  priceCop: number;
  priceUsd: number;
  theme: 'plus' | 'gold' | 'platinum';
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wallet.html',
  styleUrl: './wallet.scss',
})
export class Wallet implements OnInit {
  activePackageId: string = 'basic';
  pendingRecharge: any = null;
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
      priceCop: 10000,
      priceUsd: 3,
      theme: 'plus'
    },
    {
      id: 'smart',
      name: 'Wallet Smart',
      priceCop: 25000,
      priceUsd: 7,
      theme: 'gold'
    },
    {
      id: 'pro',
      name: 'Wallet Pro',
      priceCop: 50000,
      priceUsd: 13,
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
  manualPaymentMethod: 'binance' = 'binance';
  manualProofFile: File | null = null;
  manualProofPreview = '';
  manualPaymentNotes = '';
  isUploadingManualProof = false;

  manualPaymentMethods = [
    {
      id: 'binance',
      name: 'Binance',
      description: 'Pago manual en USD por Binance Pay.',
      account: 'binance-user-o-email@correo.com'
    }
  ];
  constructor(private router: Router,
    private global: GlobalService,
    private wompiService: WompiService,
    public auth: AuthPocketbaseService,
    private cdr: ChangeDetectorRef

  ) { }
  async ngOnInit(): Promise<void> {
    await this.loadWallet();
    await this.loadPendingRecharge();
  }
  async loadPendingRecharge() {
    const userId = this.auth.currentUser.id;

    const result = await this.global.pb
      .collection('wallet_recharge_proofs')
      .getFirstListItem(
        `userId="${userId}" && status="pending"`,
        {
          sort: '-created',
          requestKey: null
        }
      )
      .catch(() => null);

    this.pendingRecharge = result;
  }
  getCopAmount(pkg: WalletPackage): string {
    return `$ ${pkg.priceCop.toLocaleString('es-CO')} COP`;
  }

  getUsdAmount(pkg: WalletPackage): string {
    return `$${pkg.priceUsd.toLocaleString('en-US')} USD`;
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

  getManualAmount(pkg: WalletPackage): string {
    return this.getUsdAmount(pkg);
  }

  getManualCurrency(): 'USD' {
    return 'USD';
  }
  closeRechargeModal() {
    if (this.isProcessingRecharge || this.isUploadingManualProof) return;

    this.showRechargeModal = false;
    this.selectedRechargePackage = null;
    this.resetManualRechargeState();
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

      const intent = await this.auth.pb.send('/api/wallet/recharge-intent', {
        method: 'POST',
        body: {
          userId: this.auth.currentUser.id,
          customerEmail: this.auth.currentUser.email,
          packageId: pkg.id,
          price: pkg.priceCop
        }
      });
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
        const confirmData = await this.auth.pb.send('/api/wallet/confirm-recharge', {
          method: 'POST',
          body: {
            reference: transaction.reference,
            status: transaction.status
          }
        });

        console.log('Confirmación backend:', confirmData);

        await this.loadWallet();
        this.currentBalance = Number(confirmData.balanceAfter || this.currentBalance);
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error al iniciar recarga:', error);
      alert('No se pudo iniciar el pago.');
    } finally {
      this.isProcessingRecharge = false;
      this.selectedRechargePackage = null;
    }
  }
  onManualProofSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Formato no permitido. Usa JPG, PNG, WEBP o PDF.');
      return;
    }

    this.manualProofFile = file;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        this.manualProofPreview = String(reader.result);
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    } else {
      this.manualProofPreview = '';
    }
  }

  async submitManualRecharge(): Promise<void> {
    if (!this.selectedRechargePackage || !this.manualProofFile || this.isUploadingManualProof) return;

    const userId = this.auth.currentUser?.id;

    if (!userId || !this.currentWallet?.id) {
      alert('No se pudo identificar la wallet del usuario.');
      return;
    }

    try {
      this.isUploadingManualProof = true;

      const pkg = this.selectedRechargePackage;

      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('walletId', this.currentWallet.id);
      formData.append('packageId', pkg.id);
      formData.append('packageName', pkg.name);
     formData.append('price', String(pkg.priceUsd));
formData.append('currency', 'USD');
      formData.append('amountPaid', String(pkg.priceUsd));
      formData.append('paymentMethod', this.manualPaymentMethod);
      formData.append('status', 'pending');
      formData.append('adminNotes', this.manualPaymentNotes || '');
      formData.append('proofImage', this.manualProofFile);

      await this.global.pb.collection('wallet_recharge_proofs').create(formData, {
        requestKey: null
      });

/*       alert('Comprobante enviado. Tu recarga será validada por el administrador.');
 */      await this.loadPendingRecharge();
      this.closeRechargeModal();
      this.resetManualRechargeState();
      this.closeRechargeModal();

    } catch (error) {
      console.error('Error enviando comprobante:', error);
      alert('No se pudo enviar el comprobante.');
    } finally {
      this.isUploadingManualProof = false;
      this.cdr.detectChanges();
    }
  }

  private resetManualRechargeState(): void {
    this.manualProofFile = null;
    this.manualProofPreview = '';
    this.manualPaymentNotes = '';
  }
  confirmRechargeFromSelected(): void {
    const selected = this.activePackage;
    if (!selected) return;

    this.selectedRechargePackage = selected;
    this.confirmRecharge();
  }

  openManualRecharge(): void {
    const selected = this.activePackage;
    if (!selected) return;

    this.selectedRechargePackage = selected;
    this.showRechargeModal = true;
  }
}
