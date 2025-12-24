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
    switch (status) {
      case OrderStatus.Pending: return 'bg-yellow-100 text-yellow-800';
      case OrderStatus.Processing: return 'bg-blue-100 text-blue-800';
      case OrderStatus.Shipped: return 'bg-indigo-100 text-indigo-800';
      case OrderStatus.Delivered: return 'bg-green-100 text-green-800';
      case OrderStatus.Cancelled: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết khách hàng: ${customer.name}`}>
      <div className="space-y-6">
        <div className="p-4 bg-slate-50 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">Thông tin liên hệ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <p className="text-gray-600"><span className="font-medium text-gray-800">SĐT:</span> {customer.phone}</p>
            <p className="text-gray-600"><span className="font-medium text-gray-800">Email:</span> {customer.email || 'Chưa có'}</p>
            <p className="text-gray-600 md:col-span-2"><span className="font-medium text-gray-800">Địa chỉ:</span> {customer.address || 'Chưa có'}</p>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Lịch sử đơn hàng ({orders.length})</h3>
          {orders.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg max-h-60">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                    <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã ĐH</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày đặt</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng tiền</th>
                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map(order => (
                    <tr key={order.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">#{order.id.substring(0, 8)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDate(order.orderDate)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatCurrency(order.totalAmount)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(order.status)}`}>
                                {order.status}
                            </span>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            ) : (
                <p className="text-sm text-gray-500 text-center py-4 bg-slate-50 rounded-md">Khách hàng này chưa có đơn hàng nào.</p>
            )}
        </div>
        
        <div className="max-h-64 overflow-y-auto">
            <ActivityFeed logs={customerActivity} title="Lịch sử Hoạt động Khách hàng" />
        </div>

      </div>
    </Modal>
  );
};

export default CustomerDetailModal;