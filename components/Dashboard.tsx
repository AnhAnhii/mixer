
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
    { border: 'border-t-primary', iconBg: 'bg-primary/10', iconColor: 'text-primary' },
    { border: 'border-t-secondary', iconBg: 'bg-secondary/10', iconColor: 'text-secondary' },
    { border: 'border-t-accent-yellow', iconBg: 'bg-accent-yellow/10', iconColor: 'text-accent-yellow' },
    { border: 'border-t-accent-pink', iconBg: 'bg-accent-pink/10', iconColor: 'text-accent-pink' },
] as const;

const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    colorIdx: number;
}> = ({ title, value, icon, colorIdx }) => {
    const color = STAT_COLORS[colorIdx % STAT_COLORS.length];
    return (
        <div className={`p-6 bg-white border border-border/50 rounded-[32px] shadow-soft-sm hover:shadow-soft-md transition-all group overflow-hidden relative`}>
            <div className={`absolute top-0 right-0 w-24 h-24 ${color.iconBg} rounded-full -mr-8 -mt-8 opacity-20 group-hover:scale-125 transition-transform duration-700`}></div>
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-3 ${color.iconBg} ${color.iconColor} rounded-2xl`}>
                    {icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{title}</span>
            </div>
            <p className="text-3xl font-black font-heading text-foreground tracking-tighter relative z-10">{value}</p>
        </div>
    );
};

const STATUS_BADGE: Record<string, string> = {
    'Chờ xử lý': 'status-warning',
    'Đang xử lý': 'status-info',
    'Đã gửi hàng': 'status-info',
    'Đã giao hàng': 'status-success',
    'Đã hủy': 'status-danger',
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-[28px] font-black font-heading tracking-tight text-foreground leading-none">
                        Tổng quan 📊
                    </h2>
                    <p className="text-[13px] font-bold text-muted-foreground mt-2">Chào mừng trở lại! Đây là tóm tắt hoạt động kinh doanh hôm nay.</p>
                </div>
                <div className="flex gap-3">
                    {onOpenQuickPayment && (
                        <button onClick={onOpenQuickPayment} className="px-6 py-3 bg-white text-secondary hover:bg-muted border border-border rounded-xl font-black text-[13px] transition-all flex items-center shadow-soft-sm">
                            <CheckCircleIcon className="w-4 h-4 mr-2" />
                            Xác nhận TT
                        </button>
                    )}
                    <button onClick={onOpenStrategy} className="px-8 py-3 bg-primary text-white hover:bg-primary-dark rounded-xl font-black text-[14px] shadow-soft-lg active:scale-95 transition-all flex items-center relative border-b-4 border-primary-dark/30">
                        <SparklesIcon className="w-4 h-4 mr-2" />
                        Chiến lược AI
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-status-danger rounded-full border-2 border-white shadow-sm animate-bounce" />
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
                <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Thống kê hiệu suất
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Doanh thu" value={formatCurrency(totalRevenue)} icon={<CurrencyDollarIcon className="w-5 h-5" />} colorIdx={0} />
                    <StatCard title="Chờ xử lý" value={pendingOrders} icon={<ShoppingBagIcon className="w-5 h-5" />} colorIdx={1} />
                    <StatCard title="Khách hàng" value={totalCustomers} icon={<UserGroupIcon className="w-5 h-5" />} colorIdx={2} />
                    <StatCard title="Sản phẩm" value={totalProducts} icon={<CubeIcon className="w-5 h-5" />} colorIdx={3} />
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Recent Orders */}
                    <div className="p-8 bg-muted/20 border border-border/50 rounded-[32px]">
                        <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
                            Đơn hàng gần đây
                        </h3>
                        <div className="space-y-4">
                            {recentOrders.length > 0 ? recentOrders.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => onViewOrder(order)}
                                    className="flex justify-between items-center p-4 bg-white rounded-[20px] border border-border hover:border-primary/20 hover:shadow-soft-md transition-all cursor-pointer group shadow-soft-sm"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                            {order.customerName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-[13px] text-foreground">{order.customerName}</p>
                                            <p className="text-[11px] text-muted-foreground font-medium">#{order.id.substring(0, 8)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-4">
                                        <span className={`status-pill ${STATUS_BADGE[order.status] || 'bg-muted text-muted-foreground'}`}>
                                            {order.status}
                                        </span>
                                        <p className="font-bold text-[13px] min-w-[100px] text-foreground">{formatCurrency(order.totalAmount)}</p>
                                    </div>
                                </div>
                            )) : <p className="text-center text-muted-foreground py-8">Chưa có đơn hàng nào.</p>}
                        </div>
                    </div>

                    {/* Low Stock */}
                    <div className="p-8 bg-muted/20 border border-border/50 rounded-[32px]">
                        <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-status-warning rounded-full"></div>
                            Sản phẩm sắp hết hàng
                        </h3>
                        <div className="space-y-4">
                            {lowStockProducts.length > 0 ? lowStockProducts.map(variant => (
                                <div key={variant.id} className="flex justify-between items-center p-4 bg-white rounded-[20px] border border-border shadow-soft-sm group hover:border-status-warning/30 transition-all">
                                    <div>
                                        <p className="font-black text-[14px] text-foreground group-hover:text-status-warning transition-colors">{variant.productName}</p>
                                        <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mt-1">{variant.size} — {variant.color}</p>
                                    </div>
                                    <span className="px-3 py-1.5 rounded-lg bg-status-warning/10 text-status-warning border border-status-warning/20 text-[10px] font-black uppercase tracking-widest">
                                        Còn {variant.stock}
                                    </span>
                                </div>
                            )) : (
                                <div className="p-10 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center bg-white/50 grayscale opacity-40">
                                    <CubeIcon className="w-10 h-10 mb-2" />
                                    <p className="text-[13px] font-bold">Kho hàng đầy đủ</p>
                                </div>
                            )}
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
