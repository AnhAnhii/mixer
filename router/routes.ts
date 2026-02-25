/**
 * Mixer Router Configuration
 * Maps Page IDs to URL paths for React Router.
 */

import type { Page } from '../types';

interface RouteConfig {
    path: string;
    pageId: Page;
    label: string;
}

export const routes: RouteConfig[] = [
    { path: '/', pageId: 'dashboard', label: 'Tổng quan' },
    { path: '/inbox', pageId: 'inbox', label: 'Inbox Center' },
    { path: '/orders', pageId: 'orders', label: 'Đơn hàng' },
    { path: '/workflow', pageId: 'workflow', label: 'Quy trình' },
    { path: '/inventory', pageId: 'inventory', label: 'Kho hàng' },
    { path: '/customers', pageId: 'customers', label: 'Khách hàng' },
    { path: '/returns', pageId: 'returns', label: 'Đổi/Trả hàng' },
    { path: '/vouchers', pageId: 'vouchers', label: 'Mã giảm giá' },
    { path: '/social', pageId: 'social', label: 'Social' },
    { path: '/automation', pageId: 'automation', label: 'Tự động hóa' },
    { path: '/staff', pageId: 'staff', label: 'Nhân sự' },
    { path: '/activity', pageId: 'activity', label: 'Hoạt động' },
    { path: '/reports', pageId: 'reports', label: 'Báo cáo' },
    { path: '/settings', pageId: 'settings', label: 'Cài đặt' },
    { path: '/profile', pageId: 'profile', label: 'Trang cá nhân' },
];

export function getPathForPage(pageId: Page): string {
    return routes.find((r) => r.pageId === pageId)?.path || '/';
}

export function getPageForPath(path: string): Page {
    return routes.find((r) => r.path === path)?.pageId || 'dashboard';
}
