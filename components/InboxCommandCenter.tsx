
import React from 'react';
import type { Order, Product, BankInfo } from '../types';
import { ChatBubbleLeftEllipsisIcon, ClockIcon } from './icons';
import FacebookInbox from './FacebookInbox';

interface InboxCommandCenterProps {
    products: Product[];
    orders: Order[];
    bankInfo: BankInfo | null;
    onOpenOrderForm: (order: Partial<Order> | null) => void;
}

const InboxCommandCenter: React.FC<InboxCommandCenterProps> = ({
    products,
    orders,
    bankInfo,
    onOpenOrderForm
}) => {
    // Count pending orders
    const pendingCount = orders.filter(o => o.status === 'Chờ xử lý').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-card-foreground flex items-center gap-2">
                        <ChatBubbleLeftEllipsisIcon className="w-7 h-7 text-primary" />
                        Inbox Command Center
                    </h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Quản lý tin nhắn và tạo đơn hàng từ Facebook Messenger
                    </p>
                </div>

                {pendingCount > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-full">
                        <ClockIcon className="w-5 h-5 text-yellow-600" />
                        <span className="text-yellow-700 dark:text-yellow-400 font-medium text-sm">
                            {pendingCount} đơn chờ xử lý
                        </span>
                    </div>
                )}
            </div>

            {/* Facebook Messenger */}
            <FacebookInbox
                orders={orders}
                products={products}
                bankInfo={bankInfo}
                onCreateOrderWithAI={(orderData, customerData) => {
                    // Open order form with pre-filled AI-parsed data
                    onOpenOrderForm({
                        ...orderData,
                        customerName: customerData.name || orderData.customerName,
                        customerPhone: customerData.phone || orderData.customerPhone,
                        shippingAddress: customerData.address || orderData.shippingAddress,
                    });
                }}
            />
        </div>
    );
};

export default InboxCommandCenter;
