import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = new BehaviorSubject<Toast[]>([]);
  toasts$ = this._toasts.asObservable();

  show(message: string, type: Toast['type'] = 'info') {
    const current = this._toasts.value;
    const toast = { message, type };

    this._toasts.next([...current, toast]);

    setTimeout(() => {
      this._toasts.next(this._toasts.value.filter(t => t !== toast));
    }, 3000);
  }
}