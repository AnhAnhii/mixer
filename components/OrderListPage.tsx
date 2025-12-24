
import React, { useState, useEffect } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { PlusIcon, SparklesIcon } from './icons';
import OrderList from './OrderList';
import { useSessionStorage } from '../hooks/useSessionStorage';

interface OrderListPageProps {
  orders: Order[];
  onViewDetails: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (orderId: string) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onAddOrder: () => void;
  onAddQuickOrder: () => void;
  isAnyModalOpen: boolean;
}

const OrderListPage: React.FC<OrderListPageProps> = React.memo(({ orders, onViewDetails, onEdit, onDelete, onUpdateStatus, onAddOrder, onAddQuickOrder, isAnyModalOpen }) => {
  const [searchTerm, setSearchTerm] = useSessionStorage('orderListSearchTerm', '');
  const [statusFilter, setStatusFilter] = useSessionStorage<OrderStatus | 'all'>('orderListStatusFilter', 'all');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const filteredOrders = React.useMemo(() => {
    return orders
      .filter(order => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const matchesSearch =
          order.customerName.toLowerCase().includes(lowerSearchTerm) ||
          order.customerPhone.includes(searchTerm) ||
          order.id.toLowerCase().includes(lowerSearchTerm);
        
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [orders, searchTerm, statusFilter]);

  // Keyboard navigation
  useEffect(() => {
    // Reset active index when filters change
    setActiveIndex(null);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnyModalOpen || filteredOrders.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => {
          if (prev === null || prev >= filteredOrders.length - 1) return 0;
          return prev + 1;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => {
          if (prev === null || prev <= 0) return filteredOrders.length - 1;
          return prev - 1;
        });
      } else if (e.key === 'Enter' && activeIndex !== null) {
        e.preventDefault();
        const order = filteredOrders[activeIndex];
        if (order) {
          onViewDetails(order);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);

  }, [activeIndex, filteredOrders, onViewDetails, isAnyModalOpen]);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6 border-b border-border pb-4">
        <h2 className="text-2xl font-semibold text-card-foreground">Quản lý Đơn hàng</h2>
        <div className="flex items-center gap-2">
            <button onClick={onAddQuickOrder} className="btn-secondary flex items-center gap-2 px-4 py-2 shadow-sm">
              <SparklesIcon className="w-5 h-5" /> Tạo nhanh (AI)
            </button>
            <button onClick={onAddOrder} className="btn-primary flex items-center gap-2 px-4 py-2 shadow-sm">
              <PlusIcon className="w-5 h-5" /> Tạo đơn hàng
            </button>
        </div>
      </div>

      <div className="bg-card p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 border border-border">
        <div className="flex-grow">
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, SĐT khách hàng hoặc mã đơn hàng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-4 py-2 border border-input rounded-md shadow-sm focus:ring-primary focus:border-primary bg-card"
            />
        </div>
        <div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as OrderStatus | 'all')} className="w-full md:w-auto p-2 border border-input rounded-md text-sm bg-card h-full">
                <option value="all">Tất cả trạng thái</option>
                {Object.values(OrderStatus).map(status => (
                    <option key={status} value={status}>{status}</option>
                ))}
            </select>
        </div>
      </div>

      <OrderList 
        orders={filteredOrders} 
        onViewDetails={onViewDetails}
        onEdit={onEdit}
        onDelete={onDelete}
        onUpdateStatus={onUpdateStatus}
        onAddOrder={onAddOrder}
        activeIndex={activeIndex}
      />
    </div>
  );
});

export default OrderListPage;
