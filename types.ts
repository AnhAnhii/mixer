
export enum OrderStatus {
  Pending = 'Chờ xử lý',
  Processing = 'Đang xử lý',
  Shipped = 'Đã gửi hàng',
  Delivered = 'Đã giao hàng',
  Cancelled = 'Đã hủy',
}

export interface ProductVariant {
  id: string;
  size: string;
  color: string;
  stock: number;
  lowStockThreshold: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice: number;
  image_url?: string;
  image_url_2?: string;
  image_url_3?: string;
  image_url_4?: string;
  image_url_5?: string;
  description?: string;
  variants: ProductVariant[];
}

export type Permission =
  | 'view_dashboard'
  | 'manage_orders'
  | 'manage_inventory'
  | 'manage_customers'
  | 'manage_marketing'
  | 'manage_staff'
  | 'view_reports'
  | 'manage_settings';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem?: boolean; // System roles cannot be deleted
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // In real app, this is hashed. Here plain for demo.
  avatar: string; // Initial or URL
  roleId: string;
  bio?: string;
  coverImage?: string;
  phone?: string;
  joinDate: string;
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
  status: 'active' | 'inactive';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: string;
  tags?: string[];
}

export interface OrderItem {
  productId: string;
  productName: string;
  variantId: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  costPrice: number;
}

export interface Voucher {
  id: string;
  code: string;
  discountType: 'fixed' | 'percentage';
  discountValue: number;
  minOrderValue?: number;
  isActive: boolean;
  usageCount: number;
}

export interface DiscussionEntry {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  timestamp: string;
  text: string;
}

export type PaymentStatus = 'Paid' | 'Unpaid';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  orderDate: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: 'cod' | 'bank_transfer';
  paymentStatus: PaymentStatus;
  notes?: string;
  discount?: {
    code: string;
    amount: number;
  };
  shippingProvider?: string;
  trackingCode?: string;
  discussion?: DiscussionEntry[];
  paymentLink?: string;
  paymentTransactionId?: string;
  // Facebook integration
  facebookUserId?: string;      // ID của người đặt trên Facebook
  facebookUserName?: string;    // Tên người đặt trên Facebook (có thể khác người nhận)
}

export interface BankInfo {
  bin: string;
  accountNumber: string;
  accountName: string;
}

export interface ParsedOrderItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export type ParsedOrderData = {
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  items: ParsedOrderItem[];
  error?: never; // Ensure error is not present in success case
} | {
  error: string;
  customerName?: never; // Ensure other fields are not present in error case
  customerPhone?: never;
  shippingAddress?: never;
  items?: never;
};

export interface FacebookPost {
  id: string;
  content: string;
  imageUrl: string;
  commentsCount: number;
  likesCount: number;
  createdAt: string;
}

export interface FacebookComment {
  id: string;
  author: string;
  text: string;
}

export interface CommentReply {
  id: string;
  text: string;
}

export interface SocialPostConfig {
  postId: string;
  isEnabled: boolean;
  commentReplies: CommentReply[];
  inboxMessage: string;
  attachedProductVariantId?: string;
}

export type UiMode = 'default' | 'zen' | 'top-nav';

// New Theme Engine Types
export type ThemePalette = 'modern' | 'elegant' | 'classic' | 'glass';
export type ThemeDensity = 'comfortable' | 'compact';
export type ThemeStyle = 'rounded' | 'sharp';

export interface ThemeSettings {
  palette: ThemePalette;
  density: ThemeDensity;
  style: ThemeStyle;
}

export interface GoogleSheetsConfig {
  scriptUrl: string;
  lastSynced?: string;
  autoSync?: boolean;
}

// --- Activity Log Types ---
export interface ActivityLog {
  id: string;
  timestamp: string;
  description: string;
  entityId?: string;
  entityType?: 'order' | 'customer' | 'system' | 'automation' | 'return' | 'user';
}

// --- Automation Rules Types ---
export type RuleTriggerType = 'ORDER_CREATED';

export interface RuleCondition {
  field: 'totalAmount';
  operator: 'GREATER_THAN' | 'EQUALS';
  value: number;
}

export type RuleActionType = 'ADD_CUSTOMER_TAG';

export interface RuleAction {
  type: RuleActionType;
  value: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: RuleTriggerType;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isEnabled: boolean;
}

// --- Return/Exchange Types ---
export enum ReturnRequestStatus {
  Pending = 'Chờ nhận lại hàng',
  Processing = 'Đang xử lý đổi hàng',
  Received = 'Đã nhận hàng',
  Completed = 'Đã hoàn thành',
  Cancelled = 'Đã hủy',
}

export type ReturnReason = 'SIZE_KHONG_VUA' | 'SAN_PHAM_LOI' | 'KHONG_GIONG_MO_TA' | 'KHONG_THICH' | 'LY_DO_KHAC';

export interface ReturnRequestItem {
  originalOrderItem: OrderItem;
  quantity: number;
  action: 'return' | 'exchange';
  reason: ReturnReason;
  newVariantId?: string; // for exchange
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  createdAt: string;
  status: ReturnRequestStatus;
  items: ReturnRequestItem[];
  returnTrackingCode?: string;
  exchangeTrackingCode?: string;
  exchangeShippingFee?: number;
}


export type Page = 'dashboard' | 'orders' | 'workflow' | 'inventory' | 'customers' | 'vouchers' | 'social' | 'automation' | 'activity' | 'reports' | 'settings' | 'returns' | 'staff' | 'profile' | 'inbox';
