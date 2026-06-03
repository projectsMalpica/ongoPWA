import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatPocketbaseService } from '../../services/chat.service';
import { ChangeDetectorRef, NgZone } from '@angular/core';
@Component({
  selector: 'app-chat-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './chat-detail.html',
  styleUrl: './chat-detail.scss',
})
export class ChatDetail implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollBottom') scrollBottom!: ElementRef;
  receiverProfile: any = null;
  form: FormGroup;
  messages: any[] = [];
  currentUserId = '';
  receiverId = '';
isMatched = false;
currentMatch: any = null;
insideSameLocal = false;
  private messagesSub?: Subscription;

  constructor(
    private chatService: ChatPocketbaseService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  private ngZone: NgZone
  ) {
    this.form = this.fb.group({
      message: ['']
    });
  }

async ngOnInit() {
  this.currentUserId = await this.chatService.resolveUserId(
    this.chatService.getCurrentUserId()
  );

  const rawReceiverId =
    this.route.snapshot.paramMap.get('id') ||
    this.chatService.chatReceiverId ||
    '';

  this.receiverId = await this.chatService.resolveUserId(rawReceiverId);
  if (!this.currentUserId || !this.receiverId) {
    console.warn('Falta currentUserId o receiverId');
    return;
  }
    this.isMatched = await this.checkMatchStatus();

  this.chatService.chatReceiverId = this.receiverId;

  this.messagesSub = this.chatService.messages$.subscribe(messages => {
    this.ngZone.run(() => {
      this.messages = [...messages];
      this.cdr.detectChanges();
      this.scrollToBottom();
    });
  });

  this.receiverProfile = await this.chatService.getUserProfile(this.receiverId);
  this.receiverProfile = await this.chatService.getUserProfile(this.receiverId);

await this.chatService.loadMessages(this.receiverId);
await this.chatService.markMessagesAsRead(this.receiverId);

this.cdr.detectChanges();
}
async checkMatchStatus(): Promise<boolean> {
  try {
    const match = await this.chatService.pb
      .collection('matches')
      .getFirstListItem(
        `
        (
          userAAuthId="${this.currentUserId}" && userBAuthId="${this.receiverId}"
        ) || (
          userAAuthId="${this.receiverId}" && userBAuthId="${this.currentUserId}"
        )
        `,
        {
          requestKey: null
        }
      );

    this.currentMatch = match;
    this.insideSameLocal = !!match['insideSameLocal'];

    return match['status'] === 'active';

  } catch (error) {
    this.currentMatch = null;
    this.insideSameLocal = false;
    return false;
  }
}
 async send() {
  const message = this.form.value.message?.trim();

  if (!message || !this.receiverId) return;

  this.form.patchValue({ message: '' });

  try {
    await this.chatService.sendMessage(this.receiverId, message);
    this.form.reset({ message: '' });
    this.cdr.detectChanges();
  } catch (error) {
    console.error('No se pudo enviar el mensaje:', error);
  }
}

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.messagesSub?.unsubscribe();
  }

  scrollToBottom() {
    setTimeout(() => {
      this.scrollBottom?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}