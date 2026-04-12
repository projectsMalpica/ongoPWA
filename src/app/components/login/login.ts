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
import { Router } from '@angular/router';
type UserType = 'admin' | 'partner' | 'client';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Terms, Privacy],
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
    private renderer: Renderer2,
    public router: Router
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
      next: async (res: any) => {
        try {
          await this.global.loadProfile();
          await this.global.initClientesRealtime();
          await this.global.initPartnersRealtime();

          const userType = res?.record?.type || this.auth.pb?.authStore?.record?.['type'];

          if (userType === 'partner') {
            await this.router.navigate(['/home-local']);
          } else if (userType === 'admin') {
            await this.router.navigate(['/admin']);
          } else {
            await this.router.navigate(['/home']);
          }
        } catch (error) {
          console.error('Error en post-login:', error);
        }
      },
      error: (error) => {
        console.error('Error en el login:', error);
      }
    });
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }


  async handleGoogleLogin() {
  try {
    this.loading = true;

    const user = await this.auth.loginWithGoogle();

    if (!user) return;

    await this.global.loadProfile();
    await this.global.initClientesRealtime();
    await this.global.initPartnersRealtime();

    if (user.type === 'partner') {
      await this.router.navigate(['/home-local']);
    } else if (user.type === 'admin') {
      await this.router.navigate(['/admin']);
    } else {
      await this.router.navigate(['/home']);
    }

  } catch (error) {
    console.error(error);
  } finally {
    this.loading = false;
  }
}
}
