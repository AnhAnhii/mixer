import React, { useState, useMemo } from 'react';
import type { Order } from '../types';
import { CurrencyDollarIcon, ShoppingBagIcon } from './icons';
import BarChart from './charts/BarChart';

interface ReportsPageProps {
  orders: Order[];
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

const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
}

const ReportsPage: React.FC<ReportsPageProps> = ({ orders }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [startDate, setStartDate] = useState(formatDateForInput(thirtyDaysAgo));
    const [endDate, setEndDate] = useState(formatDateForInput(new Date()));

    const { reportStats, productPerformance, customerRanking, revenueByDay } = useMemo(() => {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const startTs = start.getTime();

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const endTs = end.getTime();

        const filtered = orders.filter(o => {
            const orderDate = new Date(o.orderDate).getTime();
            return orderDate >= startTs && orderDate <= endTs;
        });

        const totalRevenue = filtered.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalProfit = filtered.reduce((sum, o) => {
             const orderProfit = o.items.reduce((itemSum, item) => itemSum + ((item.price - item.costPrice) * item.quantity), 0);
             return sum + orderProfit;
        }, 0);
        const totalOrders = filtered.length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        const stats = { totalRevenue, totalProfit, totalOrders, avgOrderValue };

        const productPerfMap = new Map<string, { name: string; unitsSold: number; revenue: number; profit: number }>();
        filtered.forEach(o => {
            o.items.forEach(i => {
                const existing = productPerfMap.get(i.productId) || { name: i.productName, unitsSold: 0, revenue: 0, profit: 0 };
                existing.unitsSold += i.quantity;
                existing.revenue += i.price * i.quantity;
                existing.profit += (i.price - i.costPrice) * i.quantity;
                productPerfMap.set(i.productId, existing);
            });
        });
        const productPerf = Array.from(productPerfMap.values()).sort((a, b) => b.revenue - a.revenue);

        const customerRankMap = new Map<string, { name: string; totalOrders: number; totalSpent: number }>();
         filtered.forEach(o => {
             const existing = customerRankMap.get(o.customerId) || { name: o.customerName, totalOrders: 0, totalSpent: 0 };
             existing.totalOrders += 1;
             existing.totalSpent += o.totalAmount;
             customerRankMap.set(o.customerId, existing);
         });
        const customerRank = Array.from(customerRankMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);

        const revenueByDayMap = new Map<string, number>();
        filtered.forEach(o => {
            const day = new Date(o.orderDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            const currentRevenue = revenueByDayMap.get(day) || 0;
            revenueByDayMap.set(day, currentRevenue + o.totalAmount);
        });
        const revByDay = Array.from(revenueByDayMap.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a,b) => {
                const [dayA, monthA] = a.label.split('/');
                const [dayB, monthB] = b.label.split('/');
                return new Date(`${monthA}/${dayA}/2024`).getTime() - new Date(`${monthB}/${dayB}/2024`).getTime();
            });


        return { reportStats: stats, productPerformance: productPerf, customerRanking: customerRank, revenueByDay: revByDay };

    }, [orders, startDate, endDate]);
    
    const formatCurrency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    const formatCurrencyShort = (amount: number) => {
        if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)}tr`;
        if (amount >= 1e3) return `${(amount / 1e3).toFixed(0)}k`;
        return amount.toString();
    }


    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-border pb-4">
                <h2 className="text-2xl font-semibold text-card-foreground">Báo cáo & Phân tích</h2>
            </div>

            {/* Date Filters */}
            <div className="bg-card p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-center gap-4 border border-border">
                <p className="font-medium text-card-foreground">Chọn khoảng thời gian:</p>
                <div className="flex items-center gap-2">
                    <label htmlFor="start-date" className="text-sm">Từ</label>
                    <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-base p-2 border" />
                </div>
                 <div className="flex items-center gap-2">
                    <label htmlFor="end-date" className="text-sm">Đến</label>
                    <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-base p-2 border" />
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCard title="Tổng doanh thu" value={formatCurrency(reportStats.totalRevenue)} icon={<CurrencyDollarIcon className="w-6 h-6"/>} />
                 <StatCard title="Tổng lợi nhuận" value={formatCurrency(reportStats.totalProfit)} icon={<CurrencyDollarIcon className="w-6 h-6"/>} />
                 <StatCard title="Tổng đơn hàng" value={reportStats.totalOrders} icon={<ShoppingBagIcon className="w-6 h-6"/>} />
                 <StatCard title="Đơn hàng trung bình" value={formatCurrency(reportStats.avgOrderValue)} icon={<CurrencyDollarIcon className="w-6 h-6"/>} />
            </div>

             {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <BarChart data={revenueByDay} title="Doanh thu theo ngày" formatValue={formatCurrencyShort} />
                <BarChart 
                    data={productPerformance.slice(0, 5).map(p => ({ label: p.name, value: p.revenue }))}
                    title="Top 5 sản phẩm theo doanh thu"
                    formatValue={formatCurrencyShort}
                />
            </div>


            {/* Data Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Product Performance */}
                <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                    <h3 className="text-lg font-semibold text-card-foreground mb-4">Hiệu suất Sản phẩm</h3>
                    <div className="overflow-x-auto max-h-96">
                       {productPerformance.length > 0 ? (
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Sản phẩm</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Đã bán</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Doanh thu</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Lợi nhuận</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-border">
                                    {productPerformance.map(p => (
                                        <tr key={p.name}>
                                            <td className="px-4 py-3 text-sm font-medium text-card-foreground">{p.name}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground text-right">{p.unitsSold}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground text-right">{formatCurrency(p.revenue)}</td>
                                            <td className="px-4 py-3 text-sm text-green-600 font-semibold text-right">{formatCurrency(p.profit)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                             <p className="text-center text-muted-foreground py-8">Không có dữ liệu trong khoảng thời gian này.</p>
                        )}
                    </div>
                </div>

                {/* Customer Ranking */}
                <div className="bg-card p-6 rounded-xl shadow-sm border border-border">
                    <h3 className="text-lg font-semibold text-card-foreground mb-4">Xếp hạng Khách hàng</h3>
                    <div className="overflow-x-auto max-h-96">
                        {customerRanking.length > 0 ? (
                            <table className="min-w-full divide-y divide-border">
                                <thead className="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Khách hàng</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Số đơn</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Tổng chi tiêu</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-card divide-y divide-border">
                                     {customerRanking.map(c => (
                                        <tr key={c.name}>
                                            <td className="px-4 py-3 text-sm font-medium text-card-foreground">{c.name}</td>
                                            <td className="px-4 py-3 text-sm text-muted-foreground text-right">{c.totalOrders}</td>
                                            <td className="px-4 py-3 text-sm text-primary font-semibold text-right">{formatCurrency(c.totalSpent)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">Không có dữ liệu trong khoảng thời gian này.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsPage;