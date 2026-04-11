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

  private userId = '';
  chatReceiverId: string = '';
  constructor() {
    if (this.pb.authStore.model) {
      this.userId = this.pb.authStore.model['id'];
    }
  }

  getCurrentUserId(): string {
    return this.userId;
  }

  async initRealtime(receiverId: string) {
    if (!this.userId) return;

    await this.pb.collection('messages').unsubscribe('*'); // Limpiar subs previas

    this.pb.collection('messages').subscribe('*', (event) => {
      if (event.action !== 'create') return;
      const record = event.record;
      const involved = [record['sender'], record['receiver']];

      if (involved.includes(this.userId) && involved.includes(receiverId)) {
        const current = this.messagesSubject.getValue();
        this.messagesSubject.next([...current, record]);
      }
    });
  }

  async sendMessage(text: string, receiverId: string) {
    try {
      const record = await this.pb.collection('messages').create({
        text,
        sender: this.userId,
        receiver: receiverId
      });
      // Agregamos el mensaje manualmente (opcional si realtime funciona bien)
      const current = this.messagesSubject.getValue();
      this.messagesSubject.next([...current, record]);
      console.log('[ChatPocketbaseService] Mensaje enviado:', record);
    } catch (error) {
      console.error('[ChatPocketbaseService] Error enviando mensaje:', error);
    }
  }

  async loadMessages(receiverId: string) {
    try {
      await this.initRealtime(receiverId);

      const res = await this.pb.collection('messages').getFullList({
        filter: `(sender="${this.userId}" && receiver="${receiverId}") || (sender="${receiverId}" && receiver="${this.userId}")`,
        sort: '-created'
      });

      this.messagesSubject.next(res.reverse());
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
      console.log('[ChatPocketbaseService] Login exitoso:', authData);
    } catch (error) {
      console.error('[ChatPocketbaseService] Error al iniciar sesión:', error);
    }
  }

  logout() {
    this.pb.authStore.clear();
    console.log('[ChatPocketbaseService] Sesión cerrada');
  }
}
