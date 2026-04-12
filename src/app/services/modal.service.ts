// modal.service.ts
import { Injectable } from '@angular/core';
import * as bootstrap from 'bootstrap';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modals: {id: string, modal: bootstrap.Modal}[] = [];

  open(id: string) {
    // Cierra todos los modales primero
    this.closeAll();
    
    const modalEl = document.getElementById(id);
    if (modalEl) {
      // Elimina cualquier backdrop existente
      const existingBackdrop = document.querySelector('.modal-backdrop');
      if (existingBackdrop) {
        existingBackdrop.remove();
      }
      
      // Elimina la clase modal-open si existe
      document.body.classList.remove('modal-open');
      
      // Crea nueva instancia del modal
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
      
      // Guarda referencia
      this.modals.push({id, modal});
      
      // Maneja la limpieza al cerrar
      modalEl.addEventListener('hidden.bs.modal', () => {
        this.modals = this.modals.filter(m => m.id !== id);
      });
    }
  }

  close(id: string) {
    const modal = this.modals.find(m => m.id === id);
    if (modal) {
      modal.modal.hide();
    }
  }

  closeAll() {
    this.modals.forEach(m => m.modal.hide());
    this.modals = [];
  }
}