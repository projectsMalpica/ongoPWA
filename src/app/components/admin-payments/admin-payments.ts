import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import PocketBase from 'pocketbase';
import Swal from 'sweetalert2';

type PaymentTarget = 'client' | 'partner' | 'wallet';
type PaymentStatus = 'pending' | 'approved' | 'rejected';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, CurrencyPipe],
  templateUrl: './admin-payments.html',
  styleUrl: './admin-payments.scss',
})
export class AdminPayments implements OnInit {
  private pb = new PocketBase('https://db.ongomatch.com:8090');

  proofs: any[] = [];
  loading = false;
  processingId: string | null = null;

  target: PaymentTarget = 'client';
  status: PaymentStatus = 'pending';

  page = 1;
  perPage = 20;
  totalPages = 1;

  async ngOnInit(): Promise<void> {
    await this.loadProofs();
  }

  get collectionName(): string {
  if (this.target === 'wallet') return 'wallet_recharge_proofs';

  return this.target === 'client'
    ? 'client_payment_proofs'
    : 'partner_payment_proofs';
}
  get profileCollectionName(): string {
    return this.target === 'client'
      ? 'usuariosClient'
      : 'usuariosPartner';
  }

  get relationField(): string {
    return this.target === 'client' ? 'clientId' : 'partnerId';
  }

 /*  async changeTarget(target: PaymentTarget): Promise<void> {
    this.target = target;
    this.page = 1;
    await this.loadProofs();
  } */
  async changeTarget(target: PaymentTarget): Promise<void> {
  this.target = target;
  this.status = 'pending';
  this.page = 1;
  await this.loadProofs();
}

  async changeStatus(status: PaymentStatus): Promise<void> {
    this.status = status;
    this.page = 1;
    await this.loadProofs();
  }

  /* async loadProofs(): Promise<void> {
    this.loading = true;

    try {
      const result = await this.pb.collection(this.collectionName).getList(
        this.page,
        this.perPage,
        {
          filter: `status="${this.status}"`,
          sort: '-created',
          requestKey: null
        }
      );

      this.proofs = result.items;
      this.totalPages = result.totalPages || 1;

    } catch (error) {
      console.error('Error cargando comprobantes:', error);
      this.proofs = [];
      this.totalPages = 1;
    } finally {
      this.loading = false;
    }
  } */
  async loadProofs(): Promise<void> {
  this.loading = true;

  try {
    const result = await this.pb.collection(this.collectionName).getList(
      this.page,
      this.perPage,
      {
        filter: `status="${this.status}"`,
        sort: '-created',
        requestKey: null
      }
    );

    console.log('Filtro actual:', {
      target: this.target,
      collection: this.collectionName,
      status: this.status,
      total: result.totalItems
    });

    this.proofs = result.items;
    this.totalPages = result.totalPages || 1;

  } catch (error) {
    console.error('Error cargando comprobantes:', error);
    this.proofs = [];
    this.totalPages = 1;
  } finally {
    this.loading = false;
  }
}
  async approveWalletRecharge(proof: any): Promise<void> {
  this.processingId = proof.id;

  try {
    const wallet = await this.pb.collection('wallet').getOne(proof.walletId, {
      requestKey: null
    });

    const creditsToAdd = Number(proof.credits || 0) + Number(proof.bonus || 0);

    if (creditsToAdd <= 0) {
      throw new Error('El comprobante no tiene créditos válidos para acreditar.');
    }

    const currentBalance = Number(wallet['balance'] || 0);
    const newBalance = currentBalance + creditsToAdd;

    await this.pb.collection('wallet').update(proof.walletId, {
      balance: newBalance
    }, { requestKey: null });

    await this.pb.collection('wallet_transactions').create({
      walletId: proof.walletId,
      userId: proof.userId,
      type: 'topup',
      description: `Recarga manual Binance aprobada - ${proof.packageName}`,
      amount: creditsToAdd,
      direction: 'credit',
      status: 'completed',
      paymentMethod: 'binance',
      reference: proof.id
    }, { requestKey: null });

    await this.pb.collection('wallet_recharge_proofs').update(proof.id, {
      status: 'approved',
      validatedAt: new Date().toISOString()
    }, { requestKey: null });

    await this.loadProofs();

    Swal.fire({
      icon: 'success',
      title: 'Recarga aprobada',
      text: 'El saldo fue acreditado correctamente.',
      timer: 1600,
      showConfirmButton: false
    });

  } catch (error: any) {
    console.error('Error aprobando recarga wallet:', error);

    Swal.fire({
      icon: 'error',
      title: 'No se pudo aprobar la recarga',
      text: error?.message || 'Revisa los datos del comprobante.'
    });

  } finally {
    this.processingId = null;
  }
}
  async nextPage(): Promise<void> {
    if (this.page >= this.totalPages) return;
    this.page++;
    await this.loadProofs();
  }

  async prevPage(): Promise<void> {
    if (this.page <= 1) return;
    this.page--;
    await this.loadProofs();
  }

 /*  async approveProof(proof: any): Promise<void> {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Aprobar pago',
      text: `¿Activar el plan ${proof.planName}?`,
      showCancelButton: true,
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    this.processingId = proof.id;

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await this.pb.collection(this.collectionName).update(proof.id, {
        status: 'approved',
        validatedAt: new Date().toISOString()
      }, { requestKey: null });

      const profileId = proof[this.relationField];

      if (!profileId) {
        throw new Error(`El comprobante no tiene ${this.relationField}`);
      }

      await this.pb.collection(this.profileCollectionName).update(profileId, {
        subscriptionStatus: 'active',
        subscriptionPlanId: proof.planId,
        subscriptionPlanName: proof.planName,
        subscriptionStartsAt: new Date().toISOString(),
        subscriptionExpiresAt: expiresAt.toISOString(),
        subscriptionAutoRenew: false,

        pendingSubscriptionStatus: '',
        pendingSubscriptionPlanId: '',
        pendingSubscriptionPlanName: '',
        pendingSubscriptionRequestedAt: ''
      }, { requestKey: null });

      await this.loadProofs();

      Swal.fire({
        icon: 'success',
        title: 'Plan activado',
        timer: 1400,
        showConfirmButton: false
      });

    } catch (error: any) {
      console.error('Error aprobando pago:', error);

      Swal.fire({
        icon: 'error',
        title: 'No se pudo aprobar',
        text: error?.message || 'Revisa campos, permisos y relación del comprobante.'
      });

    } finally {
      this.processingId = null;
    }
  } */
async approveProof(proof: any): Promise<void> {
  const title = this.target === 'wallet'
    ? 'Aprobar recarga wallet'
    : 'Aprobar pago';

  const text = this.target === 'wallet'
    ? `¿Acreditar la recarga ${proof.packageName || 'Wallet'}?`
    : `¿Activar el plan ${proof.planName}?`;

  const result = await Swal.fire({
    icon: 'question',
    title,
    text,
    showCancelButton: true,
    confirmButtonText: 'Sí, aprobar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  this.processingId = proof.id;

  try {
    if (this.target === 'wallet') {

  const wallet = await this.pb.collection('wallet').getOne(proof.walletId, {
    requestKey: null
  });

  const amount =
    Number(proof.amountPaid || proof.price || 0);

  if (amount <= 0) {
    throw new Error('El comprobante no tiene un monto válido.');
  }

  const currentBalance = Number(wallet['balance'] || 0);

  await this.pb.collection('wallet').update(proof.walletId, {
    balance: currentBalance + amount
  }, {
    requestKey: null
  });

  await this.pb.collection('wallet_transactions').create({
    walletId: proof.walletId,
    userId: proof.userId,
    type: 'topup',
    description: `Recarga manual Binance - ${proof.packageName}`,
    amount,
    direction: 'credit',
    status: 'completed',
    currency: proof.currency,
    paymentMethod: 'binance',
    reference: proof.id
  }, {
    requestKey: null
  });

  await this.pb.collection('wallet_recharge_proofs').update(proof.id, {
    status: 'approved',
    validatedAt: new Date().toISOString()
  }, {
    requestKey: null
  });

  await this.loadProofs();

  Swal.fire({
    icon: 'success',
    title: 'Recarga aprobada',
    text: `Se acreditaron ${amount} ${proof.currency} a la wallet.`,
    timer: 1800,
    showConfirmButton: false
  });

  return;
}

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.pb.collection(this.collectionName).update(proof.id, {
      status: 'approved',
      validatedAt: new Date().toISOString()
    }, { requestKey: null });

    const profileId = proof[this.relationField];

    if (!profileId) {
      throw new Error(`El comprobante no tiene ${this.relationField}`);
    }

    await this.pb.collection(this.profileCollectionName).update(profileId, {
      subscriptionStatus: 'active',
      subscriptionPlanId: proof.planId,
      subscriptionPlanName: proof.planName,
      subscriptionStartsAt: new Date().toISOString(),
      subscriptionExpiresAt: expiresAt.toISOString(),
      subscriptionAutoRenew: false,

      pendingSubscriptionStatus: '',
      pendingSubscriptionPlanId: '',
      pendingSubscriptionPlanName: '',
      pendingSubscriptionRequestedAt: ''
    }, { requestKey: null });

    await this.loadProofs();

    Swal.fire({
      icon: 'success',
      title: 'Plan activado',
      timer: 1400,
      showConfirmButton: false
    });

  } catch (error: any) {
    console.error('Error aprobando pago:', error);

    Swal.fire({
      icon: 'error',
      title: 'No se pudo aprobar',
      text: error?.message || 'Revisa campos, permisos y relación del comprobante.'
    });

  } finally {
    this.processingId = null;
  }
}
  /* async rejectProof(proof: any): Promise<void> {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Rechazar comprobante',
      input: 'text',
      inputPlaceholder: 'Motivo del rechazo',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    this.processingId = proof.id;

    try {
      await this.pb.collection(this.collectionName).update(proof.id, {
        status: 'rejected',
        adminNotes: result.value || 'Comprobante rechazado',
        validatedAt: new Date().toISOString()
      }, { requestKey: null });

      const profileId = proof[this.relationField];

      if (profileId) {
        await this.pb.collection(this.profileCollectionName).update(profileId, {
          pendingSubscriptionStatus: '',
          pendingSubscriptionPlanId: '',
          pendingSubscriptionPlanName: '',
          pendingSubscriptionRequestedAt: ''
        }, { requestKey: null });
      }

      await this.loadProofs();

    } catch (error) {
      console.error('Error rechazando comprobante:', error);
    } finally {
      this.processingId = null;
    }
  } */
async rejectProof(proof: any): Promise<void> {
  const result = await Swal.fire({
    icon: 'warning',
    title: 'Rechazar comprobante',
    input: 'text',
    inputPlaceholder: 'Motivo del rechazo',
    showCancelButton: true,
    confirmButtonText: 'Rechazar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  this.processingId = proof.id;

  try {
    if (this.target === 'wallet') {
      await this.pb.collection('wallet_recharge_proofs').update(proof.id, {
        status: 'rejected',
        adminNotes: result.value || 'Comprobante rechazado',
        validatedAt: new Date().toISOString()
      }, { requestKey: null });

      await this.loadProofs();

      Swal.fire({
        icon: 'success',
        title: 'Recarga rechazada',
        timer: 1300,
        showConfirmButton: false
      });

      return;
    }

    await this.pb.collection(this.collectionName).update(proof.id, {
      status: 'rejected',
      adminNotes: result.value || 'Comprobante rechazado',
      validatedAt: new Date().toISOString()
    }, { requestKey: null });

    const profileId = proof[this.relationField];

    if (profileId) {
      await this.pb.collection(this.profileCollectionName).update(profileId, {
        pendingSubscriptionStatus: '',
        pendingSubscriptionPlanId: '',
        pendingSubscriptionPlanName: '',
        pendingSubscriptionRequestedAt: ''
      }, { requestKey: null });
    }

    await this.loadProofs();

    Swal.fire({
      icon: 'success',
      title: 'Comprobante rechazado',
      timer: 1300,
      showConfirmButton: false
    });

  } catch (error: any) {
    console.error('Error rechazando comprobante:', error);

    Swal.fire({
      icon: 'error',
      title: 'No se pudo rechazar',
      text: error?.message || 'Revisa permisos y datos del comprobante.'
    });

  } finally {
    this.processingId = null;
  }
}
  getProofFileUrl(proof: any): string {
  const file = this.target === 'wallet'
    ? proof.proofImage
    : proof.proofFile;

  return this.pb.files.getUrl(proof, file);
}
}