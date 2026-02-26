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
                .map(v => ({ ...v, productName: p.name }))
        ).sort((a, b) => a.stock - b.stock);

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
        <div className="card-base p-6 bg-gradient-to-br from-white to-muted/20">
            <div className="flex items-start md:items-center gap-4 mb-8 flex-col md:flex-row">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-sm">
                    <LightBulbIcon className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-foreground tracking-tight">Bản tin buổi sáng từ Trợ lý AI</h2>
                    <p className="text-sm text-muted-foreground font-medium">Đây là những gì bạn cần chú ý để bắt đầu ngày làm việc hiệu quả.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Yesterday's Summary */}
                <div className="bg-white border border-border p-5 rounded-2xl shadow-sm">
                    <h3 className="text-xs font-bold font-heading mb-4 uppercase tracking-widest text-muted-foreground">Tóm tắt nhanh (Hôm qua)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Doanh thu</p>
                            <p className="text-lg font-bold text-primary">{formatCurrency(yesterdayStats.revenue)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Lợi nhuận</p>
                            <p className="text-lg font-bold text-secondary">{formatCurrency(yesterdayStats.profit)}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Đơn hàng mới</p>
                            <p className="text-lg font-bold text-foreground">{yesterdayStats.orderCount}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Sản phẩm đã bán</p>
                            <p className="text-lg font-bold text-foreground">{yesterdayStats.productsSoldCount}</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Priority Tasks */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 px-1">
                            <ExclamationTriangleIcon className="w-4 h-4 text-accent-yellow" />
                            Việc cần làm Ưu tiên
                        </h3>
                        {priorityTasks.lateOrders.length === 0 && priorityTasks.lowStockItems.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-6 bg-muted/30 rounded-2xl text-center border border-dashed border-border italic">Mọi thứ đều ổn!</p>
                        ) : (
                            <ul className="space-y-3">
                                {priorityTasks.lateOrders.length > 0 && (
                                    <li className="p-4 bg-accent-yellow/5 border border-accent-yellow/20 rounded-2xl flex items-start gap-3 transition-all hover:bg-accent-yellow/10">
                                        <div className="p-1.5 bg-accent-yellow/20 rounded-lg text-accent-yellow shrink-0">
                                            <ExclamationTriangleIcon className="w-4 h-4" />
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-bold text-foreground">
                                                Có {priorityTasks.lateOrders.length} đơn hàng xử lý chậm
                                            </p>
                                            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                                                Các đơn hàng này đã ở trạng thái chờ quá 24 giờ.
                                            </p>
                                            <button onClick={() => onNavigate('orders')} className="text-xs font-bold text-primary hover:underline mt-2 inline-flex items-center gap-1">Xem ngay <span>→</span></button>
                                        </div>
                                    </li>
                                )}
                                {priorityTasks.lowStockItems.length > 0 && (
                                    <li className="p-4 bg-accent-yellow/5 border border-accent-yellow/20 rounded-2xl flex items-start gap-3 transition-all hover:bg-accent-yellow/10">
                                        <div className="p-1.5 bg-accent-yellow/20 rounded-lg text-accent-yellow shrink-0">
                                            <ShoppingBagIcon className="w-4 h-4" />
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-bold text-foreground">
                                                {priorityTasks.lowStockItems.length} sản phẩm sắp hết hàng
                                            </p>
                                            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                                                <strong>{priorityTasks.lowStockItems[0].productName}</strong> chỉ còn {priorityTasks.lowStockItems[0].stock} sản phẩm trong kho.
                                            </p>
                                            <button onClick={() => onNavigate('inventory')} className="text-xs font-bold text-primary hover:underline mt-2 inline-flex items-center gap-1">Kiểm tra kho <span>→</span></button>
                                        </div>
                                    </li>
                                )}
                            </ul>
                        )}
                    </div>

                    {/* Missed Opportunities */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 px-1">
                            <GiftIcon className="w-4 h-4 text-primary" />
                            Cơ hội Bỏ lỡ
                        </h3>
                        {missedOpportunities.inactiveVips.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-6 bg-muted/30 rounded-2xl text-center border border-dashed border-border italic">Không có gợi ý nào.</p>
                        ) : (
                            <ul className="space-y-3">
                                {missedOpportunities.inactiveVips.map(customer => (
                                    <li key={customer.id} className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-start gap-3 transition-all hover:bg-primary/10">
                                        <div className="p-1.5 bg-primary/20 rounded-lg text-primary shrink-0">
                                            <GiftIcon className="w-4 h-4" />
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-bold text-foreground">
                                                Chăm sóc lại khách hàng VIP
                                            </p>
                                            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                                                <strong>{customer.name}</strong> đã không mua hàng hơn 45 ngày.
                                            </p>
                                            <button onClick={() => handleCreateVoucherForCustomer(customer.name)} className="btn-muted mt-3 px-3 py-1.5 text-[11px] font-bold inline-flex items-center gap-1.5">
                                                Tặng voucher 10%
                                            </button>
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