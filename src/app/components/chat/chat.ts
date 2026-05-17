import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { ChatPocketbaseService } from '../../services/chat.service';
import { RecordModel } from 'pocketbase';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class Chat {
  conversations: any[] = [];
  currentUserId: string = '';

  constructor(
    public global: GlobalService,
    public chatService: ChatPocketbaseService
  ) {
    this.currentUserId = this.chatService.getCurrentUserId();
  }

  async ngOnInit(): Promise<void> {
    this.chatService.conversations$.subscribe((conversations) => {
      this.conversations = conversations;
    });

    await this.chatService.loadConversations();
  }

  openChat(conversation: any) {
    this.chatService.chatReceiverId = conversation.userId;
    this.global.activeRoute = 'chat-detail';
  }
}
