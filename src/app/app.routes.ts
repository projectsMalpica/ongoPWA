import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { RegisterComponent } from './components/register/register';
import { LoginComponent } from './components/login/login';
import { Profile } from './components/profile/profile';
import { ProfileLocal } from './components/profile-local/profile-local';
import { Favorites } from './components/favorites/favorites';
import { Chat } from './components/chat/chat';
import { ChatDetail } from './components/chat-detail/chat-detail';
import { ForgotPassword } from './components/forgot-password/forgot-password';
import { ResetPassword } from './components/reset-password/reset-password';
import { Maps } from './components/maps/maps';
import { Explorer } from './components/explorer/explorer';
import { Detailprofile } from './components/detailprofile/detailprofile';
import { Detailprofilelocal } from './components/detailprofilelocal/detailprofilelocal';
import { Wallet } from './components/wallet/wallet';
import { WalletHistory } from './components/wallet-history/wallet-history';


export const routes: Routes = [
  {
    path: '',
    redirectTo: 'register',
    pathMatch: 'full'
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/register/register').then(c => c.RegisterComponent),
    title: 'Register'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login/login').then(c => c.LoginComponent),
    title: 'Login'
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./components/home/home').then(c => c.Home),
    title: 'Ongo'
  },
  {
    path: 'home-local',
    loadComponent: () =>
      import('./components/home-local/home-local').then(c => c.HomeLocal),
    title: 'Ongo local'
  },
  {
    path: 'maps',
    loadComponent: () =>
      import('./components/maps/maps').then(c => c.Maps),
    title: 'Mapas'
  },
  {
    path: 'explorer',
    loadComponent: () =>
      import('./components/explorer/explorer').then(c => c.Explorer),
    title: 'Explorar'
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./components/profile/profile').then(c => c.Profile),
    title: 'Perfil'
  },
  {
    path: 'profile-local',
    loadComponent: () =>
      import('./components/profile-local/profile-local').then(c => c.ProfileLocal),
    title: 'Perfil local'
  },
  {
    path: 'detailprofile',
    loadComponent: () =>
      import('./components/detailprofile/detailprofile').then(c => c.Detailprofile),
    title: 'Perfil'
  },
  {
    path: 'detailprofilelocal',
    loadComponent: () =>
      import('./components/detailprofilelocal/detailprofilelocal').then(c => c.Detailprofilelocal),
    title: 'Perfil local'
  },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./components/favorites/favorites').then(c => c.Favorites),
    title: 'Favoritos'
  },
  {
    path: 'chat',
    loadComponent: () =>
      import('./components/chat/chat').then(c => c.Chat),
    title: 'Chat'
  },
  {
    path: 'chat-detail/:id',
    loadComponent: () =>
      import('./components/chat-detail/chat-detail').then(c => c.ChatDetail),
    title: 'Detalle chat'
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./components/forgot-password/forgot-password').then(c => c.ForgotPassword),
    title: 'Recuperar contraseña'
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./components/reset-password/reset-password').then(c => c.ResetPassword),
    title: 'Reset password'
  },
  {
    path: 'wallet-history',
    loadComponent: () =>
      import('./components/wallet-history/wallet-history').then(c => c.WalletHistory),
    title: 'Historial'
  },
  {
    path: 'wallet',
    loadComponent: () =>
      import('./components/wallet/wallet').then(c => c.Wallet),
    title: 'Wallet'
  },
  {
    path: '**',
    redirectTo: 'register'
  }
];