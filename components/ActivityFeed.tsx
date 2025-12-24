
import React from 'react';
import type { ActivityLog } from '../types';
import { ClockIcon, BoltIcon, ShoppingBagIcon, UserGroupIcon, UserCircleIcon } from './icons';

interface ActivityFeedProps {
  logs: ActivityLog[];
  title?: string;
  limit?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ logs, title, limit }) => {
  const displayedLogs = limit ? logs.slice(0, limit) : logs;

  const getIcon = (type?: 'order' | 'customer' | 'system' | 'automation' | 'return' | 'user') => {
    switch(type) {
      case 'order': return <ShoppingBagIcon className="w-4 h-4" />;
      // FIX: Add 'return' to the switch case to handle the new entityType and fix the type error.
      case 'return': return <ShoppingBagIcon className="w-4 h-4" />; // Returns are related to orders
      case 'customer': return <UserGroupIcon className="w-4 h-4" />;
      case 'automation': return <BoltIcon className="w-4 h-4" />;
      case 'user': return <UserCircleIcon className="w-4 h-4" />;
      default: return <ClockIcon className="w-4 h-4" />;
    }
  }

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)} năm trước`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)} tháng trước`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)} ngày trước`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)} giờ trước`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)} phút trước`;
    return 'Vừa xong';
  };

  return (
    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
      {title && <h3 className="text-lg font-semibold text-card-foreground mb-4">{title}</h3>}
      {displayedLogs.length > 0 ? (
        <ul className="space-y-4">
          {displayedLogs.map((log) => (
            <li key={log.id} className="flex gap-3">
              <div className="mt-1 flex-shrink-0 h-8 w-8 flex items-center justify-center bg-muted rounded-full text-muted-foreground">
                {getIcon(log.entityType)}
              </div>
              <div>
                <p className="text-sm text-card-foreground" dangerouslySetInnerHTML={{ __html: log.description }} />
                <p className="text-xs text-muted-foreground">{timeAgo(log.timestamp)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-muted-foreground py-8">Không có hoạt động nào.</p>
      )}
    </div>
  );
};

export default ActivityFeed;
