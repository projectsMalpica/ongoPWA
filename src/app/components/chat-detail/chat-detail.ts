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

@Component({
  selector: 'app-chat-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './chat-detail.html',
  styleUrl: './chat-detail.scss',
})
export class ChatDetail implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('scrollBottom') scrollBottom!: ElementRef;

  form: FormGroup;
  messages: any[] = [];
  currentUserId = '';
  receiverId = '';

  private messagesSub?: Subscription;

  constructor(
    private chatService: ChatPocketbaseService,
    private fb: FormBuilder,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      message: ['']
    });
  }

  async ngOnInit() {
    this.currentUserId = this.chatService.getCurrentUserId();

    this.receiverId =
      this.route.snapshot.paramMap.get('id') ||
      this.chatService.chatReceiverId ||
      '';

    console.log('currentUserId:', this.currentUserId);
    console.log('receiverId:', this.receiverId);

    if (!this.currentUserId || !this.receiverId) {
      console.warn('Falta currentUserId o receiverId');
      return;
    }

    this.chatService.chatReceiverId = this.receiverId;

    await this.chatService.loadMessages(this.receiverId);

    this.messagesSub = this.chatService.messages$.subscribe(messages => {
      this.messages = messages;
      this.scrollToBottom();
    });
  }

  async send() {
    const message = this.form.value.message?.trim();

    if (!message || !this.receiverId) return;

    try {
      await this.chatService.sendMessage(this.receiverId, message);
      this.form.reset();
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