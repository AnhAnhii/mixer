
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-12">
        <div>
          <h2 className="text-[28px] font-black font-heading text-foreground tracking-tighter leading-none">Quản lý Đơn hàng</h2>
          <p className="text-[13px] font-bold text-muted-foreground mt-2">Theo dõi và vận hành toàn bộ vòng đời đơn hàng tại đây.</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onAddQuickOrder} className="px-6 py-3.5 bg-white text-secondary hover:bg-muted border border-border rounded-[18px] font-black text-[14px] transition-all flex items-center shadow-soft-sm active:scale-95 group">
            <SparklesIcon className="w-5 h-5 mr-3 group-hover:animate-pulse" />
            <span>Tạo nhanh (AI)</span>
          </button>
          <button onClick={onAddOrder} className="px-8 py-3.5 bg-primary text-white hover:bg-primary-dark rounded-[18px] font-black text-[15px] shadow-soft-lg active:scale-95 transition-all flex items-center border-b-4 border-primary-dark/30">
            <PlusIcon className="w-5 h-5 mr-2" />
            <span>Tạo đơn hàng</span>
          </button>
        </div>
      </div>

      <div className="p-6 bg-muted/20 border border-border/50 rounded-[32px] flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-grow w-full group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên, SĐT hoặc mã vận đơn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border border-border rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-[15px] font-bold outline-none shadow-soft-sm placeholder:text-muted-foreground/20"
          />
        </div>
        <div className="w-full md:w-72">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as OrderStatus | 'all')}
            className="w-full pl-6 pr-12 py-4 bg-white border border-border rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-[14px] font-black uppercase tracking-widest text-foreground outline-none cursor-pointer appearance-none shadow-soft-sm"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center', backgroundSize: '1.25rem' }}
          >
            <option value="all">TẤT CẢ TRẠNG THÁI</option>
            {Object.values(OrderStatus).map(status => (
              <option key={status} value={status}>{status.toUpperCase()}</option>
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
