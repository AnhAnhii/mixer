
import React, { useState } from 'react';
import type { Order } from '../types';
import { OrderStatus } from '../types';
import { EyeIcon, PencilIcon, ShoppingBagIcon, PlusIcon, TrashIcon, ExclamationTriangleIcon } from './icons';
import Modal from './Modal';

interface OrderListProps {
  orders: Order[];
  onViewDetails: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (orderId: string) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onAddOrder: () => void;
  activeIndex: number | null;
}

const OrderList: React.FC<OrderListProps> = ({ orders, onViewDetails, onEdit, onDelete, onUpdateStatus, onAddOrder, activeIndex }) => {
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };
    
    const getStatusColor = (status: OrderStatus) => {
        const colors = {
            [OrderStatus.Pending]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
            [OrderStatus.Processing]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
            [OrderStatus.Shipped]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
            [OrderStatus.Delivered]: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
            [OrderStatus.Cancelled]: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
        };
        return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    };

    const getPaymentStatusInfo = (order: Order) => {
        if (order.paymentMethod === 'cod') {
            return { text: 'Thu hộ (COD)', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
        }
        
        if (order.paymentStatus === 'Paid') {
            return { text: 'Đã thanh toán', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' };
        }
        
        return { text: 'Chờ thanh toán', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' };
    };

    // Handle delete click: Open local modal instead of immediate window.confirm
    const handleDeleteClick = (order: Order) => {
        setOrderToDelete(order);
    };

    const confirmDelete = () => {
        if (orderToDelete) {
            onDelete(orderToDelete.id);
            setOrderToDelete(null);
        }
    };
    
    if (orders.length === 0) {
        return (
            <div className="text-center py-16 card-base border border-dashed flex flex-col items-center">
                <ShoppingBagIcon className="w-16 h-16 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground text-lg font-semibold">Không tìm thấy đơn hàng nào.</p>
                <p className="text-muted-foreground/70 mt-2 mb-6">Hãy thử thay đổi bộ lọc hoặc tạo đơn hàng mới.</p>
                <button onClick={onAddOrder} className="btn-primary flex items-center gap-2 px-4 py-2">
                    <PlusIcon className="w-5 h-5"/> Tạo đơn hàng mới
                </button>
            </div>
        );
    }
    
    return (
        <>
            <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider compact-py compact-px">Mã ĐH</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider compact-py compact-px">Khách hàng</th>
                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider compact-py compact-px">Tổng tiền</th>
                                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider compact-py compact-px">Trạng thái</th>
                                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider compact-py compact-px">Thanh toán</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider compact-py compact-px">Ngày tạo</th>
                                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider compact-py compact-px">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {orders.map((order, index) => {
                                const paymentStatusInfo = getPaymentStatusInfo(order);
                                return (
                                    <tr 
                                      key={order.id} 
                                      className={`transition-colors duration-150 group ${activeIndex === index ? 'bg-primary/10' : 'hover:bg-muted'}`}
                                    >
                                        {/* Column 1: ID - Click to View */}
                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-4 py-4 whitespace-nowrap text-sm text-muted-foreground font-mono compact-py compact-px compact-text-sm hover:text-primary font-medium">
                                            #{order.id.substring(0, 8)}
                                        </td>

                                        {/* Column 2: Customer - Click to View */}
                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-4 py-4 whitespace-nowrap compact-py compact-px">
                                            <p className="text-sm font-medium text-card-foreground compact-text-sm hover:text-primary">{order.customerName}</p>
                                            <p className="text-sm text-muted-foreground compact-text-sm">{order.customerPhone}</p>
                                        </td>

                                        {/* Column 3: Amount - Click to View */}
                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-4 py-4 whitespace-nowrap text-sm text-card-foreground font-semibold text-right compact-py compact-px compact-text-sm">
                                            {formatCurrency(order.totalAmount)}
                                        </td>

                                        {/* Column 4: Status - Independent Dropdown */}
                                        <td className="px-4 py-4 whitespace-nowrap text-center compact-py compact-px">
                                            <select
                                                value={order.status}
                                                onChange={(e) => onUpdateStatus(order.id, e.target.value as OrderStatus)}
                                                className={`text-xs font-medium px-2.5 py-1 rounded-full border-2 border-transparent focus:border-primary focus:ring-0 appearance-none cursor-pointer outline-none ${getStatusColor(order.status)}`}
                                            >
                                                 {Object.values(OrderStatus).map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                        </td>

                                        {/* Column 5: Payment - Click to View */}
                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-4 py-4 whitespace-nowrap text-center compact-py compact-px">
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${paymentStatusInfo.color} compact-text-sm`}>
                                                {paymentStatusInfo.text}
                                            </span>
                                        </td>

                                        {/* Column 6: Date - Click to View */}
                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-4 py-4 whitespace-nowrap text-sm text-muted-foreground compact-py compact-px compact-text-sm">
                                            {new Date(order.orderDate).toLocaleDateString('vi-VN')}
                                        </td>
                                        
                                        {/* Column 7: Actions - COMPLETELY INDEPENDENT ZONE */}
                                        <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium compact-py compact-px">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* View Button */}
                                                <button 
                                                    type="button"
                                                    onClick={() => onViewDetails(order)}
                                                    className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 p-2 rounded-md transition-colors" 
                                                    title="Xem chi tiết"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                
                                                {/* Edit Button */}
                                                <button 
                                                    type="button"
                                                    onClick={() => onEdit(order)}
                                                    className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 p-2 rounded-md transition-colors" 
                                                    title="Sửa"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                
                                                {/* Delete Button - Red, Explicit */}
                                                <button 
                                                    type="button"
                                                    onClick={() => handleDeleteClick(order)}
                                                    className="text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 p-2 rounded-md transition-colors" 
                                                    title="Xóa đơn hàng"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Custom Delete Confirmation Modal */}
            <Modal isOpen={!!orderToDelete} onClose={() => setOrderToDelete(null)} title="Xác nhận xóa">
                <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600">
                            <ExclamationTriangleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-red-800 dark:text-red-200">Bạn có chắc chắn muốn xóa?</h3>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                Đơn hàng <strong>#{orderToDelete?.id.substring(0, 8)}</strong> của khách hàng <strong>{orderToDelete?.customerName}</strong> sẽ bị xóa vĩnh viễn.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button 
                            onClick={() => setOrderToDelete(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium"
                        >
                            Hủy bỏ
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium shadow-sm flex items-center gap-2"
                        >
                            <TrashIcon className="w-4 h-4" />
                            Xóa đơn hàng
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default OrderList;
