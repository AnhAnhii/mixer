
import type { Product, ProductVariant, Customer, Order, FacebookPost, AutomationRule, ActivityLog, User, ReturnRequest, Role, MessageTemplate } from '../types';
import { OrderStatus, ReturnRequestStatus } from '../types';

export const sampleQuickTemplates: MessageTemplate[] = [
    { id: 'greeting', label: '👋 Chào', text: 'Dạ chào bạn! Cảm ơn bạn đã quan tâm đến sản phẩm của shop ạ. Bạn cần tư vấn size/màu gì để em kiểm tra tồn kho nhé? 😊' },
    { id: 'confirm', label: '✅ Xác nhận', text: 'Dạ em xác nhận đơn hàng của bạn rồi ạ. Bạn vui lòng gửi em địa chỉ và SĐT để em ship hàng nhé! 📦' },
    { id: 'payment', label: '💳 CK', text: 'Dạ bạn chuyển khoản theo thông tin:\n🏦 MB Bank\n💳 STK: [số tài khoản]\n👤 Chủ TK: [tên]\n\nSau khi CK xong bạn gửi em bill để xác nhận ạ! 🙏' },
    { id: 'shipped', label: '🚚 Đã ship', text: 'Dạ đơn hàng của bạn đã được gửi đi rồi ạ! 📦\nMã vận đơn: [mã]\nDự kiến 2-3 ngày sẽ nhận được hàng nhé! ✨' },
    { id: 'thanks', label: '🙏 Cảm ơn', text: 'Cảm ơn bạn đã mua hàng tại shop ạ! 💕 Nếu hài lòng với sản phẩm, bạn để lại đánh giá 5⭐ giúp shop nhé. Hẹn gặp lại bạn! 🥰' },
];

export const sampleRoles: Role[] = [
    {
        id: 'role-admin',
        name: 'Quản trị viên (Admin)',
        description: 'Toàn quyền truy cập hệ thống',
        isSystem: true,
        permissions: ['view_dashboard', 'manage_orders', 'manage_inventory', 'manage_customers', 'manage_marketing', 'manage_staff', 'view_reports', 'manage_settings']
    },
    {
        id: 'role-manager',
        name: 'Quản lý (Manager)',
        description: 'Quản lý vận hành, không can thiệp nhân sự cấp cao',
        isSystem: true,
        permissions: ['view_dashboard', 'manage_orders', 'manage_inventory', 'manage_customers', 'manage_marketing', 'view_reports']
    },
    {
        id: 'role-staff',
        name: 'Nhân viên (Staff)',
        description: 'Xử lý đơn hàng và kho',
        isSystem: true,
        permissions: ['view_dashboard', 'manage_orders', 'manage_inventory', 'manage_customers']
    }
];

export const sampleUsers: User[] = [
    {
        id: 'user-1',
        name: 'Nguyễn Quynh Trang',
        email: 'admin@mixer.com',
        password: 'admin', // In real app, this is hashed
        avatar: 'QT',
        roleId: 'role-admin',
        joinDate: '2023-01-15T08:00:00Z',
        bio: 'Founder & CEO tại Mixer Fashion. Đam mê thời trang và công nghệ.',
        coverImage: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        status: 'active',
        socialLinks: { facebook: 'fb.com/trangnq', instagram: 'inst.com/trangnq' }
    },
    {
        id: 'user-2',
        name: 'Trần Văn Bảo',
        email: 'bao@mixer.com',
        password: '123',
        avatar: 'TB',
        roleId: 'role-manager',
        joinDate: '2023-03-10T09:30:00Z',
        bio: 'Quản lý vận hành kho và đơn hàng.',
        status: 'active'
    },
    {
        id: 'user-3',
        name: 'Lê Thị Hoa',
        email: 'hoa@mixer.com',
        password: '123',
        avatar: 'LH',
        roleId: 'role-staff',
        joinDate: '2023-06-20T08:45:00Z',
        bio: 'Nhân viên chăm sóc khách hàng.',
        status: 'active'
    }
];

const sampleProductsData: Array<Omit<Product, 'id' | 'variants'> & { variants: Omit<ProductVariant, 'id'>[] }> = [
    {
        name: 'Áo Thun Cotton Basic', price: 250000, costPrice: 120000, variants: [
            { size: 'S', color: 'Trắng', stock: 50, lowStockThreshold: 10 },
            { size: 'M', color: 'Trắng', stock: 45, lowStockThreshold: 10 },
            { size: 'L', color: 'Trắng', stock: 3, lowStockThreshold: 5 },
            { size: 'S', color: 'Đen', stock: 48, lowStockThreshold: 10 },
            { size: 'M', color: 'Đen', stock: 52, lowStockThreshold: 10 },
            { size: 'L', color: 'Đen', stock: 25, lowStockThreshold: 5 },
        ]
    },
    {
        name: 'Quần Jeans Slim-fit', price: 550000, costPrice: 300000, variants: [
            { size: '29', color: 'Xanh nhạt', stock: 20, lowStockThreshold: 5 },
            { size: '30', color: 'Xanh nhạt', stock: 25, lowStockThreshold: 5 },
            { size: '31', color: 'Xanh nhạt', stock: 15, lowStockThreshold: 5 },
            { size: '30', color: 'Đen', stock: 22, lowStockThreshold: 5 },
            { size: '32', color: 'Đen', stock: 0, lowStockThreshold: 5 },
        ]
    },
    {
        name: 'Áo Sơ Mi Oxford', price: 450000, costPrice: 250000, variants: [
            { size: 'M', color: 'Trắng', stock: 30, lowStockThreshold: 8 },
            { size: 'L', color: 'Trắng', stock: 20, lowStockThreshold: 8 },
            { size: 'M', color: 'Xanh da trời', stock: 35, lowStockThreshold: 8 },
            { size: 'L', color: 'Xanh da trời', stock: 22, lowStockThreshold: 8 },
        ]
    },
    {
        name: 'Áo Hoodie Nỉ Bông', price: 650000, costPrice: 350000, variants: [
            { size: 'S', color: 'Xám', stock: 15, lowStockThreshold: 5 },
            { size: 'M', color: 'Xám', stock: 12, lowStockThreshold: 5 },
            { size: 'L', color: 'Xám', stock: 8, lowStockThreshold: 5 },
        ]
    },
    {
        name: 'Quần Short Kaki', price: 320000, costPrice: 150000, variants: [
            { size: '28', color: 'Be', stock: 40, lowStockThreshold: 10 },
            { size: '30', color: 'Be', stock: 30, lowStockThreshold: 10 },
            { size: '32', color: 'Be', stock: 25, lowStockThreshold: 10 },
        ]
    },
    {
        name: 'Jacket Da Lộn', price: 890000, costPrice: 500000, variants: [
            { size: 'M', color: 'Nâu', stock: 10, lowStockThreshold: 3 },
            { size: 'L', color: 'Nâu', stock: 7, lowStockThreshold: 3 },
        ]
    }
];


export const sampleProducts: Product[] = sampleProductsData.map(p => ({
    id: crypto.randomUUID(),
    ...p,
    variants: p.variants.map(v => ({ id: crypto.randomUUID(), ...v }))
}));

const sampleCustomersData: Omit<Customer, 'id' | 'createdAt'>[] = [
    { name: 'Nguyễn Văn An', phone: '0901234567', email: 'an.nv@example.com', address: '123 Đường ABC, Quận 1, TP.HCM', tags: ['Khách hàng mới'] },
    { name: 'Trần Thị Bình', phone: '0987654321', email: 'binh.tt@example.com', address: '456 Đường XYZ, Quận Ba Đình, Hà Nội', tags: ['VIP'] },
    { name: 'Lê Minh Cường', phone: '0398765432', address: '789 Đường DEF, Quận Hải Châu, Đà Nẵng', tags: ['Khách hàng thân thiết'] },
    { name: 'Phạm Thị Dung', phone: '0912345678', address: '101 Đường GHI, Quận 3, TP.HCM' },
    { name: 'Hoàng Văn Em', phone: '0367890123', address: '202 Đường KLM, Quận Cầu Giấy, Hà Nội', tags: ['Khách hàng mới'] },
];

export const sampleCustomers: Customer[] = sampleCustomersData.map(c => ({
    id: crypto.randomUUID(),
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    ...c
}));

const order1_id = crypto.randomUUID().substring(0, 8);

export const sampleOrders: Order[] = [
    {
        id: order1_id,
        customerId: sampleCustomers[0].id,
        customerName: sampleCustomers[0].name,
        customerPhone: sampleCustomers[0].phone,
        shippingAddress: sampleCustomers[0].address || '',
        orderDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
            { productId: sampleProducts[0].id, productName: sampleProducts[0].name, variantId: sampleProducts[0].variants[1].id, size: 'M', color: 'Trắng', quantity: 2, price: 250000, costPrice: 120000 }
        ],
        totalAmount: 500000,
        status: OrderStatus.Delivered,
        paymentMethod: 'cod',
        paymentStatus: 'Paid',
        notes: 'Giao giờ hành chính',
        discussion: [
            { id: 'disc-1', authorId: 'user-2', authorName: 'Trần Văn Bảo', authorAvatar: 'TB', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 3600000).toISOString(), text: '@Trang Le Em check lại địa chỉ này giúp anh nhé.' }
        ]
    },
    {
        id: crypto.randomUUID().substring(0, 8),
        customerId: sampleCustomers[1].id,
        customerName: sampleCustomers[1].name,
        customerPhone: sampleCustomers[1].phone,
        shippingAddress: sampleCustomers[1].address || '',
        orderDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
            { productId: sampleProducts[1].id, productName: sampleProducts[1].name, variantId: sampleProducts[1].variants[0].id, size: '29', color: 'Xanh nhạt', quantity: 1, price: 550000, costPrice: 300000 },
            { productId: sampleProducts[2].id, productName: sampleProducts[2].name, variantId: sampleProducts[2].variants[2].id, size: 'M', color: 'Xanh da trời', quantity: 1, price: 450000, costPrice: 250000 }
        ],
        totalAmount: 1030000,
        status: OrderStatus.Shipped,
        paymentMethod: 'bank_transfer',
        paymentStatus: 'Unpaid',
        shippingProvider: 'GHTK',
        trackingCode: 'GHTK123456789',
        discussion: []
    },
    {
        id: crypto.randomUUID().substring(0, 8),
        customerId: sampleCustomers[2].id,
        customerName: sampleCustomers[2].name,
        customerPhone: sampleCustomers[2].phone,
        shippingAddress: sampleCustomers[2].address || '',
        orderDate: new Date().toISOString(),
        items: [
            { productId: sampleProducts[0].id, productName: sampleProducts[0].name, variantId: sampleProducts[0].variants[4].id, size: 'M', color: 'Đen', quantity: 1, price: 250000, costPrice: 120000 }
        ],
        totalAmount: 250000,
        status: OrderStatus.Pending,
        paymentMethod: 'cod',
        paymentStatus: 'Unpaid',
        discussion: []
    },
    {
        id: crypto.randomUUID().substring(0, 8),
        customerId: sampleCustomers[3].id,
        customerName: sampleCustomers[3].name,
        customerPhone: sampleCustomers[3].phone,
        shippingAddress: sampleCustomers[3].address || '',
        orderDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
            { productId: sampleProducts[3].id, productName: sampleProducts[3].name, variantId: sampleProducts[3].variants[1].id, size: 'M', color: 'Xám', quantity: 1, price: 650000, costPrice: 350000 }
        ],
        totalAmount: 650000,
        status: OrderStatus.Processing,
        paymentMethod: 'bank_transfer',
        paymentStatus: 'Paid',
        discussion: []
    },
    {
        id: crypto.randomUUID().substring(0, 8),
        customerId: sampleCustomers[4].id,
        customerName: sampleCustomers[4].name,
        customerPhone: sampleCustomers[4].phone,
        shippingAddress: sampleCustomers[4].address || '',
        orderDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        items: [
            { productId: sampleProducts[1].id, productName: sampleProducts[1].name, variantId: sampleProducts[1].variants[3].id, size: '30', color: 'Đen', quantity: 1, price: 550000, costPrice: 300000 }
        ],
        totalAmount: 550000,
        status: OrderStatus.Cancelled,
        paymentMethod: 'cod',
        paymentStatus: 'Unpaid',
        discussion: []
    }
];

export const sampleFacebookPosts: FacebookPost[] = [
    {
        id: 'fb_post_1',
        content: '🔥 NEW ARRIVAL 🔥 Áo Thun Cotton Basic đã về đủ màu đủ size cho anh em lựa chọn! Chất liệu thoáng mát, form dáng chuẩn. Nhanh tay inbox cho Mixer để được tư vấn nhé!',
        imageUrl: 'https://placehold.co/600x400/4f46e5/white?text=Mixer+Fashion',
        commentsCount: 152,
        likesCount: 893,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
        id: 'fb_post_2',
        content: '👖 QUẦN JEANS SLIM-FIT - MUST-HAVE ITEM 👖 Lên dáng cực đỉnh, hack chân dài miên man. Item không thể thiếu trong tủ đồ của các chàng trai. Có sẵn tại tất cả các cửa hàng của Mixer.',
        imageUrl: 'https://placehold.co/600x400/10b981/white?text=Mixer+Style',
        commentsCount: 88,
        likesCount: 512,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
];

export const sampleAutomationRules: AutomationRule[] = [
    {
        id: 'rule_vip_customer',
        name: 'Tự động gắn tag VIP cho khách có đơn hàng lớn',
        trigger: 'ORDER_CREATED',
        conditions: [
            { field: 'totalAmount', operator: 'GREATER_THAN', value: 1000000 }
        ],
        actions: [
            { type: 'ADD_CUSTOMER_TAG', value: 'VIP' }
        ],
        isEnabled: true
    }
];

export const sampleActivityLogs: ActivityLog[] = [
    {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        description: `Hệ thống đã khởi tạo.`,
        entityType: 'system'
    }
];

export const sampleReturnRequests: ReturnRequest[] = [
    {
        id: 'RR-12345',
        orderId: order1_id,
        customerId: sampleCustomers[0].id,
        customerName: sampleCustomers[0].name,
        createdAt: new Date().toISOString(),
        status: ReturnRequestStatus.Pending,
        items: [
            {
                originalOrderItem: sampleOrders.find(o => o.id === order1_id)!.items[0],
                quantity: 1,
                action: 'exchange',
                reason: 'SIZE_KHONG_VUA',
                newVariantId: sampleProducts[0].variants[2].id // Exchange M to L
            }
        ],
        returnTrackingCode: '',
        exchangeShippingFee: 0,
    }
];
