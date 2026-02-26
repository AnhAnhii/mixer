
import React, { useState } from 'react';
import type { Product, ProductVariant } from '../types';
import { PencilIcon, ChevronDownIcon, PlusIcon, CubeIcon, SparklesIcon, TrashIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon } from './icons';
import InventoryForecastModal from './InventoryForecastModal';
import Modal from './Modal';
import { formatCurrency } from '../utils/formatters';

interface InventoryListProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  onAddProduct: () => void;
  onToggleVisibility?: (productId: string, isActive: boolean) => void;
}

const InventoryList: React.FC<InventoryListProps> = React.memo(({ products, onEdit, onDelete, onAddProduct, onToggleVisibility }) => {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const toggleProductExpansion = (productId: string) => {
    const newSet = new Set(expandedProducts);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
    }
    setExpandedProducts(newSet);
  };



  const getStockStatusClass = (variant: ProductVariant) => {
    if (variant.stock <= 0) return 'text-accent-pink font-black uppercase tracking-wider';
    if (variant.stock <= variant.lowStockThreshold) return 'text-secondary font-black uppercase tracking-wider';
    return 'text-foreground font-medium';
  };

  const confirmDelete = () => {
    if (productToDelete) {
      onDelete(productToDelete.id);
      setProductToDelete(null);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-12">
        <div>
          <h2 className="text-[28px] font-black font-heading text-foreground tracking-tighter leading-none">Quản lý Kho hàng</h2>
          <p className="text-[13px] font-bold text-muted-foreground mt-2">Kiểm soát tồn kho, dự báo nhập hàng và tối ưu hóa hiển thị sản phẩm.</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setIsForecastModalOpen(true)} className="px-6 py-3.5 bg-white text-secondary hover:bg-muted border border-border rounded-[18px] font-black text-[14px] transition-all flex items-center shadow-soft-sm active:scale-95 group">
            <SparklesIcon className="w-5 h-5 mr-3 group-hover:animate-pulse" />
            <span>Dự báo Nhập hàng</span>
          </button>
          <button onClick={onAddProduct} className="px-8 py-3.5 bg-primary text-white hover:bg-primary-dark rounded-[18px] font-black text-[15px] shadow-soft-lg active:scale-95 transition-all flex items-center border-b-4 border-primary-dark/30">
            <PlusIcon className="w-5 h-5 mr-2" />
            <span>Thêm sản phẩm</span>
          </button>
        </div>
      </div>
      {products.length === 0 ? (
        <div className="text-center py-20 card-base border-dashed flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-muted/30 rounded-[32px] flex items-center justify-center mb-6">
            <CubeIcon className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Kho hàng của bạn đang trống</h3>
          <p className="text-muted-foreground max-w-xs mb-8">Hãy thêm sản phẩm đầu tiên để bắt đầu quản lý kinh doanh của bạn.</p>
          <button onClick={onAddProduct} className="btn-primary flex items-center gap-2 px-6 py-3 shadow-soft hover:shadow-soft-md transition-all active:scale-95">
            <PlusIcon className="w-5 h-5" />
            <span className="font-bold">Thêm sản phẩm ngay</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-border/50 rounded-[32px] overflow-hidden shadow-soft-lg">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-border/50">
              <thead>
                <tr className="bg-muted/20">
                  <th scope="col" className="w-[45%] px-8 py-5 text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Sản phẩm</th>
                  <th scope="col" className="px-8 py-5 text-center text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Hiển thị</th>
                  <th scope="col" className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Tổng tồn kho</th>
                  <th scope="col" className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Giá niêm yết</th>
                  <th scope="col" className="px-8 py-5 text-center text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-border/30">
                {products.map(product => (
                  <React.Fragment key={product.id}>
                    <tr className={`transition-all duration-200 group ${expandedProducts.has(product.id) ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                      <td onClick={() => toggleProductExpansion(product.id)} className="cursor-pointer px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`p-1 rounded-lg transition-transform ${expandedProducts.has(product.id) ? 'rotate-180 bg-primary/20 text-primary' : 'text-muted-foreground/40'}`}>
                            <ChevronDownIcon className="w-5 h-5" />
                          </div>
                          <span className="ml-3 text-[14px] font-bold text-foreground group-hover:text-primary transition-colors">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newValue = product.is_active === false ? true : false;
                            onToggleVisibility?.(product.id, newValue);
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${product.is_active !== false
                            ? 'bg-status-success-bg text-status-success shadow-soft-sm'
                            : 'bg-muted text-muted-foreground/40'
                            }`}
                          title={product.is_active !== false ? 'Bấm để ẩn khỏi Messenger' : 'Bấm để hiện trên Messenger'}
                        >
                          {product.is_active !== false ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                        </button>
                      </td>
                      <td onClick={() => toggleProductExpansion(product.id)} className="cursor-pointer px-6 py-5 whitespace-nowrap text-[15px] font-black text-foreground text-right tabular-nums">
                        {product.variants.reduce((sum, v) => sum + v.stock, 0)}
                      </td>
                      <td onClick={() => toggleProductExpansion(product.id)} className="cursor-pointer px-6 py-5 whitespace-nowrap text-[14px] font-bold text-muted-foreground text-right">
                        {formatCurrency(product.price)}
                      </td>

                      <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(product);
                            }}
                            className="w-9 h-9 flex items-center justify-center text-primary-dark bg-primary/10 hover:bg-primary transition-all rounded-xl hover:text-white shadow-soft-sm"
                            title="Sửa"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductToDelete(product);
                            }}
                            className="w-9 h-9 flex items-center justify-center text-accent-pink bg-accent-pink/10 hover:bg-accent-pink transition-all rounded-xl hover:text-white shadow-soft-sm"
                            title="Xóa sản phẩm"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedProducts.has(product.id) && (
                      <tr className="animate-in slide-in-from-top-2 duration-300">
                        <td colSpan={5} className="p-0">
                          <div className="px-12 py-6 bg-muted/10">
                            <div className="card-base p-0 overflow-hidden border-border/30 shadow-none">
                              <table className="min-w-full divide-y divide-border/20">
                                <thead>
                                  <tr className="bg-muted/30">
                                    <th className="px-6 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Loại sản phẩm</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Màu sắc</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Số lượng tồn</th>
                                    <th className="px-6 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ngưỡng cảnh báo</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/10 bg-white">
                                  {product.variants.map(variant => (
                                    <tr key={variant.id} className="hover:bg-primary/5 transition-colors">
                                      <td className="px-6 py-4 text-[13px] font-bold text-foreground">{variant.size}</td>
                                      <td className="px-6 py-4 text-[13px] font-medium text-muted-foreground">{variant.color}</td>
                                      <td className={`px-6 py-4 text-[13px] text-right tabular-nums ${getStockStatusClass(variant)}`}>{variant.stock}</td>
                                      <td className="px-6 py-4 text-[12px] text-muted-foreground/50 text-right font-medium italic">{variant.lowStockThreshold} đơn vị</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <InventoryForecastModal isOpen={isForecastModalOpen} onClose={() => setIsForecastModalOpen(false)} products={products} />

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!productToDelete} onClose={() => setProductToDelete(null)} title="Xác nhận xóa sản phẩm">
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center p-6 bg-accent-pink/5 rounded-3xl border border-accent-pink/10">
            <div className="w-16 h-16 bg-accent-pink/10 rounded-full flex items-center justify-center text-accent-pink mb-4">
              <ExclamationTriangleIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Bạn có chắc chắn muốn xóa?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Sản phẩm <span className="font-bold text-foreground">{productToDelete?.name}</span> sẽ bị xóa vĩnh viễn khỏi kho hàng và các kênh bán hàng liên quan.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setProductToDelete(null)}
              className="flex-1 px-4 py-3 bg-muted text-foreground rounded-2xl hover:bg-muted/80 font-bold transition-all"
            >
              Hủy bỏ
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 px-4 py-3 bg-accent-pink text-white rounded-2xl hover:bg-accent-pink/90 font-bold shadow-soft transition-all flex items-center justify-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              Xác nhận xóa
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
});

export default InventoryList;
