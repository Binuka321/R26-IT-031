import React, { useEffect, useState } from 'react';
import { PageHeader, PrimaryButton, Loading, EmptyState } from '../components/UIComponents';
import * as api from '../services/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getNotifications().then(r => setNotifications(r.data || [])).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleMarkRead = async (id: string) => {
    await api.markAsRead(id); load();
  };

  const handleMarkAllRead = async () => {
    await api.markAllRead(); load();
  };

  const severityConfig: Record<string, { bg: string; icon: string; iconColor: string }> = {
    critical: { bg: 'bg-rose-50 border-rose-200', icon: 'error', iconColor: 'text-rose-500' },
    warning: { bg: 'bg-amber-50 border-amber-200', icon: 'warning', iconColor: 'text-amber-500' },
    info: { bg: 'bg-blue-50 border-blue-200', icon: 'info', iconColor: 'text-blue-500' },
  };

  const typeIcons: Record<string, string> = {
    priority_alert: 'analytics', disease_alert: 'coronavirus', low_stock: 'inventory',
    route_alert: 'route', delivery_alert: 'local_shipping', system: 'settings',
  };

  if (loading) return <Loading />;

  const unread = notifications.filter(n => n.status === 'unread');

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${unread.length} unread notifications`} icon="notifications"
        actions={unread.length > 0 ? <PrimaryButton onClick={handleMarkAllRead} icon="done_all">Mark All Read</PrimaryButton> : undefined} />

      {notifications.length === 0 ? (
        <EmptyState icon="notifications_none" title="No notifications" subtitle="You're all caught up!" />
      ) : (
        <div className="space-y-3">
          {notifications.map(n => {
            const sev = severityConfig[n.severity] || severityConfig.info;
            const isUnread = n.status === 'unread';
            return (
              <div key={n._id} className={`rounded-2xl p-4 border ${sev.bg} ${isUnread ? 'shadow-md' : 'opacity-70'} transition-all hover:shadow-lg`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${isUnread ? 'bg-white shadow-sm' : ''}`}>
                    <span className={`material-icons ${sev.iconColor}`}>{typeIcons[n.type] || 'notifications'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-semibold ${isUnread ? 'text-gray-800' : 'text-gray-600'} text-sm`}>{n.title}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${n.severity === 'critical' ? 'bg-rose-200 text-rose-800' : n.severity === 'warning' ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'}`}>{n.severity}</span>
                        {isUnread && (
                          <button onClick={() => handleMarkRead(n._id)} className="p-1 rounded-lg hover:bg-white/50" title="Mark as read">
                            <span className="material-icons text-sm text-gray-400">check</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><span className="material-icons text-xs">schedule</span>{new Date(n.createdAt).toLocaleString()}</span>
                      <span className="capitalize">{n.type.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
