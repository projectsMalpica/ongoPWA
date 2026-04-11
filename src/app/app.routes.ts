import { Routes } from '@angular/router';

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
    path: '**',
    redirectTo: 'register'
  }
];