
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

    const getStatusClass = (status: OrderStatus) => {
        const classes = {
            [OrderStatus.Pending]: 'status-warning',
            [OrderStatus.Processing]: 'status-info',
            [OrderStatus.Shipped]: 'status-info',
            [OrderStatus.Delivered]: 'status-success',
            [OrderStatus.Cancelled]: 'status-danger',
        };
        return classes[status] || 'bg-muted text-muted-foreground';
    };

    const getPaymentStatusInfo = (order: Order) => {
        if (order.paymentMethod === 'cod') {
            return { text: 'Thu hộ (COD)', class: 'bg-muted text-muted-foreground' };
        }

        if (order.paymentStatus === 'Paid') {
            return { text: 'Đã thanh toán', class: 'status-success' };
        }

        return { text: 'Chờ thanh toán', class: 'status-warning' };
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
            <div className="text-center py-20 card-base border-dashed flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-muted/30 rounded-[32px] flex items-center justify-center mb-6">
                    <ShoppingBagIcon className="w-10 h-10 text-muted-foreground/30" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Không tìm thấy đơn hàng nào</h3>
                <p className="text-muted-foreground max-w-xs mb-8">Hãy thử thay đổi bộ lọc tìm kiếm hoặc tạo đơn hàng mới ngay.</p>
                <button onClick={onAddOrder} className="btn-primary flex items-center gap-2 px-6 py-3 shadow-soft hover:shadow-soft-md transition-all active:scale-95">
                    <PlusIcon className="w-5 h-5" />
                    <span className="font-bold">Tạo đơn hàng mới</span>
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="card-base overflow-hidden border-none shadow-soft-lg">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-border/50">
                        <thead>
                            <tr className="bg-muted/20">
                                <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Mã ĐH</th>
                                <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Khách hàng</th>
                                <th scope="col" className="px-6 py-4 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Tổng tiền</th>
                                <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Trạng thái</th>
                                <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Thanh toán</th>
                                <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Ngày tạo</th>
                                <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-border/30">
                            {orders.map((order, index) => {
                                const paymentStatusInfo = getPaymentStatusInfo(order);
                                return (
                                    <tr
                                        key={order.id}
                                        className={`transition-all duration-200 group ${activeIndex === index ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                                    >
                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-6 py-5 whitespace-nowrap text-[13px] text-muted-foreground font-mono font-bold group-hover:text-primary transition-colors">
                                            #{order.id.substring(0, 8)}
                                        </td>

                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-6 py-5 whitespace-nowrap">
                                            <p className="text-[14px] font-bold text-foreground group-hover:text-primary transition-colors">{order.customerName}</p>
                                            <p className="text-[12px] text-muted-foreground font-medium">{order.customerPhone}</p>
                                        </td>

                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-6 py-5 whitespace-nowrap text-[15px] font-black text-foreground text-right tabular-nums">
                                            {formatCurrency(order.totalAmount)}
                                        </td>

                                        <td className="px-6 py-5 whitespace-nowrap text-center">
                                            <select
                                                value={order.status}
                                                onChange={(e) => onUpdateStatus(order.id, e.target.value as OrderStatus)}
                                                className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border-none ring-0 appearance-none cursor-pointer outline-none transition-all hover:brightness-95 active:scale-95 ${getStatusClass(order.status)}`}
                                            >
                                                {Object.values(OrderStatus).map(status => (
                                                    <option key={status} value={status}>{status}</option>
                                                ))}
                                            </select>
                                        </td>

                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-6 py-5 whitespace-nowrap text-center">
                                            <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl ${paymentStatusInfo.class}`}>
                                                {paymentStatusInfo.text}
                                            </span>
                                        </td>

                                        <td onClick={() => onViewDetails(order)} className="cursor-pointer px-6 py-5 whitespace-nowrap text-[13px] text-muted-foreground font-medium">
                                            {new Date(order.orderDate).toLocaleDateString('vi-VN')}
                                        </td>

                                        <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-medium">
                                            <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                                                <button
                                                    type="button"
                                                    onClick={() => onViewDetails(order)}
                                                    className="w-9 h-9 flex items-center justify-center text-primary-dark bg-primary/10 hover:bg-primary text-primary transition-all rounded-xl hover:text-white shadow-soft-sm"
                                                    title="Xem chi tiết"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(order)}
                                                    className="w-9 h-9 flex items-center justify-center text-secondary-dark bg-secondary/10 hover:bg-secondary text-secondary transition-all rounded-xl hover:text-white shadow-soft-sm"
                                                    title="Sửa"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteClick(order)}
                                                    className="w-9 h-9 flex items-center justify-center text-accent-pink bg-accent-pink/10 hover:bg-accent-pink transition-all rounded-xl hover:text-white shadow-soft-sm"
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
            <Modal isOpen={!!orderToDelete} onClose={() => setOrderToDelete(null)} title="Xác nhận xóa đơn hàng">
                <div className="space-y-6">
                    <div className="flex flex-col items-center text-center p-6 bg-accent-pink/5 rounded-3xl border border-accent-pink/10">
                        <div className="w-16 h-16 bg-accent-pink/10 rounded-full flex items-center justify-center text-accent-pink mb-4">
                            <ExclamationTriangleIcon className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-2">Bạn có chắc chắn muốn xóa?</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Đơn hàng <span className="font-bold text-foreground">#{orderToDelete?.id.substring(0, 8)}</span> của <span className="font-bold text-foreground">{orderToDelete?.customerName}</span> sẽ bị xóa vĩnh viễn và không thể khôi phục.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setOrderToDelete(null)}
                            className="flex-1 px-4 py-3 bg-muted text-foreground rounded-2xl hover:bg-muted/80 font-bold transition-all"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="flex-1 px-4 py-3 bg-accent-pink text-white rounded-2xl hover:bg-accent-pink/90 font-bold shadow-soft transition-all flex items-center justify-center gap-2"
                        >
                            <TrashIcon className="w-4 h-4" />
                            Xác nhận xóa
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default OrderList;
