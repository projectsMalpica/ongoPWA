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

  private userId = '';
  chatReceiverId: string = '';

  constructor() {
    this.restoreSession();
  }

  restoreSession() {
    const token = localStorage.getItem('accessToken');
    const recordString =
      localStorage.getItem('record') ||
      localStorage.getItem('user');

    if (token && recordString) {
      try {
        const record = JSON.parse(recordString);
        this.pb.authStore.save(token, record);
        this.userId = record.id;
      } catch (error) {
        console.warn('[ChatPocketbaseService] No se pudo restaurar sesión:', error);
      }
    }

    if (this.pb.authStore.model?.id) {
      this.userId = this.pb.authStore.model.id;
    }

    if (!this.userId) {
      this.userId = localStorage.getItem('userId') || '';
    }
  }

  getCurrentUserId(): string {
    this.restoreSession();
    return this.userId;
  }

  async getUserById(userId: string) {
    try {
      return await this.pb.collection('users').getOne(userId);
    } catch (error) {
      console.warn('[ChatPocketbaseService] No se pudo cargar usuario:', userId);
      return null;
    }
  }

  async loadConversations() {
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId) {
      console.warn('[ChatPocketbaseService] No hay usuario para cargar conversaciones');
      this.conversationsSubject.next([]);
      return;
    }

    try {
      const messages = await this.pb.collection('messages').getFullList({
        filter: `sender="${currentUserId}" || receiver="${currentUserId}"`,
        sort: '-created'
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
      console.error('[ChatPocketbaseService] Error cargando conversaciones:', error);
      this.conversationsSubject.next([]);
    }
  }

  async initRealtime(receiverId: string) {
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId) return;

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

  async sendMessage(receiverId: string, text: string) {
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId || !receiverId || !text?.trim()) {
      console.warn('[ChatPocketbaseService] No se puede enviar mensaje', {
        currentUserId,
        receiverId,
        text
      });
      return;
    }

    try {
      const record = await this.pb.collection('messages').create({
        text: text.trim(),
        sender: currentUserId,
        receiver: receiverId
      });

      const current = this.messagesSubject.getValue();
      const exists = current.some(msg => msg.id === record.id);

      if (!exists) {
        this.messagesSubject.next([...current, record]);
      }

      await this.loadConversations();

      console.log('[ChatPocketbaseService] Mensaje enviado:', record);

      return record;
    } catch (error) {
      console.error('[ChatPocketbaseService] Error enviando mensaje:', error);
      throw error;
    }
  }

  async loadMessages(receiverId: string) {
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId || !receiverId) {
      console.warn('[ChatPocketbaseService] Falta currentUserId o receiverId', {
        currentUserId,
        receiverId
      });

      this.messagesSubject.next([]);
      return;
    }

    try {
      this.chatReceiverId = receiverId;

      await this.initRealtime(receiverId);

      const res = await this.pb.collection('messages').getFullList({
        filter: `(sender="${currentUserId}" && receiver="${receiverId}") || (sender="${receiverId}" && receiver="${currentUserId}")`,
        sort: 'created'
      });

      this.messagesSubject.next(res);

      console.log(`[ChatPocketbaseService] Mensajes cargados (${res.length})`);
    } catch (error) {
      console.error('[ChatPocketbaseService] Error cargando mensajes:', error);
      this.messagesSubject.next([]);
    }
  }

  async login(email: string, password: string) {
    try {
      const authData = await this.pb.collection('users').authWithPassword(email, password);

      this.userId = authData.record.id;

      localStorage.setItem('accessToken', authData.token);
      localStorage.setItem('record', JSON.stringify(authData.record));
      localStorage.setItem('userId', authData.record.id);

      console.log('[ChatPocketbaseService] Login exitoso:', authData);
    } catch (error) {
      console.error('[ChatPocketbaseService] Error al iniciar sesión:', error);
    }
  }

  async logout() {
    await this.pb.collection('messages').unsubscribe('*');
    this.pb.authStore.clear();

    this.userId = '';
    this.messagesSubject.next([]);
    this.conversationsSubject.next([]);

    localStorage.removeItem('accessToken');
    localStorage.removeItem('record');
    localStorage.removeItem('userId');

    console.log('[ChatPocketbaseService] Sesión cerrada');
  }
}