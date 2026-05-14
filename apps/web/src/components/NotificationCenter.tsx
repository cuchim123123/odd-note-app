import React, { useState } from 'react';
import { Bell, X, CheckCheck, Sparkles } from 'lucide-react';
import { useNotifications, useMarkNotificationAsRead, useDeleteNotification, useMarkAllNotificationsAsRead } from '../hooks/useNotifications';
import type { Notification } from '../types/notification';

export const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: notificationsData, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const deleteNotification = useDeleteNotification();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const notifications = notificationsData?.data || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead.mutate(notificationId);
  };

  const handleDelete = (notificationId: string) => {
    deleteNotification.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-white text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20"
        aria-label="Open notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-3 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-3xl border border-border/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.14)]">
          <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Activity
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">Notifications</h3>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <CheckCheck size={16} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close notifications"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto bg-slate-50/70 p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Bell size={34} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm text-muted-foreground">No notifications yet.</p>
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {notifications.map((notification: Notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={() => handleMarkAsRead(notification.id)}
                    onDelete={() => handleDelete(notification.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-border/70 bg-white px-4 py-3 text-center">
              <button className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDelete,
}) => {
  return (
    <li
      className={`group rounded-2xl border p-4 transition-all ${
        notification.read ? 'border-border/60 bg-white/95 hover:border-primary/20 hover:shadow-sm' : 'border-primary/15 bg-primary/5 hover:border-primary/25 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {!notification.read ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
            <h4 className="font-semibold text-foreground">{notification.title}</h4>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.message}</p>
          <span className="mt-2 block text-xs text-muted-foreground">
            {new Date(notification.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
              className="rounded-full px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Mark read
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Delete notification"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </li>
  );
};
