import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
forgotForm: FormGroup;
  message: string = '';
  error: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthPocketbaseService
  ) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  async onSubmit() {
    const { email } = this.forgotForm.value;
    this.message = '';
    this.error = '';

    try {
      await this.authService.requestPasswordReset(email);
      this.message = 'Se ha enviado un enlace de restablecimiento a tu correo electrónico.';
    } catch (error) {
      this.error = 'No se pudo enviar el enlace. Verifica tu correo electrónico.';
    }
  }
}