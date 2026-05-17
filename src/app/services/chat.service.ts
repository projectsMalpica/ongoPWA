import { Injectable } from "@angular/core";
import PocketBase, { RecordModel } from "pocketbase";
import { BehaviorSubject } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ChatPocketbaseService {
  public pb = new PocketBase('https://db.ongomatch.com:8090');

  public messagesSubject = new BehaviorSubject<RecordModel[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  public conversationsSubject = new BehaviorSubject<any[]>([]);
  public conversations$ = this.conversationsSubject.asObservable();

  chatReceiverId = '';

  constructor() {
    this.restoreSession();
  }

  restoreSession() {
    const token = localStorage.getItem('accessToken');
    const recordString = localStorage.getItem('record') || localStorage.getItem('user');

    if (token && recordString) {
      try {
        const record = JSON.parse(recordString);
        this.pb.authStore.save(token, record);
      } catch (error) {
        console.warn('[Chat] No se pudo restaurar sesión:', error);
      }
    }
  }

  getCurrentUserId(): string {
    this.restoreSession();

    return (
      this.pb.authStore.record?.id ||
      this.pb.authStore.model?.id ||
      localStorage.getItem('userId') ||
      ''
    );
  }

  async getUserById(userId: string) {
    try {
      return await this.pb.collection('users').getOne(userId);
    } catch {
      return null;
    }
  }

  async loadConversations() {
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId) {
      this.conversationsSubject.next([]);
      return;
    }

    try {
      const messages = await this.pb.collection('messages').getFullList({
        sort: '-created',
        filter: `sender="${currentUserId}" || receiver="${currentUserId}"`
      });

      const map = new Map<string, any>();

      for (const msg of messages) {
        const senderId = msg['sender'];
        const receiverId = msg['receiver'];

        const otherUserId = senderId === currentUserId ? receiverId : senderId;

        if (!map.has(otherUserId)) {
          const otherUser = await this.getUserById(otherUserId);

          map.set(otherUserId, {
            userId: otherUserId,
            user: otherUser,
            lastMessage: msg
          });
        }
      }

      this.conversationsSubject.next(Array.from(map.values()));

    } catch (error) {
      console.error('[Chat] Error cargando conversaciones:', error);
      this.conversationsSubject.next([]);
    }
  }

  async initRealtime(receiverId: string) {
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId || !receiverId) return;

    await this.pb.collection('messages').unsubscribe('*');

    this.pb.collection('messages').subscribe('*', async (event) => {
      if (event.action !== 'create') return;

      const record = event.record;
      const involved = [record['sender'], record['receiver']];

      if (involved.includes(currentUserId) && involved.includes(receiverId)) {
        const current = this.messagesSubject.getValue();
        const exists = current.some(msg => msg.id === record.id);

        if (!exists) {
          this.messagesSubject.next([...current, record]);
        }
      }

      if (involved.includes(currentUserId)) {
        await this.loadConversations();
      }
    });
  }

  async loadMessages(receiverId: string) {
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId || !receiverId) {
      console.warn('[Chat] Falta currentUserId o receiverId', {
        currentUserId,
        receiverId
      });

      this.messagesSubject.next([]);
      return;
    }

    try {
      this.chatReceiverId = receiverId;

      await this.initRealtime(receiverId);

      const messages = await this.pb.collection('messages').getFullList({
        filter: `(sender="${currentUserId}" && receiver="${receiverId}") || (sender="${receiverId}" && receiver="${currentUserId}")`,
        sort: 'created'
      });

      this.messagesSubject.next(messages);

    } catch (error) {
      console.error('[Chat] Error cargando mensajes:', error);
      this.messagesSubject.next([]);
    }
  }

  async sendMessage(receiverId: string, text: string) {
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId || !receiverId || !text.trim()) {
      console.warn('[Chat] No se puede enviar mensaje', {
        currentUserId,
        receiverId,
        text
      });
      return;
    }

    try {
      const record = await this.pb.collection('messages').create({
        idUser: currentUserId,
        text: text.trim(),
        read: false,
        chatRoomId: this.getChatRoomId(currentUserId, receiverId),
        sender: currentUserId,
        receiver: receiverId
      });

      const current = this.messagesSubject.getValue();
      const exists = current.some(msg => msg.id === record.id);

      if (!exists) {
        this.messagesSubject.next([...current, record]);
      }

      await this.loadConversations();

      return record;

    } catch (error) {
      console.error('[Chat] Error enviando mensaje:', error);
      throw error;
    }
  }

  getChatRoomId(userA: string, userB: string): string {
    return [userA, userB].sort().join('_');
  }

  async logout() {
    await this.pb.collection('messages').unsubscribe('*');
    this.pb.authStore.clear();
    this.messagesSubject.next([]);
    this.conversationsSubject.next([]);
  }
}