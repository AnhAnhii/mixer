
import React from 'react';
import type { ActivityLog } from '../types';
import { ClockIcon, BoltIcon, ShoppingBagIcon, UserGroupIcon, UserCircleIcon } from './icons';

import { sanitizeHtml } from '../utils/sanitize';

interface ActivityFeedProps {
  logs: ActivityLog[];
  title?: string;
  limit?: number;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ logs, title, limit }) => {
  const displayedLogs = limit ? logs.slice(0, limit) : logs;

  const getIcon = (type?: 'order' | 'customer' | 'system' | 'automation' | 'return' | 'user') => {
    switch (type) {
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
    <div className="space-y-6">
      {title && <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
        {title}
      </h3>}
      {displayedLogs.length > 0 ? (
        <div className="space-y-6 relative ml-3">
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border/40"></div>
          {displayedLogs.map((log) => (
            <div key={log.id} className="flex gap-5 relative group animate-in slide-in-from-left-2 duration-500">
              <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-white border border-border/60 rounded-xl text-primary shadow-soft-sm z-10 transition-all group-hover:scale-110 group-hover:border-primary/30 group-hover:text-primary-dark">
                {getIcon(log.entityType)}
              </div>
              <div className="flex-1 pt-0.5">
                <div className="text-[13px] font-bold text-foreground leading-relaxed group-hover:text-primary transition-colors" dangerouslySetInnerHTML={{ __html: sanitizeHtml(log.description) }} />
                <div className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                  <ClockIcon className="w-3 h-3 opacity-40" />
                  {timeAgo(log.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 border-2 border-dashed border-border/30 rounded-[28px] flex flex-col items-center justify-center opacity-40">
          <ClockIcon className="w-8 h-8 mb-2 text-muted-foreground" />
          <p className="text-[12px] font-bold">Trống lịch sử hoạt động</p>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
