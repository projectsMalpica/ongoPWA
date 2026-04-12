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
  messages: RecordModel[] = [];
  currentUserId: string = '';
constructor(public global: GlobalService,
  public chatService: ChatPocketbaseService
) {
  this.currentUserId = this.chatService.getCurrentUserId();
}

ngOnInit(): void {
  this.chatService.messages$.subscribe((messages) => {
    this.messages = messages;
  });
}
}
