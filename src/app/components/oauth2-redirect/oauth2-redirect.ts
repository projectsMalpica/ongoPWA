import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import PocketBase from 'pocketbase';
@Component({
  selector: 'app-oauth2-redirect',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#10051f;color:white;text-align:center;padding:24px;">
      <div>
        <div class="loader"></div>
        <h2>Conectando con Google...</h2>
        <p>Estamos validando tu cuenta.</p>
      </div>
    </div>
  `,
  styles: [`
    .loader {
      width: 58px;
      height: 58px;
      margin: 0 auto 20px;
      border-radius: 50%;
      border: 4px solid rgba(255,255,255,.2);
      border-top-color: #f70192;
      animation: spin .9s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class Oauth2Redirect implements OnInit {
  private pb = new PocketBase('https://db.ongomatch.com:8090');

  constructor(private router: Router) {}

  async ngOnInit() {
    try {
      const providerRaw = localStorage.getItem('oauth2_provider');
      const type = localStorage.getItem('oauth2_type') as 'client' | 'partner';

      if (!providerRaw || !type) {
        throw new Error('No se encontró información OAuth.');
      }

      const provider = JSON.parse(providerRaw);

      const params = new URLSearchParams(window.location.search);

      const code = params.get('code');
      const state = params.get('state');

      if (!code || !state) {
        throw new Error('Google no devolvió code/state.');
      }

      const redirectUrl = window.location.origin + '/oauth2-redirect';

      const authData = await this.pb.collection('users').authWithOAuth2Code(
        provider.name,
        code,
        provider.codeVerifier,
        redirectUrl
      );

      const user = authData.record;
      const token = authData.token;

      if (!user?.id || !user?.['email']) {
        throw new Error('Google autenticó, pero no devolvió usuario válido.');
      }

      // Guardar tipo en users
      await this.pb.collection('users').update(user.id, {
        name: user['name'] || user['username'] || user['email'].split('@')[0],
        username: user['username'] || user['email'].split('@')[0],
        emailVisibility: true,
        type: [type]
      });

      const refreshed = await this.pb.collection('users').authRefresh();

      const finalUser = {
        ...refreshed.record,
        type
      };

      localStorage.setItem('accessToken', this.pb.authStore.token || token || '');
      localStorage.setItem('userId', finalUser.id);
      localStorage.setItem('user', JSON.stringify(finalUser));
      localStorage.setItem('record', JSON.stringify(refreshed.record));
      localStorage.setItem('type', type);
      localStorage.setItem('isLoggedin', 'true');

      localStorage.removeItem('oauth2_provider');
      localStorage.removeItem('oauth2_type');

      // Volver al registro para completar perfil
      await this.router.navigate(['/register'], {
        queryParams: {
          google: 'true',
          userId: finalUser.id,
email: (finalUser as any)['email'],
          type
        }
      });

    } catch (error) {
      console.error('Error OAuth redirect:', error);
      await this.router.navigate(['/register']);
    }
  }
}