import React, { useState } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import KanbanCard from './KanbanCard';
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from './icons';

interface KanbanColumnProps {
  status: OrderStatus;
  orders: Order[];
  onDrop: (orderId: string, newStatus: OrderStatus) => void;
  onViewDetails: (order: Order) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, orders, onDrop, onViewDetails, isCollapsed, onToggleCollapse }) => {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isCollapsed) {
       setIsOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
     if (!isCollapsed) {
        const orderId = e.dataTransfer.getData('text/plain');
        onDrop(orderId, status);
     }
    setIsOver(false);
  };
  
  const getStatusColorClass = (status: OrderStatus) => {
    const colors = {
      [OrderStatus.Pending]: 'border-yellow-500',
      [OrderStatus.Processing]: 'border-blue-500',
      [OrderStatus.Shipped]: 'border-indigo-500',
      [OrderStatus.Delivered]: 'border-green-500',
      [OrderStatus.Cancelled]: 'border-red-500',
    };
    return colors[status] || 'border-gray-500';
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-shrink-0 flex flex-col transition-all duration-300 rounded-xl ${isCollapsed ? 'w-16' : 'w-72'} ${isOver ? 'bg-primary/10' : 'bg-muted'}`}
    >
      <div 
        className={`p-4 border-b-4 ${getStatusColorClass(status)} flex items-center justify-between cursor-pointer`}
        onClick={onToggleCollapse}
      >
        {isCollapsed ? (
            <div className="h-full flex flex-col items-center justify-between w-full">
                 <h3 className="font-semibold text-card-foreground" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {status}
                </h3>
                <span className="text-sm font-normal bg-muted-foreground/10 text-muted-foreground px-2 py-0.5 rounded-full mt-4">
                    {orders.length}
                </span>
            </div>
        ) : (
             <h3 className="font-semibold text-card-foreground flex items-center gap-2">
              {status}
              <span className="text-sm font-normal bg-muted-foreground/10 text-muted-foreground px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
            </h3>
        )}
       
        <button className="text-muted-foreground hover:text-card-foreground">
          {isCollapsed ? <ArrowsPointingOutIcon className="w-4 h-4" /> : <ArrowsPointingInIcon className="w-4 h-4" />}
        </button>
      </div>
      {!isCollapsed && (
        <div className="p-4 space-y-4 overflow-y-auto flex-grow">
          {orders.map(order => (
            <KanbanCard key={order.id} order={order} onViewDetails={onViewDetails} />
          ))}
        </div>
      )}
    </div>
  );
};

export default KanbanColumn;