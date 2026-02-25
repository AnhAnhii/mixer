
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



  const getStockStatusColor = (variant: ProductVariant) => {
    if (variant.stock <= 0) return 'text-accent-pink font-bold';
    if (variant.stock <= variant.lowStockThreshold) return 'text-accent-orange font-bold';
    return 'text-card-foreground';
  }

  const confirmDelete = () => {
    if (productToDelete) {
      onDelete(productToDelete.id);
      setProductToDelete(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b-2 border-border pb-4">
        <h2 className="text-2xl font-black font-heading text-card-foreground">Quản lý Kho hàng 📦</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsForecastModalOpen(true)} className="btn-secondary flex items-center gap-2 px-4 py-2">
            <SparklesIcon className="w-5 h-5" />Dự báo Nhập hàng (AI)
          </button>
          <button onClick={onAddProduct} className="btn-primary flex items-center gap-2 px-4 py-2 shadow-sm">
            <PlusIcon className="w-5 h-5" />Thêm sản phẩm
          </button>
        </div>
      </div>
      {products.length === 0 ? (
        <div className="text-center py-16 card-base border border-dashed flex flex-col items-center">
          <CubeIcon className="w-16 h-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-lg font-semibold">Kho hàng của bạn đang trống.</p>
          <p className="text-muted-foreground/70 mt-2 mb-6">Nhấn "Thêm sản phẩm" để bắt đầu quản lý kho.</p>
          <button onClick={onAddProduct} className="btn-primary flex items-center gap-2 px-4 py-2">
            <PlusIcon className="w-5 h-5" />Thêm sản phẩm
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-lg overflow-hidden border-2 border-border shadow-[4px_4px_0px_var(--color-border)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50 border-b-2 border-border">
                <tr>
                  <th scope="col" className="w-1/3 px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider compact-px compact-py">Sản phẩm</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider compact-px compact-py">Messenger</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider compact-px compact-py">Tổng tồn kho</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider compact-px compact-py">Giá bán</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider compact-px compact-py">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {products.map(product => (
                  <React.Fragment key={product.id}>
                    <tr className="hover:bg-muted group">
                      <td onClick={() => toggleProductExpansion(product.id)} className="cursor-pointer px-6 py-4 whitespace-nowrap compact-px compact-py">
                        <div className="flex items-center">
                          <ChevronDownIcon className={`w-5 h-5 text-muted-foreground/70 mr-2 transition-transform ${expandedProducts.has(product.id) ? 'rotate-180' : ''}`} />
                          <span className="text-sm font-medium text-card-foreground compact-text-sm">{product.name}</span>
                        </div>
                      </td>
                      {/* Toggle Messenger visibility */}
                      <td className="px-6 py-4 whitespace-nowrap text-center compact-px compact-py">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newValue = product.is_active === false ? true : false;
                            onToggleVisibility?.(product.id, newValue);
                          }}
                          className={`p-2 rounded-lg border-2 transition-all duration-150 ${product.is_active !== false
                            ? 'text-accent-mint border-black bg-accent-mint/20 hover:bg-accent-mint/40 shadow-[2px_2px_0px_#000]'
                            : 'text-muted-foreground border-border bg-muted hover:bg-muted/80'
                            }`}
                          title={product.is_active !== false ? 'Bấm để ẩn khỏi Messenger' : 'Bấm để hiện trên Messenger'}
                        >
                          {product.is_active !== false ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                        </button>
                      </td>
                      <td onClick={() => toggleProductExpansion(product.id)} className="cursor-pointer px-6 py-4 whitespace-nowrap text-sm text-card-foreground text-right font-medium compact-px compact-py compact-text-sm">
                        {product.variants.reduce((sum, v) => sum + v.stock, 0)}
                      </td>
                      <td onClick={() => toggleProductExpansion(product.id)} className="cursor-pointer px-6 py-4 whitespace-nowrap text-sm text-muted-foreground text-right compact-px compact-py compact-text-sm">{formatCurrency(product.price)}</td>

                      {/* Action Cell */}
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium compact-px compact-py">
                        <div className="flex items-center justify-center gap-2 relative z-50">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(product);
                            }}
                            className="text-primary hover:bg-primary/10 p-2 rounded-lg border-2 border-transparent hover:border-border transition-all"
                            title="Sửa"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductToDelete(product);
                            }}
                            className="text-accent-pink hover:bg-accent-pink/10 p-2 rounded-lg border-2 border-transparent hover:border-accent-pink transition-all"
                            title="Xóa sản phẩm"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedProducts.has(product.id) && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <div className="p-4 bg-muted/30">
                            <h4 className="text-sm font-semibold text-card-foreground mb-2 pl-2 compact-text-sm">Chi tiết tồn kho:</h4>
                            <div className="overflow-hidden border-2 border-border rounded-lg">
                              <table className="min-w-full divide-y divide-border bg-card">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase compact-px compact-py">Size</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase compact-px compact-py">Màu sắc</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase compact-px compact-py">Tồn kho</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase compact-px compact-py">Ngưỡng sắp hết</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {product.variants.map(variant => (
                                    <tr key={variant.id}>
                                      <td className="px-4 py-3 text-sm text-card-foreground compact-px compact-py compact-text-sm">{variant.size}</td>
                                      <td className="px-4 py-3 text-sm text-card-foreground compact-px compact-py compact-text-sm">{variant.color}</td>
                                      <td className={`px-4 py-3 text-sm text-right compact-px compact-py compact-text-sm ${getStockStatusColor(variant)}`}>{variant.stock}</td>
                                      <td className="px-4 py-3 text-sm text-muted-foreground text-right compact-px compact-py compact-text-sm">{variant.lowStockThreshold}</td>
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
      <Modal isOpen={!!productToDelete} onClose={() => setProductToDelete(null)} title="Xác nhận xóa">
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600">
              <ExclamationTriangleIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-200">Bạn có chắc chắn muốn xóa?</h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                Sản phẩm <strong>{productToDelete?.name}</strong> sẽ bị xóa vĩnh viễn khỏi kho hàng.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setProductToDelete(null)}
              className="btn-muted px-4 py-2 font-semibold"
            >
              Hủy bỏ
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 bg-accent-pink text-white border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 font-bold flex items-center gap-2 transition-all duration-150"
            >
              <TrashIcon className="w-4 h-4" />
              Xóa sản phẩm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
});

export default InventoryList;
