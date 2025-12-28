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
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (product) {
      setName(product.name);
      setPrice(product.price);
      setCostPrice(product.costPrice || 0);
      setImageUrl(product.image_url || '');
      setDescription(product.description || '');
      setVariants(product.variants);
    } else {
      // Reset form to add a new product with one default variant
      setName('');
      setPrice(0);
      setCostPrice(0);
      setImageUrl('');
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
      image_url: imageUrl || undefined,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-3">
          <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm</label>
          <input type="text" id="productName" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="productCostPrice" className="block text-sm font-medium text-gray-700 mb-1">Giá vốn</label>
          <input type="number" id="productCostPrice" value={costPrice} onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
          {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice}</p>}
        </div>
        <div>
          <label htmlFor="productPrice" className="block text-sm font-medium text-gray-700 mb-1">Giá bán</label>
          <input type="number" id="productPrice" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary" />
          {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
        </div>
        <div className="flex items-end">
          <div className="w-full p-2 text-center bg-gray-50 rounded-md">
            <p className="text-xs text-gray-500">Lợi nhuận dự kiến</p>
            <p className="font-semibold text-green-600">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price - costPrice)}</p>
          </div>
        </div>
      </div>

      {/* Ảnh và Mô tả sản phẩm */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-1">
            Ảnh sản phẩm (URL)
          </label>
          <input
            type="url"
            id="imageUrl"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary"
          />
          <p className="text-xs text-gray-500 mt-1">Paste URL ảnh từ Facebook, Shopee, hoặc website khác</p>
          {imageUrl && (
            <div className="mt-3">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/128x128?text=Lỗi+URL';
                }}
              />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Mô tả sản phẩm
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Mô tả chi tiết về sản phẩm..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary resize-none"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Phân loại sản phẩm (Size, Màu sắc, Tồn kho)</h3>
        {variants.map((variant, index) => (
          <div key={variant.id} className="grid grid-cols-12 gap-x-3 gap-y-2 p-3 bg-slate-50 rounded-lg relative">
            <div className="col-span-6 sm:col-span-3">
              <label className="block text-xs font-medium text-gray-600">Size</label>
              <input type="text" value={variant.size} onChange={(e) => handleVariantChange(index, 'size', e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm" />
              {errors[`variantSize_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`variantSize_${index}`]}</p>}
            </div>
            <div className="col-span-6 sm:col-span-3">
              <label className="block text-xs font-medium text-gray-600">Màu sắc</label>
              <input type="text" value={variant.color} onChange={(e) => handleVariantChange(index, 'color', e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm" />
              {errors[`variantColor_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`variantColor_${index}`]}</p>}
            </div>
            <div className="col-span-4 sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600">Tồn kho</label>
              <input type="number" value={variant.stock} onChange={(e) => handleVariantChange(index, 'stock', parseInt(e.target.value) || 0)} className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm" />
              {errors[`variantStock_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`variantStock_${index}`]}</p>}
            </div>
            <div className="col-span-8 sm:col-span-3">
              <label className="block text-xs font-medium text-gray-600">Ngưỡng sắp hết</label>
              <input type="number" value={variant.lowStockThreshold} onChange={(e) => handleVariantChange(index, 'lowStockThreshold', parseInt(e.target.value) || 0)} className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm" />
              {errors[`variantThreshold_${index}`] && <p className="text-red-500 text-xs mt-1">{errors[`variantThreshold_${index}`]}</p>}
            </div>
            <div className="col-span-12 sm:col-span-1 flex items-end justify-start sm:justify-center">
              {variants.length > 1 && (
                <button type="button" onClick={() => removeVariant(index)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition-colors">
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={addVariant} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-indigo-800 transition-colors">
          <PlusIcon className="w-5 h-5" />
          Thêm phân loại
        </button>
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">Hủy</button>
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-indigo-700 transition-colors">Lưu sản phẩm</button>
      </div>
    </form>
  );
};

export default ProductForm;