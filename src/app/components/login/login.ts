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
          const authRecord = this.auth.pb?.authStore?.record;

          const userType = String(
            res?.record?.type ||
            authRecord?.['type'] ||
            ''
          ).trim().toLowerCase();

          console.log('LOGIN RES:', res);
          console.log('AUTH RECORD:', authRecord);
          console.log('USER TYPE LOGIN:', userType);

          if (userType === 'admin') {
            await this.router.navigateByUrl('/admin');
            return;
          }

          if (userType === 'partner') {
            await this.global.loadProfile();
            await this.global.initPartnersRealtime();
            await this.router.navigateByUrl('/home-local');
            return;
          }

          if (userType === 'client') {
            await this.global.loadProfile();
            await this.global.initClientesRealtime();
            await this.router.navigateByUrl('/maps');
            return;
          }

          Swal.fire({
            icon: 'warning',
            title: 'Tipo de usuario no válido',
            text: `El usuario tiene type="${userType}". Debe ser admin, partner o client.`
          });

        } catch (error) {
          console.error('Error en post-login:', error);
        }
      },
      error: async (error) => {
        console.error('Error en el login:', error);

        const result = await Swal.fire({
          icon: 'warning',
          title: 'Cuenta no encontrada',
          text: 'No pudimos iniciar sesión. Puedes registrarte para continuar.',
          showCancelButton: true,
          confirmButtonText: 'Registrarme',
          cancelButtonText: 'Intentar de nuevo'
        });

        if (result.isConfirmed) {
          await this.router.navigate(['/register'], {
            queryParams: {
              email: this.loginForm.value.email
            }
          });
        }
      }
    });
  }

  goToForgotPassword() {
    this.router.navigate(['/forgot-password']);
  }


  async handleGoogleLogin() {
    this.loading = true;

    try {

      const result = await this.auth.loginWithGoogle();

      console.log('Google result:', result);

      if (result?.needsRegister) {

        this.loading = false;

        await this.router.navigate(['/register'], {
          queryParams: {
            google: 'true',
            userId: result.user.id,
            email: result.user.email,
            name: result.user.name,
            type: result.user.type || ''
          }
        });

        return;
      }

      if (result.type === 'admin') {
        await this.router.navigate(['/admin']);
        return;
      }

      await this.global.loadProfile();

      if (result.type === 'partner') {
        await this.router.navigate(['/home-local']);

      } else {
        await this.router.navigate(['/maps']);
      }

    } catch (error: any) {

      console.error('Error Google Login:', error);

      Swal.fire({
        icon: 'error',
        title: 'Error con Google',
        text: error?.message || 'No se pudo iniciar sesión con Google'
      });

    } finally {

      this.loading = false;
    }
  }
}
