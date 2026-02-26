import React, { useState, useEffect } from 'react';
import type { Product, ProductVariant } from '../types';
import { PlusIcon, TrashIcon } from './icons';

interface ProductFormProps {
  onSave: (product: Product) => void;
  onClose: () => void;
  product: Product | null;
}

const ProductForm: React.FC<ProductFormProps> = ({ onSave, onClose, product }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [imageUrls, setImageUrls] = useState<string[]>(['', '', '', '', '']); // 5 ảnh
  const [description, setDescription] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(product.price);
      setCostPrice(product.costPrice || 0);
      setImageUrls([
        product.image_url || '',
        product.image_url_2 || '',
        product.image_url_3 || '',
        product.image_url_4 || '',
        product.image_url_5 || ''
      ]);
      setDescription(product.description || '');
      setVariants(product.variants);
    } else {
      // Reset form to add a new product with one default variant
      setName('');
      setPrice(0);
      setCostPrice(0);
      setImageUrls(['', '', '', '', '']);
      setDescription('');
      setVariants([{ id: crypto.randomUUID(), size: '', color: '', stock: 0, lowStockThreshold: 5 }]);
    }
  }, [product]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Tên sản phẩm không được để trống.';
    if (price <= 0) newErrors.price = 'Giá sản phẩm phải lớn hơn 0.';
    if (costPrice < 0) newErrors.costPrice = 'Giá vốn không hợp lệ.';

    variants.forEach((variant, index) => {
      if (!variant.size.trim()) newErrors[`variantSize_${index}`] = 'Size không được trống.';
      if (!variant.color.trim()) newErrors[`variantColor_${index}`] = 'Màu không được trống.';
      if (variant.stock < 0) newErrors[`variantStock_${index}`] = 'Số lượng không hợp lệ.';
      if (variant.lowStockThreshold < 0) newErrors[`variantThreshold_${index}`] = 'Ngưỡng không hợp lệ.';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      id: product?.id || crypto.randomUUID(),
      name,
      price,
      costPrice,
      image_url: imageUrls[0] || undefined,
      image_url_2: imageUrls[1] || undefined,
      image_url_3: imageUrls[2] || undefined,
      image_url_4: imageUrls[3] || undefined,
      image_url_5: imageUrls[4] || undefined,
      description: description || undefined,
      variants
    });
  };

  const handleVariantChange = <K extends keyof ProductVariant>(index: number, field: K, value: ProductVariant[K]) => {
    const newVariants = [...variants];
    newVariants[index][field] = value;
    setVariants(newVariants);
  };

  const addVariant = () => {
    setVariants([...variants, { id: crypto.randomUUID(), size: '', color: '', stock: 0, lowStockThreshold: 5 }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-10">
      <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500">
        <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
          Thông tin cơ bản
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          <div className="md:col-span-6">
            <label htmlFor="productName" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Tên sản phẩm *</label>
            <input
              type="text"
              id="productName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Áo Hoodie Black Swan V2"
              className="w-full px-4 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-sm font-bold outline-none"
            />
            {errors.name && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{errors.name}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="productCostPrice" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Giá vốn</label>
            <div className="relative">
              <input
                type="number"
                id="productCostPrice"
                value={costPrice}
                onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                className="w-full pl-4 pr-12 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/40 uppercase">VND</span>
            </div>
            {errors.costPrice && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{errors.costPrice}</p>}
          </div>
          <div className="md:col-span-2">
            <label htmlFor="productPrice" className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Giá bán *</label>
            <div className="relative">
              <input
                type="number"
                id="productPrice"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full pl-4 pr-12 py-3 bg-white border border-border rounded-xl focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground/40 uppercase">VND</span>
            </div>
            {errors.price && <p className="text-status-danger text-[11px] font-bold mt-2 ml-1 animate-in shake-sm">{errors.price}</p>}
          </div>
          <div className="md:col-span-2 flex items-end">
            <div className="w-full p-3 bg-status-success/5 border border-status-success/20 rounded-xl flex flex-col items-center justify-center min-h-[50px] group transition-all hover:bg-status-success/10">
              <p className="text-[9px] font-black text-status-success uppercase tracking-widest opacity-60">Lợi nhuận dự kiến</p>
              <p className="font-black text-status-success text-[14px] tracking-tight">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price - costPrice)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ảnh sản phẩm (5 ảnh) */}
      <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
        <div className="flex justify-between items-end mb-6">
          <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-accent-pink rounded-full"></div>
            Hình ảnh sản phẩm
          </h3>
          <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-50 tracking-wider">Tối đa 5 ảnh</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {imageUrls.map((url, index) => (
            <div key={index} className="space-y-3 p-3 bg-white rounded-2xl border border-border/50 shadow-soft-sm group hover:border-primary/20 transition-all">
              <div className="aspect-square bg-muted/30 rounded-xl overflow-hidden flex items-center justify-center relative border border-border/30">
                {url ? (
                  <img
                    src={url}
                    alt={`Ảnh ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x150?text=Lỗi';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 opacity-20">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px] font-black uppercase tracking-widest">Trống</span>
                  </div>
                )}
                {index === 0 && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-white text-[8px] font-black uppercase tracking-widest rounded-md shadow-sm">Chính</div>
                )}
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  const newUrls = [...imageUrls];
                  newUrls[index] = e.target.value;
                  setImageUrls(newUrls);
                }}
                placeholder="Dán URL ảnh..."
                className="w-full px-2.5 py-2 text-[12px] bg-muted/20 border border-border rounded-lg focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500 delay-100">
        <label htmlFor="description" className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-status-info rounded-full"></div>
          Mô tả chi tiết
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Nhập chất liệu, kiểu dáng, hướng dẫn chọn size..."
          className="w-full p-5 bg-white border border-border rounded-2xl text-[14px] outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none leading-relaxed placeholder:text-muted-foreground/30 mt-4"
        />
      </div>

      <div className="p-6 bg-muted/20 border border-border/50 rounded-[28px] animate-in fade-in slide-in-from-top-4 duration-500 delay-150">
        <h3 className="text-[13px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-secondary rounded-full"></div>
          Phân loại & Tồn kho
        </h3>
        <div className="space-y-4">
          {variants.map((variant, index) => (
            <div key={variant.id} className="grid grid-cols-12 gap-4 p-5 bg-white rounded-2xl border border-border/50 items-center shadow-soft-sm group hover:border-primary/20 transition-all animate-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="col-span-6 sm:col-span-3">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Kích cỡ (Size)</label>
                <input
                  type="text"
                  value={variant.size}
                  onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                  placeholder="S, M, L..."
                  className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none"
                />
                {errors[`variantSize_${index}`] && <p className="text-status-danger text-[9px] font-bold mt-1 ml-1 shake-sm">{errors[`variantSize_${index}`]}</p>}
              </div>
              <div className="col-span-6 sm:col-span-3">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Màu sắc</label>
                <input
                  type="text"
                  value={variant.color}
                  onChange={(e) => handleVariantChange(index, 'color', e.target.value)}
                  placeholder="Đen, Trắng..."
                  className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold outline-none"
                />
                {errors[`variantColor_${index}`] && <p className="text-status-danger text-[9px] font-bold mt-1 ml-1 shake-sm">{errors[`variantColor_${index}`]}</p>}
              </div>
              <div className="col-span-6 sm:col-span-2">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Số lượng tồn</label>
                <input
                  type="number"
                  value={variant.stock}
                  onChange={(e) => handleVariantChange(index, 'stock', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold text-center outline-none"
                />
                {errors[`variantStock_${index}`] && <p className="text-status-danger text-[9px] font-bold mt-1 ml-1 shake-sm">{errors[`variantStock_${index}`]}</p>}
              </div>
              <div className="col-span-6 sm:col-span-3">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">Ngưỡng cảnh báo</label>
                <input
                  type="number"
                  value={variant.lowStockThreshold}
                  onChange={(e) => handleVariantChange(index, 'lowStockThreshold', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 bg-muted/30 border border-border rounded-xl focus:bg-white focus:ring-4 focus:ring-primary/5 transition-all text-sm font-bold text-center outline-none"
                />
                {errors[`variantThreshold_${index}`] && <p className="text-status-danger text-[9px] font-bold mt-1 ml-1 shake-sm">{errors[`variantThreshold_${index}`]}</p>}
              </div>
              <div className="col-span-12 sm:col-span-1 flex items-end justify-end pt-4 sm:pt-0">
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="w-9 h-9 flex items-center justify-center text-accent-pink bg-accent-pink/5 hover:bg-accent-pink hover:text-white rounded-xl transition-all active:scale-90"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addVariant}
          className="mt-6 flex items-center gap-2 text-[13px] font-black text-primary hover:text-primary-dark transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
            <PlusIcon className="w-4 h-4" />
          </div>
          <span>Thêm phân loại mới</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-8 border-t border-border/30">
        <button
          type="button"
          onClick={onClose}
          className="px-8 py-4 bg-muted text-foreground rounded-2xl hover:bg-muted/80 font-black text-[14px] transition-all active:scale-95"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          className="px-10 py-4 bg-primary text-white rounded-2xl hover:bg-primary-dark font-black text-[15px] shadow-soft-lg transition-all active:scale-95"
        >
          Lưu sản phẩm
        </button>
      </div>
    </form>
  );
};

export default ProductForm;