import React, { useState } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import KanbanColumn from './KanbanColumn';

interface KanbanBoardPageProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onViewDetails: (order: Order) => void;
}

const KanbanBoardPage: React.FC<KanbanBoardPageProps> = ({ orders, onUpdateStatus, onViewDetails }) => {
  const [collapsedColumns, setCollapsedColumns] = useState<Set<OrderStatus>>(new Set());

  const handleDrop = (orderId: string, newStatus: OrderStatus) => {
    onUpdateStatus(orderId, newStatus);
  };
  
  const handleToggleColumn = (status: OrderStatus) => {
    const newSet = new Set(collapsedColumns);
    if (newSet.has(status)) {
      newSet.delete(status);
    } else {
      newSet.add(status);
    }
    setCollapsedColumns(newSet);
  }

  const statuses = Object.values(OrderStatus);

  return (
    <div className="space-y-6 h-full flex flex-col">
       <div className="flex-shrink-0 border-b border-border pb-4">
          <h2 className="text-2xl font-semibold text-card-foreground">Quy trình Xử lý Đơn hàng</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Kéo và thả đơn hàng giữa các cột để cập nhật trạng thái. Nhấp vào tiêu đề cột để thu gọn/mở rộng.
          </p>
       </div>
       <div className="flex-grow flex gap-6 overflow-x-auto pb-4">
        {statuses.map(status => {
          const ordersInColumn = orders.filter(order => order.status === status);
          return (
            <KanbanColumn
              key={status}
              status={status}
              orders={ordersInColumn}
              onDrop={handleDrop}
              onViewDetails={onViewDetails}
              isCollapsed={collapsedColumns.has(status)}
              onToggleCollapse={() => handleToggleColumn(status)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default KanbanBoardPage;