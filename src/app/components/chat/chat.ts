import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { ChatPocketbaseService } from '../../services/chat.service';
import { RecordModel } from 'pocketbase';
import { Router } from '@angular/router';
import { ChangeDetectorRef, NgZone, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  conversations: any[] = [];
  /* currentUserId: string = ''; */
  currentUserId = '';
  private conversationsSub?: Subscription;
  constructor(
    public global: GlobalService,
    public chatService: ChatPocketbaseService,
    public router: Router,
     private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.currentUserId = this.chatService.getCurrentUserId();
  }

  async ngOnInit(): Promise<void> {
    this.conversationsSub = this.chatService.conversations$.subscribe((conversations) => {
      this.ngZone.run(() => {
        this.conversations = conversations.map((conversation: any) => {
          const user = conversation.user || conversation.profile || {};

          return {
            ...conversation,
            name:
              user.name ||
              user.username ||
              user.venueName ||
              conversation.name ||
              'Usuario',
            avatar:
              user.avatar ||
              user.avatarUrl ||
              user.photo ||
              user.image ||
              user.photos?.[0] ||
              '../assets/images/user/pic1.jpg'
          };
        });

        this.cdr.detectChanges();
      });
    });

    await this.chatService.loadConversations();
    await this.chatService.initConversationsRealtime();
  }

  ngOnDestroy() {
    this.conversationsSub?.unsubscribe();
  }


 async openChat(conversation: any) {
    const receiverId =
      conversation.userId ||
      conversation.receiverId ||
      conversation.senderId;

    const realReceiverId = await this.chatService.resolveUserId(receiverId);

    this.chatService.chatReceiverId = realReceiverId;
    this.global.chatReceiverId = realReceiverId;

    await this.router.navigate(['/chat-detail', realReceiverId]);
  }
}
