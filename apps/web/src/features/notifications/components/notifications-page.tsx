import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Share2, ArrowLeft, Trash2 } from 'lucide-react';
import { useNotifications, useMarkNotificationAsRead, useDeleteNotification, useMarkAllNotificationsAsRead } from '../../../hooks/useNotifications';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import type { Notification } from '../../../types/notification';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  const { data: notificationsData, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const deleteNotification = useDeleteNotification();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const notifications = notificationsData?.data || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  const filteredNotifications = notifications.filter((n: Notification) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleDelete = (id: string) => {
    deleteNotification.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const handleJoinNote = (noteId: string, notificationId: string) => {
    markAsRead.mutate(notificationId);
    navigate(`/notes/${noteId}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-muted"
            onClick={() => navigate('/notes')}
            aria-label="Go back to notes"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <Bell className="h-3.5 w-3.5" />
              Inbox
            </div>
            <h1 className="text-3xl font-bold tracking-tight mt-0.5">Notifications</h1>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="rounded-full flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5 transition-all font-semibold"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex items-center justify-between bg-muted/30 border p-1 rounded-2xl">
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-xl transition-all",
              filter === 'all'
                ? "bg-card text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-md bg-muted text-muted-foreground font-medium">
              {notifications.length}
            </span>
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={cn(
              "px-4 py-2 text-sm font-semibold rounded-xl transition-all",
              filter === 'unread'
                ? "bg-card text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Unread
            {unreadCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-md bg-rose-500 text-white font-bold animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Notification List Container */}
      <div className="min-h-[24rem]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <span className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 border border-dashed rounded-3xl bg-card/45 shadow-sm text-center">
            <div className="h-14 w-14 rounded-full bg-muted/65 flex items-center justify-center mb-4">
              <Bell className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">All caught up!</h3>
            <p className="text-sm text-muted-foreground max-w-xs mt-1">
              {filter === 'unread' 
                ? "You have no unread notifications right now." 
                : "When you receive collaborative updates or shares, they'll show up here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredNotifications.map((n: Notification) => {
              const noteId = n.data?.noteId as string | undefined;

              return (
                <div
                  key={n.id}
                  className={cn(
                    "group relative rounded-2xl border p-5 transition-all duration-300",
                    n.read
                      ? "border-border/50 bg-card/65 hover:border-primary/20 hover:shadow-sm"
                      : "border-primary/20 bg-primary/[0.02] hover:border-primary/30 hover:shadow-md shadow-primary/[0.02]"
                  )}
                >
                  <div className="flex gap-4">
                    {/* Left Icon Block */}
                    <div className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-300",
                      n.read 
                        ? "bg-muted text-muted-foreground" 
                        : "bg-primary/10 text-primary shadow-sm shadow-primary/5 group-hover:scale-105"
                    )}>
                      {n.type === 'note_shared' ? (
                        <Share2 className="h-5 w-5" />
                      ) : (
                        <Bell className="h-5 w-5" />
                      )}
                    </div>

                    {/* Content Block */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!n.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary animate-pulse" />
                        )}
                        <h3 className="font-bold text-foreground text-base leading-tight truncate">
                          {n.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground/90 max-w-2xl break-words">
                        {n.message}
                      </p>
                      
                      <div className="mt-3.5 flex items-center justify-between gap-4 flex-wrap">
                        <span className="text-[11px] font-medium text-muted-foreground/60">
                          {`18/5/2026, ${new Date(n.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}
                        </span>

                        {/* Interactive CTAs */}
                        <div className="flex items-center gap-2">
                          {noteId && (
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-xl h-8.5 px-4 bg-primary text-primary-foreground font-semibold text-xs shadow-sm hover:shadow transition-all"
                              onClick={() => handleJoinNote(noteId, n.id)}
                            >
                              Join Note
                            </Button>
                          )}
                          {!n.read && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-xl h-8.5 px-3.5 text-xs text-primary hover:bg-primary/10 hover:text-primary font-semibold"
                              onClick={() => handleMarkAsRead(n.id)}
                            >
                              Mark read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Delete Button */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(n.id)}
                        className="h-8.5 w-8.5 rounded-full text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0"
                        aria-label="Delete notification"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
