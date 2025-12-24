import React from 'react';
import type { ActivityLog } from '../types';
import ActivityFeed from './ActivityFeed';

interface ActivityPageProps {
  logs: ActivityLog[];
}

const ActivityPage: React.FC<ActivityPageProps> = ({ logs }) => {
  return (
    <div className="space-y-6">
       <div className="border-b border-border pb-4">
          <h2 className="text-2xl font-semibold text-card-foreground">Lịch sử Hoạt động</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi mọi thay đổi và sự kiện diễn ra trên hệ thống của bạn.
          </p>
       </div>
       <ActivityFeed logs={logs} />
    </div>
  );
};

export default ActivityPage;