import React, { useState } from 'react';
import { ShoppingBagIcon, UserIcon, ClockIcon, PlusIcon, SparklesIcon } from '../icons';
import type { Order } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { ORDER_STATUSES, formatRelativeTime } from './types';

interface CustomerOrderPanelProps {
    customerName: string;
    customerId: string;
    orders: Order[];
    isParsingOrder: boolean;
    onCreateOrder: () => void;
    onViewOrder?: (order: Order) => void;
    onEditOrder?: (order: Order) => void;
    onStatusAction: (order: Order, status: string) => void;
    onSendConfirmation: (paymentMethod: 'cod' | 'bank_transfer') => void;
    hasParsedOrder: boolean;
}

const statusColors: Record<string, string> = {
    'Chờ xử lý': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    'Đang xử lý': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    'Đã gửi hàng': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    'Đã giao hàng': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    'Đã hủy': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const CustomerOrderPanel: React.FC<CustomerOrderPanelProps> = ({
    customerName,
    customerId,
    orders,
    isParsingOrder,
    onCreateOrder,
    onViewOrder,
    onEditOrder,
    onStatusAction,
    onSendConfirmation,
    hasParsedOrder,
}) => {
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    return (
        <div className="flex flex-col h-full">
            {/* Customer Header */}
            <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs">
                        {customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-medium text-sm">{customerName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <UserIcon className="w-3 h-3" /> Khách hàng
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={onCreateOrder}
                        disabled={isParsingOrder}
                        className="flex-1 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                        {isParsingOrder ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Đang phân tích...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-3 h-3" />
                                AI Tạo đơn
                            </>
                        )}
                    </button>
                </div>

                {/* Send Confirmation Buttons */}
                {hasParsedOrder && (
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">📩 Gửi tin xác nhận:</p>
                        <div className="flex gap-1">
                            <button
                                onClick={() => onSendConfirmation('cod')}
                                className="flex-1 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                            >
                                COD
                            </button>
                            <button
                                onClick={() => onSendConfirmation('bank_transfer')}
                                className="flex-1 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Chuyển khoản + QR
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Order History */}
            <div className="flex-1 overflow-y-auto p-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <ShoppingBagIcon className="w-3 h-3" />
                    Đơn hàng ({orders.length})
                </h4>

                {orders.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Chưa có đơn hàng</p>
                ) : (
                    <div className="space-y-2">
                        {orders.map((order) => (
                            <div key={order.id} className="border border-border rounded-lg p-2 text-xs">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium">#{order.id.substring(0, 8)}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColors[order.status] || 'bg-muted text-muted-foreground'}`}>
                                        {order.status}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <ClockIcon className="w-3 h-3" />
                                        {formatRelativeTime(order.orderDate)}
                                    </span>
                                    <span className="font-medium text-foreground">{formatCurrency(order.totalAmount)}</span>
                                </div>

                                {/* Expandable actions */}
                                <div className="mt-1 flex gap-1">
                                    {onViewOrder && (
                                        <button
                                            onClick={() => onViewOrder(order)}
                                            className="px-2 py-0.5 bg-muted rounded text-[10px] hover:bg-muted/80"
                                        >
                                            Xem
                                        </button>
                                    )}
                                    {onEditOrder && (
                                        <button
                                            onClick={() => onEditOrder(order)}
                                            className="px-2 py-0.5 bg-muted rounded text-[10px] hover:bg-muted/80"
                                        >
                                            Sửa
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                        className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] hover:bg-primary/20"
                                    >
                                        Cập nhật
                                    </button>
                                </div>

                                {/* Status update dropdown */}
                                {expandedOrderId === order.id && (
                                    <div className="mt-1 p-1.5 bg-muted/50 rounded-lg space-y-0.5">
                                        {ORDER_STATUSES.map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    onStatusAction(order, status);
                                                    setExpandedOrderId(null);
                                                }}
                                                className={`w-full text-left px-2 py-1 rounded text-[10px] hover:bg-muted transition-colors ${order.status === status ? 'font-bold bg-primary/10 text-primary' : ''
                                                    }`}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerOrderPanel;
