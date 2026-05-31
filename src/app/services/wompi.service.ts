import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

declare global {
  interface Window {
    WidgetCheckout: any;
  }
}

@Injectable({ providedIn: 'root' })
export class WompiService {
  private scriptLoaded = false;
  private scriptLoading?: Promise<void>;

  private ensureScript(): Promise<void> {
    if (this.scriptLoaded) return Promise.resolve();
    if (this.scriptLoading) return this.scriptLoading;

    this.scriptLoading = new Promise<void>((resolve, reject) => {
      if (window.WidgetCheckout) {
        this.scriptLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.wompi.co/widget.js';
      script.async = true;

      script.onload = () => {
        this.scriptLoaded = true;
        resolve();
      };

      script.onerror = () => {
        reject(new Error('No se pudo cargar widget.js de Wompi'));
      };

      document.head.appendChild(script);
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

    const publicKey = options.publicKey ?? environment.WOMPI_PUBLIC_KEY;

    if (!publicKey) {
      throw new Error('Falta WOMPI_PUBLIC_KEY');
    }

    /* const checkoutConfig: any = {
      currency: options.currency ?? 'COP',
      amountInCents: options.amountInCents,
      reference: options.reference,
      publicKey,
    }; */
    const checkoutConfig: any = {
  currency: options.currency ?? 'COP',
  amountInCents: options.amountInCents,
  reference: options.reference,
  publicKey,
  signature: {
    integrity: options.signature
  }
};

    /* if (options.signature) {
      checkoutConfig['signature:integrity'] = options.signature;
    } */
   if (options.signature) {
  checkoutConfig.signature = {
    integrity: options.signature
  };
}

    if (options.redirectUrl) {
      checkoutConfig.redirectUrl = options.redirectUrl;
    }

    if (options.expirationTime) {
      checkoutConfig.expirationTime = options.expirationTime;
    }

    if (options.customerEmail) {
      checkoutConfig.customerData = {
        email: options.customerEmail
      };
    }

    console.log('Wompi checkout config:', checkoutConfig);

    const checkout = new window.WidgetCheckout(checkoutConfig);

    return new Promise((resolve, reject) => {
      try {
        checkout.open((result: any) => {
          console.log('Wompi callback result:', result);
          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}