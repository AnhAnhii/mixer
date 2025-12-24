import React, { useMemo } from 'react';
import type { Order, Product, Customer, Voucher } from '../types';
import { OrderStatus } from '../types';
import { LightBulbIcon, ExclamationTriangleIcon, GiftIcon, ShoppingBagIcon } from './icons';

interface AiBusinessCoPilotProps {
  orders: Order[];
  products: Product[];
  customers: Customer[];
  onNavigate: (view: string) => void;
  onViewOrder: (order: Order) => void;
  onViewCustomer: (customer: Customer) => void;
  onOpenVoucherForm: (voucher: Partial<Voucher> | null) => void;
}

const AiBusinessCoPilot: React.FC<AiBusinessCoPilotProps> = ({ orders, products, customers, onNavigate, onViewOrder, onViewCustomer, onOpenVoucherForm }) => {

    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

    const { yesterdayStats, priorityTasks, missedOpportunities } = useMemo(() => {
        // --- Yesterday's Stats ---
        const now = new Date();
        const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        
        const yesterdaysOrders = orders.filter(o => {
            const orderDate = new Date(o.orderDate);
            return orderDate >= yesterdayStart && orderDate <= yesterdayEnd;
        });

        const revenue = yesterdaysOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const profit = yesterdaysOrders.reduce((sum, o) => {
            const orderProfit = o.items.reduce((itemSum, item) => itemSum + ((item.price - item.costPrice) * item.quantity), 0);
            return sum + orderProfit - (o.discount?.amount || 0);
        }, 0);
        const productsSoldCount = yesterdaysOrders.reduce((sum, o) => sum + o.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0);
        
        const yesterdayStats = {
            revenue,
            profit,
            orderCount: yesterdaysOrders.length,
            productsSoldCount
        };

        // --- Priority Tasks ---
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const lateOrders = orders.filter(o => 
            (o.status === OrderStatus.Pending || o.status === OrderStatus.Processing) &&
            new Date(o.orderDate) < oneDayAgo
        );

        const lowStockItems = products.flatMap(p => 
            p.variants.filter(v => v.stock > 0 && v.stock <= v.lowStockThreshold)
            .map(v => ({...v, productName: p.name}))
        ).sort((a,b) => a.stock - b.stock);

        // --- Missed Opportunities ---
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

        const inactiveVips = customers
            .filter(c => c.tags?.includes('VIP'))
            .filter(vip => {
                const customerOrders = orders
                    .filter(o => o.customerId === vip.id)
                    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
                
                if (customerOrders.length === 0) {
                    return new Date(vip.createdAt).getTime() < fortyFiveDaysAgo.getTime();
                }
                const lastOrderDate = new Date(customerOrders[0].orderDate);
                return lastOrderDate.getTime() < fortyFiveDaysAgo.getTime();
            });

        return {
            yesterdayStats,
            priorityTasks: { lateOrders, lowStockItems },
            missedOpportunities: { inactiveVips }
        };

    }, [orders, products, customers]);

    const handleCreateVoucherForCustomer = (customerName: string) => {
        const randomCode = `${customerName.split(' ').pop()?.toUpperCase() || 'VIP'}10`;
        const newVoucher: Partial<Voucher> = {
            code: randomCode,
            discountType: 'percentage',
            discountValue: 10,
            isActive: true,
            minOrderValue: 0
        };
        onOpenVoucherForm(newVoucher);
    }
    
    return (
        <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
            <div className="flex items-start md:items-center gap-4 mb-5 flex-col md:flex-row">
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                    <LightBulbIcon className="w-8 h-8"/>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-card-foreground">Bản tin buổi sáng từ Trợ lý AI</h2>
                    <p className="text-sm text-muted-foreground">Đây là những gì bạn cần chú ý để bắt đầu ngày làm việc hiệu quả.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Yesterday's Summary */}
                <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold text-card-foreground mb-3">Tóm tắt nhanh (Hôm qua)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-xs text-muted-foreground">Doanh thu</p>
                            <p className="text-lg font-bold text-primary">{formatCurrency(yesterdayStats.revenue)}</p>
                        </div>
                         <div>
                            <p className="text-xs text-muted-foreground">Lợi nhuận</p>
                            <p className="text-lg font-bold text-secondary">{formatCurrency(yesterdayStats.profit)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Đơn hàng mới</p>
                            <p className="text-lg font-bold text-card-foreground">{yesterdayStats.orderCount}</p>
                        </div>
                         <div>
                            <p className="text-xs text-muted-foreground">Sản phẩm đã bán</p>
                            <p className="text-lg font-bold text-card-foreground">{yesterdayStats.productsSoldCount}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Priority Tasks */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-card-foreground">Việc cần làm Ưu tiên</h3>
                        {priorityTasks.lateOrders.length === 0 && priorityTasks.lowStockItems.length === 0 ? (
                             <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg text-center">Mọi thứ đều ổn!</p>
                        ) : (
                            <ul className="space-y-2">
                                {priorityTasks.lateOrders.length > 0 && (
                                    <li className="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg flex items-start gap-3">
                                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0"/>
                                        <div className="text-sm">
                                            <p className="font-medium text-yellow-800 dark:text-yellow-200">
                                                Có {priorityTasks.lateOrders.length} đơn hàng xử lý chậm
                                            </p>
                                            <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                                Các đơn hàng này đã ở trạng thái chờ quá 24 giờ.
                                            </p>
                                            <button onClick={() => onNavigate('orders')} className="text-xs font-bold text-yellow-800 dark:text-yellow-200 hover:underline mt-1">Xem ngay</button>
                                        </div>
                                    </li>
                                )}
                                {priorityTasks.lowStockItems.length > 0 && (
                                     <li className="p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg flex items-start gap-3">
                                        <ShoppingBagIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0"/>
                                        <div className="text-sm">
                                             <p className="font-medium text-yellow-800 dark:text-yellow-200">
                                                {priorityTasks.lowStockItems.length} sản phẩm sắp hết hàng
                                            </p>
                                            <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                                {priorityTasks.lowStockItems[0].productName} ({priorityTasks.lowStockItems[0].size} - {priorityTasks.lowStockItems[0].color}) chỉ còn {priorityTasks.lowStockItems[0].stock}.
                                            </p>
                                            <button onClick={() => onNavigate('inventory')} className="text-xs font-bold text-yellow-800 dark:text-yellow-200 hover:underline mt-1">Kiểm tra kho</button>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>

                    {/* Missed Opportunities */}
                     <div className="space-y-3">
                        <h3 className="font-semibold text-card-foreground">Cơ hội Bỏ lỡ</h3>
                        {missedOpportunities.inactiveVips.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg text-center">Không có gợi ý nào.</p>
                        ) : (
                             <ul className="space-y-2">
                                {missedOpportunities.inactiveVips.map(customer => (
                                     <li key={customer.id} className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-start gap-3">
                                        <GiftIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0"/>
                                        <div className="text-sm">
                                             <p className="font-medium text-blue-800 dark:text-blue-200">
                                                Chăm sóc lại khách hàng VIP
                                            </p>
                                            <p className="text-xs text-blue-700 dark:text-blue-300">
                                                <strong>{customer.name}</strong> đã không mua hàng hơn 45 ngày.
                                            </p>
                                            <button onClick={() => handleCreateVoucherForCustomer(customer.name)} className="text-xs font-bold text-blue-800 dark:text-blue-200 hover:underline mt-1">Tặng voucher 10%</button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiBusinessCoPilot;