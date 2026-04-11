import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Terms } from '../terms/terms';
import { Privacy } from '../privacy/privacy';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Renderer2 } from '@angular/core';
import Swal from 'sweetalert2';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { GlobalService } from '../../services/global.service';
import { ChatPocketbaseService } from '../../services/chat.service';
type UserType = 'admin' | 'partner'  | 'client';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Terms, Privacy ],  
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  loginForm: FormGroup;
  showModal: boolean = false;
  loading = false;
  modalTitle: string = '';
  modalContent: 'terms' | 'privacy' | null = null;
showPassword = false;
  constructor(
    private fb: FormBuilder,
    private auth: AuthPocketbaseService,
    public global: GlobalService,
    public chatService: ChatPocketbaseService,
    private renderer: Renderer2
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      remember: [false]
    });
    //, { updateOn: 'submit' });
    
  }
togglePassword(): void {
  this.showPassword = !this.showPassword;
}
  openTermsModal(type: 'terms' | 'privacy') {
    console.log('Opening modal with type:', type);
    this.modalContent = type;
    switch (type) {
      case 'terms':
        this.modalTitle = 'Términos y Condiciones';
        break;
      case 'privacy':
        this.modalTitle = 'Política de Privacidad';
        break;
    }
    this.showModal = true;
    console.log('Modal state:', { showModal: this.showModal, modalTitle: this.modalTitle, modalContent: this.modalContent });
  }

  closeModal() {
    this.showModal = false;
    this.modalContent = null;
  }

   onSubmit() {
    if (this.loginForm.invalid) return;
  
    const { email, password } = this.loginForm.value;
  
    this.auth.loginUser(email, password).subscribe({
      next: async () => {
        await this.auth.permision();
        await this.global.loadProfile();
        await this.global.initClientesRealtime();
        await this.global.initPartnersRealtime();
      },
      error: (error) => {
        console.error('Error en el login:', error);
        Swal.fire({
          title: 'Error',
          text: 'Correo o contraseña incorrectos',
          icon: 'error',
          confirmButtonText: 'Entendido'
        });
      }
    });
  }
  
    goToForgotPassword() {
      this.global.setRoute?.('forgot-password');
    }


async handleGoogleLogin() {
  try {
    this.loading = true;

    const user = await this.auth.loginWithGoogle();
    await this.auth.saveUserLocation?.();

    if (!user) {
      Swal.fire('Error', 'No se pudo iniciar sesión con Google.', 'error');
      return;
    }

    if (!user.type) {
      Swal.fire('Usuario inválido', 'La cuenta no tiene un tipo asignado.', 'warning');
      await this.auth.logoutUser();
      this.global.setRoute('register');
      return;
    }

    await this.global.loadProfile();
    await this.global.initClientesRealtime();
    await this.global.initPartnersRealtime();
    await this.auth.permision();

  } catch (error: unknown) {
    console.error('Error al iniciar sesión con Google:', error);

    Swal.fire({
      title: 'Error',
      text: error instanceof Error ? error.message : 'No se pudo iniciar sesión con Google.',
      icon: 'error',
      confirmButtonText: 'Entendido'
    });
  } finally {
    this.loading = false;
  }
}
}
