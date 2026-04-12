import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class EmailService {
  private http = inject(HttpClient);
  private baseUrl = environment.emailApiBase; // <- desde environments

  async sendWelcome(opts: {
    toEmail: string;
    toName: string;
    userType: 'client' | 'partner';
    params?: Record<string, any>;
  }) {
    // Lee los IDs desde environment (NO import.meta.env)
    const templateIdMap: Record<'client' | 'partner', number> = {
      client: Number(environment.BREVO_WELCOME_CLIENT),
      partner: Number(environment.BREVO_WELCOME_PARTNER),
    };

    const body = {
      toEmail: opts.toEmail,
      toName: opts.toName,
      templateId: templateIdMap[opts.userType],
      params: {
        firstName: opts.toName,
        dashboardUrl:
          opts.userType === 'client'
            ? 'https://app.ongomatch.com/profile'
            : 'https://app.ongomatch.com/profile-local',
        supportEmail: 'soporte@ongomatch.com',
        ...(opts.params || {})
      }
    };

    // ejemplo: http://localhost:5542/email/welcome
    return firstValueFrom(this.http.post(`${this.baseUrl}/email/welcome`, body));
  }
}
