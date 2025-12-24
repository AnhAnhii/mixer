import React from 'react';
import type { Order } from '../types';

interface KanbanCardProps {
  order: Order;
  onViewDetails: (order: Order) => void;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ order, onViewDetails }) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/plain', order.id);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)} ngày trước`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)} giờ trước`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)} phút trước`;
    return 'Vừa xong';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onViewDetails(order)}
      className="bg-card p-4 rounded-lg shadow-sm border border-border cursor-grab active:cursor-grabbing"
    >
      <div className="flex justify-between items-start">
        <p className="text-sm font-semibold text-card-foreground line-clamp-1">{order.customerName}</p>
        <p className="text-xs text-muted-foreground font-mono">#{order.id.substring(0, 8)}</p>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{order.customerPhone}</p>
      <div className="flex justify-between items-end mt-3">
        <span className="text-xs text-muted-foreground">{timeAgo(order.orderDate)}</span>
        <span className="text-sm font-bold text-primary">{formatCurrency(order.totalAmount)}</span>
      </div>
    </div>
  );
};

export default KanbanCard;
