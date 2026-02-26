import React, { useState, useEffect, useRef } from 'react';

// Components
import Dashboard from './components/Dashboard';
import OrderListPage from './components/OrderListPage';
import KanbanBoardPage from './components/KanbanBoardPage';
import InventoryList from './components/InventoryList';
import CustomerListPage from './components/CustomerListPage';
import VoucherListPage from './components/VoucherListPage';
import ReportsPage from './components/ReportsPage';
import SettingsPage from './components/SettingsPage';
import Modal from './components/Modal';
import OrderForm from './components/OrderForm';
import ProductForm from './components/ProductForm';
import CustomerForm from './components/CustomerForm';
import VoucherForm from './components/VoucherForm';
import OrderDetailModal from './components/OrderDetailModal';
import CustomerDetailModal from './components/CustomerDetailModal';
import QuickOrderModal from './components/QuickOrderModal';
import QuickPaymentConfirmModal from './components/QuickPaymentConfirmModal';
import MessageTemplatesModal from './components/MessageTemplatesModal';
import InvoicePage from './components/InvoicePage';
import SocialPage from './components/SocialPage';
import AutomationPage from './components/AutomationPage';
import AutomationForm from './components/AutomationForm';
import ActivityPage from './components/ActivityPage';
import { ToastProvider, useToast } from './components/Toast';
import CommandPalette, { Command } from './components/CommandPalette';
import DashboardSkeleton from './components/skeletons/DashboardSkeleton';
import OrderListPageSkeleton from './components/skeletons/OrderListPageSkeleton';
import TablePageSkeleton from './components/skeletons/TablePageSkeleton';
import SkeletonLoader from './components/skeletons/SkeletonLoader';
import ReturnsPage from './components/ReturnsPage';
import ReturnRequestModal from './components/ReturnRequestModal';
import ReturnRequestDetailModal from './components/ReturnRequestDetailModal';
import VnPayPaymentModal from './components/VnPayPaymentModal';
import StrategyModal from './components/StrategyModal';
// New Components
import LoginPage from './components/LoginPage';
import ProfilePage from './components/ProfilePage';
import StaffManagement from './components/StaffManagement';
import InboxCommandCenter from './components/InboxCommandCenter';


// Icons
import {
    AppLogoIcon, ChartPieIcon, ShoppingBagIcon, CubeIcon, UserGroupIcon, TicketIcon,
    Cog6ToothIcon, ChartBarIcon, Bars3Icon, XMarkIcon, ChatBubbleLeftEllipsisIcon, Squares2X2Icon,
    PlusIcon, MoonIcon, SunIcon, SparklesIcon, BoltIcon, ClockIcon, ViewColumnsIcon, RssIcon, ArrowUturnLeftIcon,
    ArrowsPointingInIcon, ArrowsPointingOutIcon, ArrowPathIcon, UserCircleIcon, ShieldCheckIcon, ArrowDownTrayIcon
} from './components/icons';
import { logger } from './utils/logger';

// Hooks & Data
import { useLocalStorage } from './hooks/useLocalStorage';
import { useProductsData, useCustomersData, useOrdersData, useVouchersData, useBankInfoData, useActivityLogsData, useAutomationRulesData, useReturnRequestsData, useDataSourceStatus, useSocialConfigsData } from './hooks/useData';
import { useFacebookMessenger } from './hooks/useFacebookMessenger';
import { useActivityLogger } from './hooks/useActivityLogger';
import { useAutomations } from './hooks/useAutomations';
import { useAuth } from './hooks/useAuth';
import { useAppNavigation } from './router/useAppNavigation';
import { sampleProducts, sampleCustomers, sampleOrders, sampleFacebookPosts, sampleAutomationRules, sampleActivityLogs, sampleReturnRequests } from './data/sampleData';
import { syncOrderDirect, loadGoogleSheetsSettings } from './services/googleSheetsService';
import { GOOGLE_SCRIPT_URL } from './config';

// Types
import type { Order, Product, Customer, Voucher, BankInfo, ParsedOrderData, ParsedOrderItem, OrderItem, SocialPostConfig, UiMode, ThemeSettings, ActivityLog, AutomationRule, Page, User, DiscussionEntry, PaymentStatus, ReturnRequest, ReturnRequestItem, ProductVariant, GoogleSheetsConfig, Role } from './types';
import { OrderStatus, ReturnRequestStatus } from './types';

// Main App Logic
const AppContent: React.FC = () => {
    const { login, logout, hasPermission, users, setUsers, roles, setRoles, updateProfile } = useAuth();
    const [appIsLoading, setAppIsLoading] = useState(true);
    const [isInitialSyncing, setIsInitialSyncing] = useState(false);

    // Main state - Using Supabase with localStorage fallback
    const { products, setProducts, addProduct, updateProduct, deleteProduct, isLoading: productsLoading, source: productsSource } = useProductsData();
    const { customers, setCustomers, addCustomer, updateCustomer, deleteCustomer, isLoading: customersLoading } = useCustomersData();
    const { orders, setOrders, addOrder, updateOrder, deleteOrder, isLoading: ordersLoading } = useOrdersData();
    const { vouchers, setVouchers, addVoucher, updateVoucher, deleteVoucher, isLoading: vouchersLoading } = useVouchersData();
    const { bankInfo, setBankInfo, isLoading: bankInfoLoading } = useBankInfoData();
    const { socialConfigs, setSocialConfigs, isLoading: socialConfigsLoading } = useSocialConfigsData();

    // Activity Log and Automation - Using Supabase
    const { logs: activityLog, setLogs: setActivityLog, isLoading: activityLoading } = useActivityLogsData();
    const { rules: automationRules, setRules: setAutomationRules, addRule, updateRule, deleteRule, toggleRule, isLoading: automationLoading } = useAutomationRulesData();

    // Return/Exchange State - Using Supabase
    const { returnRequests, setReturnRequests, updateStatus: updateReturnStatus, isLoading: returnsLoading } = useReturnRequestsData();

    // Data source status
    const { source: dataSource, isSupabaseConfigured, isSupabaseConnected } = useDataSourceStatus();

    // Note: Google Sheets removed - using Supabase for data storage

    const toast = useToast();

    // Refs for data tracking
    const allDataRef = useRef<any>(null);

    // URL-based routing now handles view persistence
    const { currentPage: view, navigateTo } = useAppNavigation();
    const setView = navigateTo; // backward-compatible alias

    // Invoice State (must be outside renderView)
    const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);


    // --- App Loading Complete ---
    useEffect(() => {
        // Load Google Sheets settings into cache
        loadGoogleSheetsSettings().catch(console.error);

        // App is ready - Supabase will handle data loading via hooks
        const timer = setTimeout(() => {
            setAppIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, []); // Run once on mount

    // Update refs whenever data changes (for automation/export features)
    useEffect(() => {
        allDataRef.current = {
            orders, products, customers, vouchers, bankInfo, socialConfigs, uiMode, activityLog, automationRules, returnRequests, users
        };
    }, [orders, products, customers, vouchers, bankInfo, socialConfigs, uiMode, activityLog, automationRules, returnRequests, users]);

    // --- Data Migration & Safety Checks ---
    useEffect(() => {
        if (users.length > 0) {
            const usersWithoutRole = users.filter(u => !u.roleId);
            if (usersWithoutRole.length > 0) {
                if ((import.meta as any).env.DEV) {
                    console.log("Migrating user data: Adding default roles...", usersWithoutRole);
                }
                setUsers(prev => prev.map(u => {
                    if (!u.roleId) {
                        return { ...u, roleId: 'role-admin' };
                    }
                    return u;
                }));
            }
        }
    }, [users, setUsers]);

    // --- Activity & Automation Logic ---
    const { logActivity, currentUser } = useActivityLogger();
    const { runAutomations } = useAutomations(automationRules, setCustomers);


    // URL-based routing now handles view persistence

    useEffect(() => {
        const timer = setTimeout(() => {
            setAppIsLoading(false);
        }, 1200);
        return () => clearTimeout(timer);
    }, []);



    const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<Partial<Order> | null>(null);
    const [isProductFormOpen, setIsProductFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [isVoucherFormOpen, setIsVoucherFormOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
    const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
    const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
    const [isQuickOrderOpen, setIsQuickOrderOpen] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [messageTemplateOrder, setMessageTemplateOrder] = useState<Order | null>(null);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [isAutomationFormOpen, setIsAutomationFormOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isZenMenuOpen, setIsZenMenuOpen] = useState(false);
    const [returnRequestOrder, setReturnRequestOrder] = useState<Order | null>(null);
    const [viewingReturnRequest, setViewingReturnRequest] = useState<ReturnRequest | null>(null);
    const [isVnPayModalOpen, setIsVnPayModalOpen] = useState(false);
    const [payingOrder, setPayingOrder] = useState<Order | null>(null);
    const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);
    const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);

    const isAnyModalOpen = isOrderFormOpen || isProductFormOpen || isCustomerFormOpen || isVoucherFormOpen || !!viewingOrder || !!viewingCustomer || isQuickOrderOpen || !!messageTemplateOrder || isZenMenuOpen || isAutomationFormOpen || isCommandPaletteOpen || !!returnRequestOrder || !!viewingReturnRequest || isVnPayModalOpen || isStrategyModalOpen;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);


    const handleOpenOrderForm = (order: Partial<Order> | null = null) => { setEditingOrder(order); setIsOrderFormOpen(true); };
    const handleOpenProductForm = (product: Product | null = null) => { setEditingProduct(product); setIsProductFormOpen(true); };
    const handleOpenCustomerForm = (customer: Customer | null = null) => { setEditingCustomer(customer); setIsCustomerFormOpen(true); };
    const handleOpenVoucherForm = (voucher: Voucher | null = null) => { setEditingVoucher(voucher); setIsVoucherFormOpen(true); }
    const handleOpenAutomationForm = (rule: AutomationRule | null = null) => { setEditingRule(rule); setIsAutomationFormOpen(true); }
    const handleViewOrderDetails = (order: Order) => setViewingOrder(order);
    const handleViewCustomerDetails = (customer: Customer) => setViewingCustomer(customer);
    const handleOpenReturnRequest = (order: Order) => setReturnRequestOrder(order);
    const handleViewReturnDetails = (request: ReturnRequest) => setViewingReturnRequest(request);

    const { sendMessageToFacebook, sendOrderStatusToCustomer } = useFacebookMessenger(bankInfo);

    const handleDeleteOrder = async (orderId: string) => {
        await deleteOrder(orderId);
        logActivity(`<strong>${currentUser?.name}</strong> đã xóa đơn hàng <strong>#${orderId.substring(0, 8)}</strong>.`, orderId, 'order');
        // Sync delete to Google Sheets
        syncOrderDirect({ id: orderId } as any, 'delete').catch(console.error);
        toast.success('Đã xóa đơn hàng.');
    };

    const handleDeleteCustomer = async (customerId: string) => {
        await deleteCustomer(customerId);
        logActivity(`<strong>${currentUser?.name}</strong> đã xóa khách hàng.`, customerId, 'customer');
        toast.success('Đã xóa khách hàng.');
    };

    const handleBulkDeleteCustomers = async (customerIds: string[]) => {
        for (const id of customerIds) {
            await deleteCustomer(id);
        }
        toast.success(`Đã xóa ${customerIds.length} khách hàng.`);
    }

    const handleDeleteProduct = async (productId: string) => {
        await deleteProduct(productId);
        toast.success('Đã xóa sản phẩm.');
    }

    const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
        await updateOrder(orderId, { status });
        logActivity(`<strong>${currentUser?.name}</strong> đã cập nhật trạng thái đơn hàng <strong>#${orderId.substring(0, 8)}</strong> thành <strong>${status}</strong>.`, orderId, 'order');

        // Sync to Google Sheets
        const orderToSync = orders.find(o => o.id === orderId);
        if (orderToSync) {
            syncOrderDirect({ ...orderToSync, status, staffName: currentUser?.name }, 'update').catch(console.error);

            // 🔔 TỰ ĐỘNG GỬI THÔNG BÁO CHO KHÁCH
            if (orderToSync.facebookUserId) {
                const updatedOrder = { ...orderToSync, status };
                // Chỉ gửi cho các trạng thái quan trọng
                if (status === 'Đang xử lý' || status === 'Đã gửi hàng' || status === 'Đã giao hàng') {
                    sendOrderStatusToCustomer(updatedOrder, status as 'Đang xử lý' | 'Đã gửi hàng' | 'Đã giao hàng');
                    toast.success('📲 Đã gửi thông báo đến khách hàng!');
                }
            }
        }

        toast.success('Đã cập nhật trạng thái.');
    };

    const handleConfirmPayment = async (orderId: string) => {
        // Update order: payment = Paid, status = Processing
        await updateOrder(orderId, { paymentStatus: 'Paid', status: OrderStatus.Processing });
        logActivity(`<strong>${currentUser?.name}</strong> đã xác nhận thanh toán cho đơn hàng <strong>#${orderId.substring(0, 8)}</strong>.`, orderId, 'order');

        // Sync to Google Sheets
        const orderToSync = orders.find(o => o.id === orderId);
        if (orderToSync) {
            syncOrderDirect({
                ...orderToSync,
                paymentStatus: 'Paid',
                status: OrderStatus.Processing,
                staffName: currentUser?.name
            }, 'update').catch(console.error);

            // Auto send Facebook message: Đang xử lý
            if (orderToSync.facebookUserId) {
                sendOrderStatusToCustomer({
                    ...orderToSync,
                    paymentStatus: 'Paid',
                    status: OrderStatus.Processing
                }, 'Đang xử lý').catch(console.error);
            }
        }

        // Update viewingOrder if currently viewing this order
        if (viewingOrder && viewingOrder.id === orderId) {
            setViewingOrder({ ...viewingOrder, paymentStatus: 'Paid', status: OrderStatus.Processing });
        }

        toast.success('Đã xác nhận thanh toán!');
    };

    // Cập nhật thông tin vận chuyển và TỰ ĐỘNG gửi thông báo cho khách
    const handleUpdateShipping = async (orderId: string, provider: string, trackingCode: string) => {
        // Update order state
        setOrders(prev => prev.map(o =>
            o.id === orderId
                ? { ...o, shippingProvider: provider, trackingCode: trackingCode, status: OrderStatus.Shipped }
                : o
        ));

        // Update in database
        await updateOrder(orderId, {
            shippingProvider: provider,
            trackingCode: trackingCode,
            status: OrderStatus.Shipped
        });

        // Log activity
        logActivity(
            `<strong>${currentUser?.name}</strong> đã cập nhật vận chuyển cho đơn <strong>#${orderId.substring(0, 8)}</strong>: ${provider} - ${trackingCode}`,
            orderId,
            'order'
        );

        // Sync to Google Sheets
        const orderToSync = orders.find(o => o.id === orderId);
        if (orderToSync) {
            syncOrderDirect({
                ...orderToSync,
                shippingProvider: provider,
                trackingCode: trackingCode,
                status: OrderStatus.Shipped,
                staffName: currentUser?.name
            }, 'update').catch(console.error);

            // 🔔 TỰ ĐỘNG GỬI THÔNG BÁO CHO KHÁCH
            if (orderToSync.facebookUserId) {
                const updatedOrder = { ...orderToSync, shippingProvider: provider, trackingCode: trackingCode };
                sendOrderStatusToCustomer(updatedOrder, 'Đã gửi hàng');
                toast.success('📲 Đã gửi thông báo đến khách hàng!');
            }
        }

        // Update viewingOrder if currently viewing this order
        if (viewingOrder && viewingOrder.id === orderId) {
            setViewingOrder({
                ...viewingOrder,
                shippingProvider: provider,
                trackingCode: trackingCode,
                status: OrderStatus.Shipped
            });
        }

        toast.success('Đã cập nhật thông tin vận chuyển!');
    };

    const handleSaveOrder = async (order: Order, customerToSave: Customer) => {
        const orderIdShort = order.id.substring(0, 8);
        const isEditing = orders.some(o => o.id === order.id);

        // Save/Update customer using Supabase hooks
        const customerIndex = customers.findIndex(c => c.id === customerToSave.id);
        if (customerIndex > -1) {
            await updateCustomer(customerToSave.id, customerToSave);
        } else {
            // Strip id for new customer - Supabase will generate UUID
            const { id: _customerId, ...customerWithoutId } = customerToSave;
            await addCustomer(customerWithoutId);
        }

        // Save/Update order using Supabase hooks
        if (isEditing) {
            await updateOrder(order.id, order);
            logActivity(`<strong>${currentUser?.name}</strong> đã cập nhật đơn hàng <strong>#${orderIdShort}</strong>.`, order.id, 'order');
            // Sync to Google Sheets
            syncOrderDirect({ ...order, staffName: currentUser?.name }, 'update').catch(console.error);
        } else {
            // Strip id for new order - Supabase will generate UUID
            const { id: _orderId, ...orderWithoutId } = order;
            const newOrder = await addOrder(orderWithoutId);
            if (newOrder) {
                logActivity(`<strong>${currentUser?.name}</strong> đã tạo đơn hàng mới <strong>#${newOrder.id.substring(0, 8)}</strong>.`, newOrder.id, 'order');
                runAutomations('ORDER_CREATED', { order: newOrder });
                // Sync to Google Sheets
                syncOrderDirect({ ...newOrder, staffName: currentUser?.name }, 'create').catch(console.error);

                // Auto send Facebook message if order was created from Inbox (has facebookUserId)
                if (newOrder.facebookUserId) {
                    sendOrderStatusToCustomer(newOrder, 'Chờ xử lý').catch(console.error);
                }
            }
        }
        setIsOrderFormOpen(false);
        setEditingOrder(null);
        toast.success('Lưu đơn hàng thành công!');
    };

    const handleQuickOrderParse = async (text: string, useThinkingMode: boolean) => {
        setIsAiLoading(true);
        setAiError(null);

        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `
                        Trích xuất thông tin đơn hàng từ văn bản sau đây thành JSON.
                        Văn bản: "${text}"
                        
                        Danh sách sản phẩm hiện có trong kho (để đối chiếu tên và ID):
                        ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, variants: p.variants.map(v => ({ id: v.id, size: v.size, color: v.color })) })))}
                        
                        Yêu cầu:
                        - Tìm tên khách hàng, số điện thoại, địa chỉ.
                        - Tìm các sản phẩm được nhắc đến. Cố gắng khớp với danh sách sản phẩm bên trên. Nếu không tìm thấy chính xác, hãy chọn cái gần nhất hoặc để trống variantId.
                        - Trả về JSON với cấu trúc:
                        {
                            "customerName": string,
                            "customerPhone": string,
                            "shippingAddress": string,
                            "items": [
                                { "productId": string, "variantId": string, "quantity": number }
                            ]
                        }
                    `,
                    model: useThinkingMode ? 'gemini-3-pro-preview' : 'gemini-2.5-flash',
                    responseFormat: 'json',
                    thinkingBudget: useThinkingMode ? 2048 : undefined
                })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'AI Parse failed');

            const result = JSON.parse(data.text || '{}') as ParsedOrderData;

            if (result.items && result.items.length > 0) {
                const fullItems: OrderItem[] = [];
                for (const parsedItem of result.items) {
                    const product = products.find(p => p.id === parsedItem.productId);
                    if (product) {
                        const variant = product.variants.find(v => v.id === parsedItem.variantId) || product.variants[0];
                        fullItems.push({
                            productId: product.id,
                            productName: product.name,
                            variantId: variant.id,
                            size: variant.size,
                            color: variant.color,
                            quantity: parsedItem.quantity,
                            price: product.price,
                            costPrice: product.costPrice
                        });
                    }
                }

                const newOrder: Partial<Order> = {
                    customerName: result.customerName,
                    customerPhone: result.customerPhone,
                    shippingAddress: result.shippingAddress,
                    items: fullItems,
                    paymentMethod: 'cod'
                };

                setEditingOrder(newOrder);
                setIsQuickOrderOpen(false);
                setIsOrderFormOpen(true);
                toast.success("Đã trích xuất thông tin thành công!");
            } else {
                setAiError("Không tìm thấy thông tin sản phẩm hợp lệ trong văn bản.");
            }

        } catch (error) {
            logger.error('Quick Order Parse Error:', error);
            setAiError(`Lỗi: ${error instanceof Error ? error.message : 'Không xác định'}`);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleAddUser = (user: User) => {
        setUsers(prev => [...prev, user]);
        logActivity(`<strong>${currentUser?.name}</strong> đã thêm nhân viên mới <strong>${user.name}</strong>.`, user.id, 'user');
        toast.success('Đã thêm nhân viên mới.');
    };

    const handleUpdateUser = (user: User) => {
        setUsers(prev => prev.map(u => u.id === user.id ? user : u));
        logActivity(`<strong>${currentUser?.name}</strong> đã cập nhật thông tin nhân viên <strong>${user.name}</strong>.`, user.id, 'user');
        toast.success('Đã cập nhật nhân viên.');
    };

    const handleDeleteUser = (userId: string) => {
        setUsers(prev => prev.filter(u => u.id !== userId));
        toast.success('Đã xóa nhân viên.');
    };

    const handleAddRole = (role: Role) => {
        setRoles(prev => [...prev, role]);
        toast.success('Đã tạo vai trò mới.');
    }

    const handleUpdateRole = (role: Role) => {
        setRoles(prev => prev.map(r => r.id === role.id ? role : r));
        toast.success('Đã cập nhật vai trò.');
    }

    const handleDeleteRole = (roleId: string) => {
        setRoles(prev => prev.filter(r => r.id !== roleId));
        toast.success('Đã xóa vai trò.');
    }

    // --- Navigation Logic ---

    if (!currentUser) {
        return <LoginPage onLogin={login} />;
    }

    // Check for invoice page view first
    if (invoiceOrder) {
        return <InvoicePage order={invoiceOrder} bankInfo={bankInfo} onBack={() => setInvoiceOrder(null)} />;
    }

    const navItems = [
        { id: 'dashboard', label: 'Tổng quan', icon: ChartPieIcon, perm: 'view_dashboard' },
        { id: 'inbox', label: 'Inbox Center', icon: ChatBubbleLeftEllipsisIcon, perm: 'manage_orders' },
        { id: 'orders', label: 'Đơn hàng', icon: ShoppingBagIcon, perm: 'manage_orders' },
        { id: 'workflow', label: 'Quy trình', icon: ViewColumnsIcon, perm: 'manage_orders' },
        { id: 'inventory', label: 'Kho hàng', icon: CubeIcon, perm: 'manage_inventory' },
        { id: 'customers', label: 'Khách hàng', icon: UserGroupIcon, perm: 'manage_customers' },
        { id: 'returns', label: 'Đổi/Trả hàng', icon: ArrowPathIcon, perm: 'manage_orders' },
        { id: 'vouchers', label: 'Mã giảm giá', icon: TicketIcon, perm: 'manage_marketing' },
        { id: 'social', label: 'Social', icon: ChatBubbleLeftEllipsisIcon, perm: 'manage_marketing' },
        { id: 'automation', label: 'Tự động hóa', icon: BoltIcon, perm: 'manage_settings' },
        { id: 'staff', label: 'Nhân sự', icon: ShieldCheckIcon, perm: 'manage_staff' },
        { id: 'activity', label: 'Hoạt động', icon: ClockIcon, perm: 'view_dashboard' },
        { id: 'reports', label: 'Báo cáo', icon: ChartBarIcon, perm: 'view_reports' },
        { id: 'settings', label: 'Cài đặt', icon: Cog6ToothIcon, perm: 'manage_settings' },
    ].filter(item => hasPermission(item.perm as any));

    const commands: Command[] = [
        ...navItems.map(item => ({ id: `nav-${item.id}`, name: `Đi đến ${item.label}`, action: () => { setView(item.id as Page); setIsCommandPaletteOpen(false); }, icon: item.icon, category: 'Điều hướng' })),
        { id: 'nav-profile', name: 'Trang cá nhân', action: () => { setView('profile'); setIsCommandPaletteOpen(false); }, icon: UserCircleIcon, category: 'Cá nhân' },
        { id: 'action-logout', name: 'Đăng xuất', action: () => { logout(); }, icon: XMarkIcon, category: 'Hệ thống' },
    ];

    const currentNavItem = navItems.find(item => item.id === view) || { label: 'Trang cá nhân' };

    const renderView = () => {
        if (appIsLoading || isInitialSyncing) {
            return (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground animate-pulse">Đang đồng bộ dữ liệu từ hệ thống...</p>
                </div>
            );
        }

        switch (view) {
            case 'dashboard': return <Dashboard orders={orders} products={products} customers={customers} activityLog={activityLog} onViewOrder={handleViewOrderDetails} onViewCustomer={handleViewCustomerDetails} onNavigate={(viewId) => setView(viewId as Page)} onOpenVoucherForm={handleOpenVoucherForm} onOpenStrategy={() => setIsStrategyModalOpen(true)} onOpenQuickPayment={() => setIsQuickPaymentOpen(true)} />;
            case 'inbox': return <InboxCommandCenter products={products} orders={orders} bankInfo={bankInfo} onOpenOrderForm={handleOpenOrderForm} onViewOrder={handleViewOrderDetails} onUpdateOrderStatus={handleUpdateStatus} />;
            case 'orders': return <OrderListPage orders={orders} onViewDetails={handleViewOrderDetails} onEdit={handleOpenOrderForm} onDelete={handleDeleteOrder} onUpdateStatus={handleUpdateStatus} onAddOrder={() => handleOpenOrderForm(null)} onAddQuickOrder={() => setIsQuickOrderOpen(true)} isAnyModalOpen={isAnyModalOpen} />;
            case 'workflow': return <KanbanBoardPage orders={orders} onUpdateStatus={handleUpdateStatus} onViewDetails={handleViewOrderDetails} />;
            case 'inventory': return <InventoryList products={products} onEdit={handleOpenProductForm} onDelete={handleDeleteProduct} onAddProduct={() => handleOpenProductForm(null)} onToggleVisibility={async (id, isActive) => { setProducts(prev => prev.map(p => p.id === id ? { ...p, is_active: isActive } : p)); const { productService } = await import('./services/supabaseService'); await productService.toggleVisibility(id, isActive); }} />;
            case 'customers': return <CustomerListPage customers={customers} onViewDetails={handleViewCustomerDetails} onEdit={handleOpenCustomerForm} onDelete={handleDeleteCustomer} onBulkDelete={handleBulkDeleteCustomers} onAddCustomer={() => handleOpenCustomerForm(null)} />;
            case 'returns': return <ReturnsPage returnRequests={returnRequests} onUpdateStatus={updateReturnStatus} onViewDetails={handleViewReturnDetails} />;
            case 'vouchers': return <VoucherListPage vouchers={vouchers} onEdit={handleOpenVoucherForm} onDelete={async (id) => await deleteVoucher(id)} onAdd={() => handleOpenVoucherForm(null)} />;
            case 'social': return <SocialPage products={products} configs={socialConfigs} setConfigs={setSocialConfigs} />;
            case 'automation': return <AutomationPage rules={automationRules} onAdd={() => handleOpenAutomationForm(null)} onEdit={handleOpenAutomationForm} onDelete={async (id) => await deleteRule(id)} onToggle={async (id, isEnabled) => await toggleRule(id, isEnabled)} />;
            case 'activity': return <ActivityPage logs={activityLog} />;
            case 'reports': return <ReportsPage orders={orders} />;
            case 'staff': return <StaffManagement users={users} roles={roles} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} onAddRole={handleAddRole} onUpdateRole={handleUpdateRole} onDeleteRole={handleDeleteRole} />;
            case 'profile': return <ProfilePage user={currentUser} activityLog={activityLog} onUpdateProfile={updateProfile} />;
            case 'settings': return <SettingsPage bankInfo={bankInfo} allData={{ orders, products, customers, vouchers, bankInfo, socialConfigs, activityLog, automationRules, returnRequests, users: users }} onImportData={() => { }} />;
            default: return <div className="text-center py-20">Tính năng đang phát triển hoặc bạn không có quyền truy cập.</div>;
        }
    };

    const renderSidebar = () => (
        <aside className={`fixed inset-y-0 left-0 w-64 sidebar-modern flex-shrink-0 flex flex-col z-40 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="h-16 flex items-center justify-between px-6 border-b border-border">
                <div className="flex items-center gap-2">
                    <div className="bg-primary p-1.5 rounded-lg">
                        <AppLogoIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold font-heading tracking-tight text-foreground">Mixer</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 text-muted-foreground hover:text-foreground transition-colors"><XMarkIcon className="w-6 h-6" /></button>
            </div>

            <div className="p-4 border-b border-border flex items-center gap-3 cursor-pointer hover:bg-white/50 transition-all group" onClick={() => setView('profile')}>
                <div className="w-9 h-9 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold text-sm border border-primary/10 group-hover:scale-105 transition-transform">
                    {currentUser.avatar}
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-semibold truncate text-foreground">{currentUser.name}</p>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{roles.find(r => r.id === currentUser.roleId)?.name}</p>
                </div>
            </div>

            <nav className="flex-grow p-3 space-y-0.5 overflow-y-auto mt-2">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => { setView(item.id as Page); setIsSidebarOpen(false); }}
                        className={`sidebar-item ${view === item.id ? 'active' : ''}`}
                    >
                        <item.icon className={`w-5 h-5 transition-colors ${view === item.id ? 'text-white' : 'text-muted-foreground/80'}`} />
                        {item.label}
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-border space-y-3">
                <button
                    onClick={() => setIsCommandPaletteOpen(true)}
                    className="w-full text-left text-[13px] text-muted-foreground p-2.5 rounded-lg bg-white border border-border hover:border-primary/30 hover:shadow-sm transition-all flex justify-between items-center group"
                >
                    <span className="font-medium group-hover:text-foreground">Bảng lệnh</span>
                    <div className="flex gap-0.5">
                        <kbd className="font-sans text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">⌘</kbd>
                        <kbd className="font-sans text-[10px] bg-muted px-1.5 py-0.5 rounded border border-border text-muted-foreground">K</kbd>
                    </div>
                </button>

                <button
                    onClick={logout}
                    className="w-full text-left text-[13px] text-accent-pink font-semibold hover:bg-accent-pink/5 p-2.5 rounded-lg flex items-center gap-2.5 transition-all group"
                >
                    <div className="p-1 rounded bg-accent-pink/10 group-hover:bg-accent-pink/20">
                        <XMarkIcon className="w-3.5 h-3.5" />
                    </div>
                    Đăng xuất
                </button>
            </div>
        </aside>
    );

    const renderTopNav = () => (
        <header className="bg-white border-b border-border flex flex-col sticky top-0 z-40 shadow-soft">
            <div className="h-16 flex items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-muted-foreground hover:text-foreground"><Bars3Icon className="w-6 h-6" /></button>
                    <div className="flex items-center cursor-pointer gap-2" onClick={() => setView('dashboard')}>
                        <div className="bg-primary p-1.5 rounded-lg">
                            <AppLogoIcon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold font-heading hidden sm:inline-block">Mixer</span>
                    </div>
                </div>
                <nav className="hidden md:flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 px-4 justify-center">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id as Page)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150 whitespace-nowrap ${view === item.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                        >
                            <item.icon className={`w-4 h-4 ${view === item.id ? 'text-primary' : ''}`} />
                            <span className="hidden lg:inline">{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="flex items-center gap-4">
                    <button onClick={() => setView('profile')} className="w-9 h-9 rounded-full bg-primary-light text-primary flex items-center justify-center text-xs font-bold border border-primary/10 hover:shadow-soft transition-all">
                        {currentUser.avatar}
                    </button>
                </div>
            </div>
        </header>
    );

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* Mobile Drawer Overlay */}
            {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden="true"></div>}

            {/* Render Sidebar if mode is 'default' */}
            {uiMode === 'default' && renderSidebar()}

            {/* Mobile Drawer */}
            <aside className={`fixed inset-y-0 left-0 w-64 sidebar-modern flex-shrink-0 border-r border-border flex flex-col z-40 transform transition-transform duration-300 ease-in-out md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-16 flex items-center justify-between px-6 border-b border-border">
                    <div className="flex items-center gap-2">
                        <div className="bg-primary p-1.5 rounded-lg">
                            <AppLogoIcon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold font-heading text-foreground">Mixer</span>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-muted-foreground hover:text-foreground transition-colors"><XMarkIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-4 border-b border-border flex items-center gap-3 cursor-pointer hover:bg-white/50 transition-all group" onClick={() => { setView('profile'); setIsSidebarOpen(false) }}>
                    <div className="w-10 h-10 rounded-full bg-primary-light text-primary flex items-center justify-center font-bold border border-primary/10 transition-transform group-hover:scale-105">
                        {currentUser.avatar}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">{currentUser.name}</p>
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{roles.find(r => r.id === currentUser.roleId)?.name}</p>
                    </div>
                </div>
                <nav className="flex-grow p-3 space-y-0.5 overflow-y-auto mt-2">
                    {navItems.map(item => (
                        <button key={item.id} onClick={() => { setView(item.id as Page); setIsSidebarOpen(false); }} className={`sidebar-item ${view === item.id ? 'active' : ''}`}>
                            <item.icon className={`w-5 h-5 transition-colors ${view === item.id ? 'text-white' : 'text-muted-foreground/80'}`} />
                            {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-border">
                    <button onClick={logout} className="w-full text-left text-[13px] text-accent-pink font-semibold hover:bg-accent-pink/5 p-2.5 rounded-lg flex items-center gap-2.5 transition-all group">
                        <div className="p-1 rounded bg-accent-pink/10 group-hover:bg-accent-pink/20">
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </div>
                        Đăng xuất
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
                {(uiMode === 'default' || uiMode === 'zen') && (
                    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 shrink-0 shadow-soft">
                        <div className="flex items-center">
                            {uiMode === 'default' && <button onClick={() => setIsSidebarOpen(true)} className="md:hidden mr-4 text-muted-foreground hover:text-foreground transition-colors"><Bars3Icon className="w-6 h-6" /></button>}
                            {uiMode === 'zen' && <button onClick={() => setIsZenMenuOpen(true)} className="mr-4 text-muted-foreground hover:text-foreground transition-colors"><Squares2X2Icon className="w-6 h-6" /></button>}
                            <h1 className="text-lg font-bold font-heading text-foreground tracking-tight">{currentNavItem?.label}</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setUiMode(uiMode === 'default' ? 'zen' : 'default')}
                                className="p-2.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                            >
                                {uiMode === 'default' ? <ArrowsPointingInIcon className="w-5 h-5" /> : <ArrowsPointingOutIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </header>
                )}

                {uiMode === 'top-nav' && renderTopNav()}

                <div className="flex-1 p-4 md:p-6 overflow-y-auto scroll-smooth">{renderView()}</div>
            </main>

            <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} commands={commands} />

            <Modal isOpen={isOrderFormOpen} onClose={() => setIsOrderFormOpen(false)} title={editingOrder?.id ? "Sửa đơn hàng" : "Tạo đơn hàng mới"}><OrderForm order={editingOrder} customers={customers} products={products} vouchers={vouchers} onSave={handleSaveOrder} onClose={() => setIsOrderFormOpen(false)} /></Modal>
            <Modal isOpen={isProductFormOpen} onClose={() => setIsProductFormOpen(false)} title={editingProduct ? "Sửa sản phẩm" : "Thêm sản phẩm mới"}><ProductForm product={editingProduct} onSave={async (p) => { if (editingProduct) { await updateProduct(p.id, p); } else { await addProduct(p); } setIsProductFormOpen(false); }} onClose={() => setIsProductFormOpen(false)} /></Modal>
            <Modal isOpen={isCustomerFormOpen} onClose={() => setIsCustomerFormOpen(false)} title={editingCustomer ? "Sửa khách hàng" : "Thêm khách hàng mới"}><CustomerForm customer={editingCustomer} onSave={async (c) => { if (editingCustomer) { await updateCustomer(c.id, c); } else { await addCustomer(c); } setIsCustomerFormOpen(false); }} onClose={() => setIsCustomerFormOpen(false)} /></Modal>
            <Modal isOpen={isVoucherFormOpen} onClose={() => setIsVoucherFormOpen(false)} title={editingVoucher ? "Sửa mã giảm giá" : "Tạo mã giảm giá"}><VoucherForm voucher={editingVoucher} onSave={async (v) => { if (editingVoucher) { await updateVoucher(v.id, v); } else { await addVoucher(v); } setIsVoucherFormOpen(false); }} onClose={() => setIsVoucherFormOpen(false)} /></Modal>
            <Modal isOpen={isAutomationFormOpen} onClose={() => setIsAutomationFormOpen(false)} title={editingRule ? "Sửa quy tắc" : "Tạo quy tắc mới"}><AutomationForm rule={editingRule} onSave={async (r) => { if (editingRule) { await updateRule(r.id, r); } else { await addRule(r); } setIsAutomationFormOpen(false); }} onClose={() => setIsAutomationFormOpen(false)} /></Modal>

            {/* Detail Modals */}
            <OrderDetailModal
                order={viewingOrder}
                bankInfo={bankInfo}
                activityLog={activityLog}
                users={users}
                currentUser={currentUser}
                isOpen={!!viewingOrder}
                onClose={() => setViewingOrder(null)}
                onEdit={(order) => { setViewingOrder(null); setEditingOrder(order); setIsOrderFormOpen(true); }}
                onUpdateStatus={handleUpdateStatus}
                onUpdateShipping={handleUpdateShipping}
                onOpenMessageTemplates={(order) => setMessageTemplateOrder(order)}
                onAddDiscussion={(id, text) => {
                    const entry: DiscussionEntry = { id: crypto.randomUUID(), authorId: currentUser.id, authorName: currentUser.name, authorAvatar: currentUser.avatar, timestamp: new Date().toISOString(), text };
                    setOrders(prev => prev.map(o => o.id === id ? { ...o, discussion: [...(o.discussion || []), entry] } : o));
                    if (viewingOrder && viewingOrder.id === id) setViewingOrder({ ...viewingOrder, discussion: [...(viewingOrder.discussion || []), entry] });
                }}
                onConfirmPayment={handleConfirmPayment}
                onOpenReturnRequest={(order) => { setViewingOrder(null); setReturnRequestOrder(order); }}
                onPrintInvoice={(order) => {
                    setViewingOrder(null);
                    setInvoiceOrder(order);
                }}
                onGeneratePaymentLink={(order) => {
                    setPayingOrder(order);
                    setIsVnPayModalOpen(true);
                }}
            />

            <CustomerDetailModal customer={viewingCustomer} orders={orders.filter(o => o.customerId === viewingCustomer?.id)} activityLog={activityLog} isOpen={!!viewingCustomer} onClose={() => setViewingCustomer(null)} />

            {/* Utility Modals */}
            {isQuickOrderOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsQuickOrderOpen(false)}>
                    <div className="bg-white p-6 rounded-lg w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <QuickOrderModal
                            onClose={() => setIsQuickOrderOpen(false)}
                            onParse={handleQuickOrderParse}
                            isLoading={isAiLoading}
                            error={aiError}
                        />
                    </div>
                </div>
            )}

            <MessageTemplatesModal
                order={messageTemplateOrder}
                bankInfo={bankInfo}
                isOpen={!!messageTemplateOrder}
                onClose={() => setMessageTemplateOrder(null)}
                onSendToFacebook={sendMessageToFacebook}
            />

            <ReturnRequestModal
                order={returnRequestOrder}
                products={products}
                isOpen={!!returnRequestOrder}
                onClose={() => setReturnRequestOrder(null)}
                onCreateRequest={(req) => {
                    setReturnRequests(prev => [...prev, req]);
                    setReturnRequestOrder(null);
                    toast.success('Đã tạo yêu cầu đổi/trả thành công!');
                }}
            />

            <ReturnRequestDetailModal
                isOpen={!!viewingReturnRequest}
                onClose={() => setViewingReturnRequest(null)}
                request={viewingReturnRequest}
                products={products}
                onUpdateRequest={(updatedReq) => {
                    setReturnRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
                    setViewingReturnRequest(updatedReq);
                }}
                onUpdateStatus={(id, status) => {
                    setReturnRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
                    if (viewingReturnRequest) setViewingReturnRequest({ ...viewingReturnRequest, status });
                    toast.success('Đã cập nhật trạng thái!');
                }}
                onProcessExchange={(id) => {
                    const req = returnRequests.find(r => r.id === id);
                    if (req) {
                        setReturnRequests(prev => prev.map(r => r.id === id ? { ...r, exchangeTrackingCode: `EX-${Math.floor(Math.random() * 1000000)}`, status: ReturnRequestStatus.Processing } : r));
                        toast.success('Đã tạo đơn hàng đổi thành công!');
                        setViewingReturnRequest(null);
                    }
                }}
            />

            <VnPayPaymentModal
                isOpen={isVnPayModalOpen}
                onClose={() => setIsVnPayModalOpen(false)}
                order={payingOrder}
                bankInfo={bankInfo}
                onSimulateSuccess={() => {
                    if (payingOrder) {
                        setOrders(prev => prev.map(o => o.id === payingOrder.id ? { ...o, paymentStatus: 'Paid', status: OrderStatus.Processing } : o));
                        toast.success('Thanh toán thành công!');
                        setIsVnPayModalOpen(false);
                    }
                }}
            />

            <StrategyModal
                isOpen={isStrategyModalOpen}
                onClose={() => setIsStrategyModalOpen(false)}
                orders={orders}
                products={products}
                customers={customers}
            />

            <QuickPaymentConfirmModal
                isOpen={isQuickPaymentOpen}
                onClose={() => setIsQuickPaymentOpen(false)}
                orders={orders}
                onConfirmPayment={handleConfirmPayment}
            />

        </div>
    );
};

const App: React.FC = () => {
    return (<ToastProvider><AppContent /></ToastProvider>)
}

export default App;