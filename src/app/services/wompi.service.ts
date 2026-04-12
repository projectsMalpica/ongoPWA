import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

declare global {
  interface Window { WidgetCheckout: any; }
}

@Injectable({ providedIn: 'root' })
export class WompiService {
  private scriptLoaded = false;
  private scriptLoading?: Promise<void>;
  publicKey?: string;
  /** Carga el script si hace falta (útil si no lo pusiste en index.html) */
  private ensureScript(): Promise<void> {
    if (this.scriptLoaded) return Promise.resolve();
    if (this.scriptLoading) return this.scriptLoading;

    this.scriptLoading = new Promise<void>((resolve, reject) => {
      if (window.WidgetCheckout) {
        this.scriptLoaded = true; resolve(); return;
      }
      const s = document.createElement('script');
      s.src = 'https://checkout.wompi.co/widget.js';
      s.async = true;
      s.onload = () => { this.scriptLoaded = true; resolve(); };
      s.onerror = () => reject(new Error('No se pudo cargar widget.js de Wompi'));
      document.head.appendChild(s);
    });

    return this.scriptLoading;
  }


async openCheckout(options: {
  amountInCents: number;
  reference: string;
  currency?: 'COP';
  customerEmail?: string;
  signature?: string;
  expirationTime?: string;
  publicKey?: string;
  redirectUrl?: string;
}): Promise<any> {
  await this.ensureScript();

  const pk = options.publicKey ?? environment.WOMPI_PUBLIC_KEY;

  if (!pk) {
    console.error('WOMPI_PUBLIC_KEY faltante');
    throw new Error('Falta WOMPI_PUBLIC_KEY');
  }

  const base: any = {
    currency: options.currency ?? 'COP',
    amountInCents: options.amountInCents,
    reference: options.reference,
    publicKey: pk,
  };

  if (options.signature) {
    base.signature = { integrity: options.signature };
  }

  if (options.redirectUrl) {
    base.redirectUrl = options.redirectUrl;
  }

  if (options.expirationTime) {
    base.expirationTime = options.expirationTime;
  }

  if (options.customerEmail) {
    base.customerData = { email: options.customerEmail };
  }

  console.log('Wompi base config:', base);

  const checkout = new window.WidgetCheckout(base);

  return new Promise((resolve, reject) => {
    try {
      checkout.open((result: any) => {
        console.log('Wompi callback result:', result);
        resolve(result);
      });
    } catch (err) {
      reject(err);
    }
  });
}
}
