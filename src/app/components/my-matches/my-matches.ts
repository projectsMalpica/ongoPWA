import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import PocketBase from 'pocketbase';
import { RouterModule } from '@angular/router';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';

@Component({
  selector: 'app-my-matches',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './my-matches.html',
  styleUrl: './my-matches.scss'
})
export class MyMatches implements OnInit {
  pb!: PocketBase;

  loading = false;
  error = '';
  matches: any[] = [];

  currentUser: any = null;
  currentProfile: any = null;

  constructor(private auth: AuthPocketbaseService, private cdr: ChangeDetectorRef) {
    this.pb = this.auth.pb;
  }

  async ngOnInit() {
    await this.loadMatches();
          this.cdr.detectChanges();

  }

 async loadMatches() {
  this.loading = true;
  this.error = '';

  try {
    await this.auth.restoreSession();

    const user = this.auth.getCurrentUser?.() || this.auth.currentUser;

    if (!user?.id) {
      this.error = 'Debes iniciar sesión.';
      return;
    }

    const records = await this.pb.collection('matches').getFullList({
      filter: `(userAAuthId="${user.id}" || userBAuthId="${user.id}") && status="active"`,
      sort: '-updated',
      expand: 'userA,userB',
      requestKey: null
    });

    this.matches = records.map((match: any) => {
      const isUserA = match.userAAuthId === user.id;

      const otherProfile = isUserA
        ? match.expand?.userB
        : match.expand?.userA;

      const otherAuthId = isUserA
        ? match.userBAuthId
        : match.userAAuthId;

      return {
        id: match.id,
        profileId: otherProfile?.id || '',
        chatUserId: otherAuthId,
        name: otherProfile?.name || 'Usuario',
        age: otherProfile?.age || '',
        avatar: otherProfile?.avatar || 'assets/images/avatar/1.jpg',
        address: otherProfile?.address || match.partnerName || 'Cerca de ti',
        partnerName: match.partnerName || '',
        insideSameLocal: !!match.insideSameLocal,
        created: match.created,
        updated: match.updated,
        lastMessage: match.lastMessage || ''
      };
    });

  } catch (error: any) {
    console.error('Error cargando matches:', error);
    this.error = error?.message || 'No se pudieron cargar los matches.';
  } finally {
    this.loading = false;
  }
}
}