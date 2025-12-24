
import React, { useMemo } from 'react';
import type { Order, Product, Customer, ActivityLog, Voucher } from '../types';
import { OrderStatus } from '../types';
import { CurrencyDollarIcon, ShoppingBagIcon, UserGroupIcon, CubeIcon, SparklesIcon } from './icons';
import DashboardSkeleton from './skeletons/DashboardSkeleton';
import ActivityFeed from './ActivityFeed';
import AiBusinessCoPilot from './AiBusinessCoPilot';

interface DashboardProps {
  orders: Order[];
  products: Product[];
  customers: Customer[];
  activityLog: ActivityLog[];
  onViewOrder: (order: Order) => void;
  onViewCustomer: (customer: Customer) => void;
  onNavigate: (view: string) => void;
  onOpenVoucherForm: (voucher: Partial<Voucher> | null) => void;
  onOpenStrategy: () => void; // New prop
  isLoading?: boolean;
}

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-card p-5 rounded-xl shadow-sm border border-border flex items-center gap-5">
        <div className="p-3 rounded-full bg-primary/10 text-primary">
            {icon}
        </div>
        <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-card-foreground">{value}</p>
        </div>
    </div>
);

const Dashboard: React.FC<DashboardProps> = React.memo(({ orders, products, customers, activityLog, onViewOrder, onViewCustomer, onNavigate, onOpenVoucherForm, onOpenStrategy, isLoading }) => {

    const { totalRevenue, pendingOrders, totalCustomers, totalProducts } = useMemo(() => {
        const revenue = orders
          .filter(o => o.status === OrderStatus.Delivered || o.status === OrderStatus.Shipped) // Also count shipped for revenue
          .reduce((sum, o) => sum + o.totalAmount, 0);
        
        const pending = orders.filter(o => o.status === OrderStatus.Pending || o.status === OrderStatus.Processing).length;

        return {
            totalRevenue: revenue,
            pendingOrders: pending,
            totalCustomers: customers.length,
            totalProducts: products.length
        };
    }, [orders, products, customers]);

    const recentOrders = useMemo(() => {
        return [...orders]
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
            .slice(0, 5);
    }, [orders]);

    const lowStockProducts = useMemo(() => {
        return products.flatMap(p => 
            p.variants.filter(v => v.stock > 0 && v.stock <= v.lowStockThreshold)
            .map(v => ({...v, productName: p.name}))
        ).sort((a,b) => a.stock - b.stock).slice(0, 5);
    }, [products]);

    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    
    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="space-y-8">
            {/* Header with Strategy Button */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-2xl font-semibold text-card-foreground">Tổng quan</h2>
                <button 
                    onClick={onOpenStrategy}
                    className="group relative inline-flex items-center justify-center px-6 py-2 text-sm font-medium text-white transition-all duration-200 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md hover:shadow-lg"
                >
                    <SparklesIcon className="w-4 h-4 mr-2 animate-pulse" />
                    Lập Chiến lược (AI)
                    <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-ping"></div>
                </button>
            </div>

            <AiBusinessCoPilot
                orders={orders}
                products={products}
                customers={customers}
                onNavigate={onNavigate}
                onViewOrder={onViewOrder}
                onViewCustomer={onViewCustomer}
                onOpenVoucherForm={onOpenVoucherForm}
            />

            <h2 className="text-2xl font-semibold text-card-foreground">Thống kê Toàn thời gian</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard title="Doanh thu" value={formatCurrency(totalRevenue)} icon={<CurrencyDollarIcon className="w-6 h-6"/>} />
                 <StatCard title="Đơn hàng chờ xử lý" value={pendingOrders} icon={<ShoppingBagIcon className="w-6 h-6"/>} />
                 <StatCard title="Tổng khách hàng" value={totalCustomers} icon={<UserGroupIcon className="w-6 h-6"/>} />
                 <StatCard title="Tổng sản phẩm" value={totalProducts} icon={<CubeIcon className="w-6 h-6"/>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                        <h3 className="text-lg font-semibold text-card-foreground mb-4">Đơn hàng gần đây</h3>
                        <div className="space-y-3">
                            {recentOrders.length > 0 ? recentOrders.map(order => (
                                <div key={order.id} onClick={() => onViewOrder(order)} className="flex justify-between items-center p-3 rounded-lg hover:bg-muted cursor-pointer border-b border-border last:border-b-0 compact-p">
                                    <div>
                                        <p className="font-medium text-card-foreground compact-text-base">{order.customerName}</p>
                                        <p className="text-xs text-muted-foreground compact-text-sm">#{order.id.substring(0,8)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-primary compact-text-base">{formatCurrency(order.totalAmount)}</p>
                                        <p className="text-xs text-muted-foreground compact-text-sm">{order.status}</p>
                                    </div>
                                </div>
                            )) : <p className="text-center text-muted-foreground py-8">Chưa có đơn hàng nào.</p>}
                        </div>
                    </div>
                     <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                        <h3 className="text-lg font-semibold text-card-foreground mb-4">Sản phẩm sắp hết hàng</h3>
                        <div className="space-y-3">
                            {lowStockProducts.length > 0 ? lowStockProducts.map(variant => (
                                <div key={variant.id} className="flex justify-between items-center p-3 rounded-lg border-b border-border last:border-b-0 compact-p">
                                    <div>
                                        <p className="font-medium text-card-foreground compact-text-base">{variant.productName}</p>
                                        <p className="text-xs text-muted-foreground compact-text-sm">{variant.size} - {variant.color}</p>
                                    </div>
                                    <p className="font-semibold text-yellow-600 dark:text-yellow-400 compact-text-base">Còn lại: {variant.stock}</p>
                                </div>
                            )) : <p className="text-center text-muted-foreground py-8">Không có sản phẩm nào sắp hết hàng.</p>}
                        </div>
                    </div>
                </div>
                 <div className="lg:col-span-1">
                    <ActivityFeed logs={activityLog} title="Hoạt động gần đây" limit={10} />
                </div>

            </div>
        </div>
    );
});

export default Dashboard;
