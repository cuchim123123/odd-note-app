import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCheck, Sparkles, Share2 } from 'lucide-react';
import { useNotifications, useMarkNotificationAsRead, useDeleteNotification, useMarkAllNotificationsAsRead } from '../hooks/useNotifications';
import type { Notification } from '../types/notification';
import { Button } from './ui/button';

export const NotificationCenter = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
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

  const handleJoinNote = (noteId: string, notificationId: string) => {
    markAsRead.mutate(notificationId);
    navigate(`/notes/${noteId}`);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/20"
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
        <div className="absolute right-0 z-50 mt-3 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-3xl border bg-card shadow-[0_30px_80px_rgba(15,23,42,0.14)]">
          <div className="flex items-center justify-between border-b bg-gradient-to-r from-muted/30 to-card px-4 py-3">
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

          <div className="max-h-96 overflow-y-auto bg-muted/20 p-2">
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
                    onJoin={(noteId) => handleJoinNote(noteId, notification.id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t bg-card px-4 py-3 text-center">
              <button
                onClick={() => {
                  navigate('/notifications');
                  setIsOpen(false);
                }}
                className="w-full text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
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
  onJoin: (noteId: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDelete,
  onJoin,
}) => {
  const noteId = notification.data?.noteId as string | undefined;

  return (
    <li
      className={`group relative rounded-2xl border p-4 transition-all duration-200 ${
        notification.read
          ? 'border-border/50 bg-card/75 hover:border-primary/20 hover:shadow-sm'
          : 'border-primary/15 bg-primary/5 hover:border-primary/25 hover:shadow-md shadow-primary/5'
      }`}
    >
      <div className="flex gap-3">
        {/* Left Side: Dynamic Icon */}
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
          notification.read 
            ? 'bg-muted text-muted-foreground' 
            : 'bg-primary/10 text-primary'
        }`}>
          {notification.type === 'note_shared' ? (
            <Share2 className="h-4.5 w-4.5" />
          ) : (
            <Bell className="h-4.5 w-4.5" />
          )}
        </div>

        {/* Center: Title, Message, Date */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {!notification.read && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary animate-pulse" />
            )}
            <h4 className="font-semibold text-foreground text-sm leading-tight truncate">
              {notification.title}
            </h4>
          </div>
          <p className="mt-1 text-xs leading-normal text-muted-foreground break-words">
            {notification.message}
          </p>
          <span className="mt-2.5 block text-[10px] font-medium text-muted-foreground/60">
            {new Date(notification.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          {/* Action Row: Join Button */}
          {noteId && (
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-xl h-8 px-3.5 bg-primary text-primary-foreground font-semibold text-xs shadow-sm hover:shadow transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onJoin(noteId);
                }}
              >
                Join Note
              </Button>
              {!notification.read && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl h-8 px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary font-semibold"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead();
                  }}
                >
                  Mark read
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Delete Button */}
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-7 w-7 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0"
            aria-label="Delete notification"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
};
