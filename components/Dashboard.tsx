
import React, { useMemo } from 'react';
import type { Order, Product, Customer, ActivityLog, Voucher } from '../types';
import { OrderStatus } from '../types';
import { CurrencyDollarIcon, ShoppingBagIcon, UserGroupIcon, CubeIcon, SparklesIcon, CheckCircleIcon } from './icons';
import DashboardSkeleton from './skeletons/DashboardSkeleton';
import ActivityFeed from './ActivityFeed';
import AiBusinessCoPilot from './AiBusinessCoPilot';
import { formatCurrency } from '../utils/formatters';

interface DashboardProps {
    orders: Order[];
    products: Product[];
    customers: Customer[];
    activityLog: ActivityLog[];
    onViewOrder: (order: Order) => void;
    onViewCustomer: (customer: Customer) => void;
    onNavigate: (view: string) => void;
    onOpenVoucherForm: (voucher: Partial<Voucher> | null) => void;
    onOpenStrategy: () => void;
    onOpenQuickPayment?: () => void;
    isLoading?: boolean;
}

const STAT_COLORS = [
    { bg: 'bg-accent-yellow', text: 'text-black' },
    { bg: 'bg-accent-orange', text: 'text-black' },
    { bg: 'bg-accent-mint', text: 'text-black' },
    { bg: 'bg-accent-blue', text: 'text-white' },
] as const;

const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    colorIdx: number;
}> = ({ title, value, icon, colorIdx }) => {
    const color = STAT_COLORS[colorIdx % STAT_COLORS.length];
    return (
        <div className={`${color.bg} ${color.text} p-5 border-2 border-black rounded-lg shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150 cursor-default`}>
            <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-black/10 rounded-lg">
                    {icon}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{title}</span>
            </div>
            <p className="text-3xl font-black font-heading">{value}</p>
        </div>
    );
};

const STATUS_BADGE: Record<string, string> = {
    'Chờ xử lý': 'bg-accent-yellow text-black border-black',
    'Đang xử lý': 'bg-accent-blue text-white border-black',
    'Đã gửi hàng': 'bg-accent-orange text-black border-black',
    'Đã giao hàng': 'bg-accent-mint text-black border-black',
    'Đã hủy': 'bg-accent-pink text-white border-black',
};

const Dashboard: React.FC<DashboardProps> = React.memo(({ orders, products, customers, activityLog, onViewOrder, onViewCustomer, onNavigate, onOpenVoucherForm, onOpenStrategy, onOpenQuickPayment, isLoading }) => {

    const { totalRevenue, pendingOrders, totalCustomers, totalProducts } = useMemo(() => {
        const revenue = orders
            .filter(o => o.status === OrderStatus.Delivered || o.status === OrderStatus.Shipped)
            .reduce((sum, o) => sum + o.totalAmount, 0);
        const pending = orders.filter(o => o.status === OrderStatus.Pending || o.status === OrderStatus.Processing).length;
        return { totalRevenue: revenue, pendingOrders: pending, totalCustomers: customers.length, totalProducts: products.length };
    }, [orders, products, customers]);

    const recentOrders = useMemo(() => {
        return [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()).slice(0, 5);
    }, [orders]);

    const lowStockProducts = useMemo(() => {
        return products.flatMap(p =>
            p.variants.filter(v => v.stock > 0 && v.stock <= v.lowStockThreshold)
                .map(v => ({ ...v, productName: p.name }))
        ).sort((a, b) => a.stock - b.stock).slice(0, 5);
    }, [products]);

    if (isLoading) return <DashboardSkeleton />;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-black font-heading tracking-tight">
                    Tổng quan 📊
                </h2>
                <div className="flex gap-3">
                    {onOpenQuickPayment && (
                        <button onClick={onOpenQuickPayment} className="inline-flex items-center px-4 py-2 text-sm font-bold bg-accent-mint text-black border-2 border-black rounded-lg shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150">
                            <CheckCircleIcon className="w-4 h-4 mr-2" />
                            Xác nhận TT
                        </button>
                    )}
                    <button onClick={onOpenStrategy} className="relative inline-flex items-center px-5 py-2 text-sm font-bold bg-black text-white border-2 border-black rounded-lg shadow-[3px_3px_0px_var(--color-accent-yellow)] hover:shadow-[5px_5px_0px_var(--color-accent-yellow)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150">
                        <SparklesIcon className="w-4 h-4 mr-2" />
                        Chiến lược AI
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-accent-pink rounded-full animate-ping" />
                    </button>
                </div>
            </div>

            {/* AI Co-Pilot */}
            <AiBusinessCoPilot
                orders={orders}
                products={products}
                customers={customers}
                onNavigate={onNavigate}
                onViewOrder={onViewOrder}
                onViewCustomer={onViewCustomer}
                onOpenVoucherForm={onOpenVoucherForm}
            />

            {/* Stat Cards */}
            <div>
                <h3 className="text-lg font-bold font-heading mb-4 uppercase tracking-wide">Thống kê toàn thời gian</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Doanh thu" value={formatCurrency(totalRevenue)} icon={<CurrencyDollarIcon className="w-5 h-5" />} colorIdx={0} />
                    <StatCard title="Chờ xử lý" value={pendingOrders} icon={<ShoppingBagIcon className="w-5 h-5" />} colorIdx={1} />
                    <StatCard title="Khách hàng" value={totalCustomers} icon={<UserGroupIcon className="w-5 h-5" />} colorIdx={2} />
                    <StatCard title="Sản phẩm" value={totalProducts} icon={<CubeIcon className="w-5 h-5" />} colorIdx={3} />
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Recent Orders */}
                    <div className="bg-card border-2 border-border rounded-lg shadow-[4px_4px_0px_var(--color-border)] p-6">
                        <h3 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
                            <ShoppingBagIcon className="w-5 h-5" />
                            Đơn hàng gần đây
                        </h3>
                        <div className="space-y-2">
                            {recentOrders.length > 0 ? recentOrders.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => onViewOrder(order)}
                                    className="flex justify-between items-center p-3 rounded-lg border border-border hover:bg-muted cursor-pointer hover:shadow-[2px_2px_0px_var(--color-border)] hover:-translate-x-px hover:-translate-y-px transition-all duration-150"
                                >
                                    <div>
                                        <p className="font-semibold text-sm">{order.customerName}</p>
                                        <p className="text-xs text-muted-foreground font-mono">#{order.id.substring(0, 8)}</p>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_BADGE[order.status] || 'bg-muted text-muted-foreground border-border'}`}>
                                            {order.status}
                                        </span>
                                        <p className="font-bold text-sm min-w-[90px] text-right">{formatCurrency(order.totalAmount)}</p>
                                    </div>
                                </div>
                            )) : <p className="text-center text-muted-foreground py-8">Chưa có đơn hàng nào.</p>}
                        </div>
                    </div>

                    {/* Low Stock */}
                    <div className="bg-card border-2 border-border rounded-lg shadow-[4px_4px_0px_var(--color-border)] p-6">
                        <h3 className="text-lg font-bold font-heading mb-4 flex items-center gap-2">
                            <CubeIcon className="w-5 h-5" />
                            Sản phẩm sắp hết hàng
                        </h3>
                        <div className="space-y-2">
                            {lowStockProducts.length > 0 ? lowStockProducts.map(variant => (
                                <div key={variant.id} className="flex justify-between items-center p-3 rounded-lg border border-border">
                                    <div>
                                        <p className="font-semibold text-sm">{variant.productName}</p>
                                        <p className="text-xs text-muted-foreground">{variant.size} — {variant.color}</p>
                                    </div>
                                    <span className="bg-accent-yellow text-black text-xs font-bold px-2 py-1 rounded border border-black">
                                        Còn {variant.stock}
                                    </span>
                                </div>
                            )) : <p className="text-center text-muted-foreground py-8">Không có sản phẩm sắp hết hàng.</p>}
                        </div>
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="lg:col-span-1">
                    <ActivityFeed logs={activityLog} title="Hoạt động gần đây" limit={10} />
                </div>
            </div>
        </div>
    );
});

export default Dashboard;
