import React, { useState } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
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
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-lg bg-white rounded-lg shadow-xl z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <CheckCheck size={16} />
                  Mark all as read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Loading notifications...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Bell size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500">No notifications yet</p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
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

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-200 p-3 bg-gray-50 text-center">
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
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
      className={`p-4 transition cursor-pointer ${
        notification.read ? 'bg-white hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{notification.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
          <span className="text-xs text-gray-500 mt-2 block">
            {new Date(notification.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!notification.read && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkAsRead();
              }}
              className="text-blue-600 hover:text-blue-700 text-xs font-medium"
            >
              Mark read
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </li>
  );
};
