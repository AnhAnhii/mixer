import React from 'react';
import type { Customer, Order, ActivityLog } from '../types';
import Modal from './Modal';
import { OrderStatus } from '../types';
import ActivityFeed from './ActivityFeed';


interface CustomerDetailModalProps {
  customer: Customer | null;
  orders: Order[];
  activityLog: ActivityLog[];
  isOpen: boolean;
  onClose: () => void;
}

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ customer, orders, activityLog, isOpen, onClose }) => {
  if (!customer) return null;

  const customerActivity = React.useMemo(() => {
    if (!customer) return [];
    return activityLog.filter(log => log.entityId === customer.id);
  }, [activityLog, customer]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  }

  const getStatusColor = (status: OrderStatus) => {
    const colors = {
      [OrderStatus.Pending]: 'bg-status-warning/10 text-status-warning border-status-warning/20',
      [OrderStatus.Processing]: 'bg-status-info/10 text-status-info border-status-info/20',
      [OrderStatus.Shipped]: 'bg-primary/10 text-primary border-primary/20',
      [OrderStatus.Delivered]: 'bg-status-success/10 text-status-success border-status-success/20',
      [OrderStatus.Cancelled]: 'bg-status-danger/10 text-status-danger border-status-danger/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground border-border';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Hồ sơ khách hàng`}>
      <div className="space-y-8">
        <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500">
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
            Thông tin liên hệ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Tên khách hàng</p>
                <p className="text-[16px] font-black text-foreground">{customer.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Số điện thoại</p>
                <p className="text-[15px] font-black text-primary font-mono tracking-tight">{customer.phone}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Địa chỉ Email</p>
                <p className="text-[14px] font-black text-foreground">{customer.email || '—'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-50">Địa chỉ giao hàng</p>
                <p className="text-[13px] font-bold text-muted-foreground leading-relaxed">{customer.address || 'Chưa cập nhật'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
              Lịch sử đơn hàng
            </h3>
            <span className="text-[11px] font-black text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">{orders.length} đơn</span>
          </div>

          {orders.length > 0 ? (
            <div className="overflow-hidden border border-border/50 rounded-2xl bg-white shadow-soft-sm">
              <div className="overflow-x-auto max-h-64 custom-scrollbar">
                <table className="min-w-full divide-y divide-border/30">
                  <thead className="bg-muted/30 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-5 py-3 text-left">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Mã đơn</span>
                      </th>
                      <th scope="col" className="px-5 py-3 text-left">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Ngày đặt</span>
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Tổng tiền</span>
                      </th>
                      <th scope="col" className="px-5 py-3 text-center">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Trạng thái</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-muted/10 transition-colors group cursor-default">
                        <td className="px-5 py-4 whitespace-nowrap text-[13px] font-black text-primary font-mono group-hover:pl-6 transition-all">#{order.id.substring(0, 8)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-[13px] font-bold text-muted-foreground/80">{formatDate(order.orderDate)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-[14px] font-black text-foreground text-right">{formatCurrency(order.totalAmount)}</td>
                        <td className="px-5 py-4 whitespace-nowrap text-center">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border-2 ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-12 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center bg-white/50 grayscale opacity-40">
              <svg className="w-12 h-12 mb-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-[13px] font-bold">Chưa có dữ liệu giao dịch</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500 delay-100 max-h-[400px] overflow-y-auto custom-scrollbar">
          <ActivityFeed logs={customerActivity} title="Lịch sử hoạt động" />
        </div>
      </div>
    </Modal>
  );
};

export default CustomerDetailModal;