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

      const otherUserId = senderId === currentUserId
        ? receiverId
        : senderId;

      if (!map.has(otherUserId)) {
        const profile = await this.getUserProfile(otherUserId);

        map.set(otherUserId, {
          userId: otherUserId,
          user: profile,
          profile,
          name:
            profile?.name ||
            profile?.venueName ||
            profile?.username ||
            'Usuario',
          avatar:
            profile?.avatar ||
            profile?.avatarUrl ||
            profile?.photo ||
            profile?.image ||
            profile?.photos?.[0] ||
            '../assets/images/user/pic1.jpg',
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
  const currentUserId = await this.resolveUserId(this.getCurrentUserId());
  const realReceiverId = await this.resolveUserId(receiverId);

  if (!currentUserId || !realReceiverId) return;

  await this.pb.collection('messages').unsubscribe('*');

  await this.pb.collection('messages').subscribe('*', async (event) => {
    if (event.action !== 'create') return;

    const record = event.record;

    const involved = [
      record['sender'],
      record['receiver']
    ];

    if (
      involved.includes(currentUserId) &&
      involved.includes(realReceiverId)
    ) {
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

async markMessagesAsRead(senderId: string) {
  const currentUserId = await this.resolveUserId(this.getCurrentUserId());
  const realSenderId = await this.resolveUserId(senderId);

  if (!currentUserId || !realSenderId) return;

  const unreadMessages = await this.pb.collection('messages').getFullList({
    filter: `sender="${realSenderId}" && receiver="${currentUserId}" && read=false`
  });

  for (const msg of unreadMessages) {
    await this.pb.collection('messages').update(msg.id, {
      read: true,
      readAt: new Date().toISOString()
    });
  }

  await this.loadMessages(realSenderId);
}

async sendMessage(receiverId: string, text: string) {
  const currentUserId = await this.resolveUserId(this.getCurrentUserId());
  const realReceiverId = await this.resolveUserId(receiverId);

  if (!currentUserId || !realReceiverId || !text?.trim()) {
    console.warn('[ChatPocketbaseService] No se puede enviar mensaje', {
      currentUserId,
      realReceiverId,
      text
    });
    return;
  }

  try {
    const chatRoomId = [currentUserId, realReceiverId].sort().join('_');

    const record = await this.pb.collection('messages').create({
      idUser: currentUserId,
      text: text.trim(),
      read: false,
      chatRoomId,
      sender: currentUserId,
      receiver: realReceiverId
    });

    await this.pb.collection('notifications').create({
      user: realReceiverId,
      fromUser: currentUserId,
      type: 'message',
      title: 'Nuevo mensaje',
      message: text.trim(),
      read: false
    });

    const current = this.messagesSubject.getValue();
    const exists = current.some(msg => msg.id === record.id);

    if (!exists) {
      this.messagesSubject.next([...current, record]);
    }

    await this.loadConversations();

    return record;

  } catch (error) {
    console.error('[ChatPocketbaseService] Error enviando mensaje:', error);
    throw error;
  }
}

async initConversationsRealtime() {
  const currentUserId = await this.resolveUserId(this.getCurrentUserId());

  if (!currentUserId) return;

  await this.pb.collection('messages').unsubscribe('*');

  await this.pb.collection('messages').subscribe('*', async (event) => {
    const record = event.record;

    const involved = [
      record['sender'],
      record['receiver']
    ];

    if (involved.includes(currentUserId)) {
      await this.loadConversations();
    }
  });
}
  async loadMessages(receiverId: string) {
  const currentUserId = await this.resolveUserId(this.getCurrentUserId());
  const realReceiverId = await this.resolveUserId(receiverId);

  if (!currentUserId || !realReceiverId) {
    console.warn('[ChatPocketbaseService] Falta currentUserId o receiverId', {
      currentUserId,
      realReceiverId
    });

    this.messagesSubject.next([]);
    return;
  }

  try {
    this.chatReceiverId = realReceiverId;

    await this.initRealtime(realReceiverId);

    const res = await this.pb.collection('messages').getFullList({
      filter: `(sender="${currentUserId}" && receiver="${realReceiverId}") || (sender="${realReceiverId}" && receiver="${currentUserId}")`,
      sort: 'created'
    });

    this.messagesSubject.next(res);

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
  async getUserInfo(userId: string): Promise<any> {
  if (!userId) return null;

  try {
    return await this.pb.collection('users').getOne(userId);
  } catch {}

  try {
    return await this.pb.collection('usuariosClient').getOne(userId);
  } catch {}

  try {
    return await this.pb.collection('usuariosPartner').getOne(userId);
  } catch {}

  console.warn('No se pudo cargar usuario:', userId);
  return null;
}
async resolveUserId(id: string): Promise<string> {
  if (!id) return '';

  // 1. Si ya es users.id
  try {
    const user = await this.pb.collection('users').getOne(id);
    if (user?.id) return user.id;
  } catch {}

  // 2. Si es usuariosClient.id
  try {
    const client = await this.pb.collection('usuariosClient').getOne(id);
    if (client?.['userId']) return client['userId'];
  } catch {}

  // 3. Si es usuariosPartner.id
  try {
    const partner = await this.pb.collection('usuariosPartner').getOne(id);
    if (partner?.['userId']) return partner['userId'];
  } catch {}

  return id;
}

async getUserProfile(userId: string): Promise<any> {
  const realUserId = await this.resolveUserId(userId);

  try {
    return await this.pb
      .collection('usuariosClient')
      .getFirstListItem(`userId="${realUserId}"`);
  } catch {}

  try {
    return await this.pb
      .collection('usuariosPartner')
      .getFirstListItem(`userId="${realUserId}"`);
  } catch {}

  try {
    return await this.pb.collection('users').getOne(realUserId);
  } catch {}

  return null;
}
}