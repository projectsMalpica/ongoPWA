import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from './NotificationsService.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let collection: any;
  let realtimeHandler: ((event: any) => void) | undefined;

  beforeEach(() => {
    localStorage.clear();
    realtimeHandler = undefined;
    collection = {
      getFullList: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockImplementation((id, data) => Promise.resolve({ id, user: 'u1', title: 'T', message: 'M', type: 'test_notification', created: '', ...data })),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockImplementation((_topic, handler) => {
        realtimeHandler = handler;
        return Promise.resolve(() => undefined);
      })
    };
    service = new NotificationsService({ pb: { collection: vi.fn().mockReturnValue(collection) } } as any);
  });

  it('loads only the authenticated user history sorted newest first', async () => {
    await service.initRealtimeNotifications('u1');
    expect(collection.getFullList).toHaveBeenCalledWith(expect.objectContaining({
      filter: 'user="u1"', sort: '-created'
    }));
  });

  it('deduplicates a realtime create by notification id', async () => {
    await service.initRealtimeNotifications('u1');
    const record = { id: 'n1', user: 'u1', title: 'T', message: 'M', type: 'test_notification', read: false, created: '' };
    await realtimeHandler?.({ action: 'create', record });
    await realtimeHandler?.({ action: 'create', record });
    let value: any[] = [];
    service.notifications$.subscribe(items => value = items).unsubscribe();
    expect(value).toHaveLength(1);
  });

  it('marks a notification and all unread notifications as read', async () => {
    collection.getFullList.mockResolvedValue([
      { id: 'n1', user: 'u1', read: false },
      { id: 'n2', user: 'u1', read: false }
    ]);
    await service.initRealtimeNotifications('u1');
    await service.markAllAsRead('u1');
    expect(collection.update).toHaveBeenCalledTimes(2);
  });

  it('persists the foreground sound preference without affecting notification history', () => {
    service.setSoundEnabled(false);
    expect(service.soundEnabled).toBe(false);
    expect(localStorage.getItem('ongo_notification_sound_enabled')).toBe('false');
  });
});
