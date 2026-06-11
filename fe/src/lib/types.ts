export interface ApiResponse<T> {
  code: number;
  message: string;
  result: T;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AuthResponse {
  id: number;
  email: string;
  username: string | null;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  role: "user" | "admin";
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  birthDate: string | null;
  createdAt: string | null;
  tokenType: string;
  accessToken: string;
}

export interface User {
  id: number;
  email: string;
  username: string | null;
  fullName: string;
  phone: string | null;
  emailVerified?: boolean;
  role: "user" | "admin";
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  birthDate: string | null;
  status: "active" | "inactive";
  createdAt: string;
  locked: boolean;
  lockReason?: string | null;
  lockedAt?: string | null;
  enabled?: boolean;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  discountPercent: number;
  stockQuantity: number | null;
  coverImageUrl: string | null;
  sizeGuideNote: string | null;
  status: "active" | "inactive" | "out_of_stock";
  deleted?: boolean;
  ratingAverage: number;
  reviewCount: number;
  soldCount?: number | null;
  createdAt: string;
  shop: { id: number; name: string } | null;
  categories: { id: number; name: string; slug: string }[];
  colors?: string[];
  variants: ProductVariant[];
  media: ProductImage[];
  images?: ProductImage[];
}

export interface ProductVariant {
  id: number;
  size: string;
  price: number;
  sku: string | null;
  colors: ProductVariantColor[];
}

export interface ProductVariantColor {
  id: number;
  color: string;
  stockQuantity: number;
  imageUrl: string | null;
}

export interface ProductImage {
  id: number;
  imageUrl: string;
  type: string;
  sortOrder: number;
}

export interface CartItem {
  id: number;
  productId: number;
  productName: string;
  productImage: string | null;
  variantId: number | null;
  variantName: string | null;
  colorId: number | null;
  colorName: string | null;
  price: number;
  quantity: number;
}

export interface Order {
  id: number;
  orderCode: string;
  recipientName: string;
  recipientPhone: string;
  shippingAddress: string;
  shippingCity: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  note: string | null;
  cancelReason: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  transactions: Transaction[];
}

export interface OrderItem {
  id: number;
  productId: number | null;
  variantId: number | null;
  colorId: number | null;
  productName: string;
  variantName: string | null;
  colorName: string | null;
  sku: string | null;
  productImage: string | null;
  productPrice: number;
  discountPercent: number;
  finalPrice: number;
  quantity: number;
  subtotal: number;
}

export interface Transaction {
  id: number;
  transactionCode: string;
  amount: number;
  paymentMethod: string;
  status: string;
  description: string | null;
  createdAt: string;
}

export interface Address {
  id: number;
  recipientName: string;
  recipientPhone: string;
  address: string;
  provinceCode: number | null;
  districtCode: number | null;
  ward: string | null;
  district: string | null;
  city: string;
  isDefault: boolean;
  createdAt: string;
}

export interface Review {
  id: number;
  userId: number;
  userName: string;
  orderItemId: number | null;
  productId: number;
  rating: number;
  comment: string | null;
  imageUrls: string[];
  shopReply: string | null;
  shopReplyAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  imageUrl: string | null;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface RealtimeEvent {
  channel: "notification" | "chat" | "dashboard" | "system";
  type: string;
  scope?: string;
  orderCode?: string;
  messageId?: number;
  senderRole?: string;
  senderName?: string;
  content?: string;
  createdAt?: string;
  isRead?: boolean;
  unreadCount?: number;
  notification?: Notification;
}

export interface Banner {
  id: number;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  position: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: number | null;
  parentName?: string | null;
  sortOrder: number;
  status: string;
  deleted?: boolean;
}

export interface Dashboard {
  revenueToday: number;
  revenueThisMonth: number;
  ordersToday: number;
  newUsersToday: number;
  pendingOrders: number;
  totalProducts: number;
  avgRating: number;
  totalReviews: number;
  revenueChart: { date: string; revenue: number; orders: number }[];
  recentOrders: {
    id: number;
    orderCode: string;
    recipientName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }[];
}
