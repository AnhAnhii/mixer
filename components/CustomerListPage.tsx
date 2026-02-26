
import React, { useState, useMemo, useEffect } from 'react';
import type { Customer } from '../types';
import { PencilIcon, PlusIcon, EyeIcon, TagIcon, ArrowDownTrayIcon, UserGroupIcon, TrashIcon, ExclamationTriangleIcon } from './icons';
import { useSessionStorage } from '../hooks/useSessionStorage';
import Modal from './Modal';

interface CustomerListPageProps {
  customers: Customer[];
  onViewDetails: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customerId: string) => void;
  onBulkDelete: (customerIds: string[]) => void;
  onAddCustomer: () => void;
}

const CustomerListPage: React.FC<CustomerListPageProps> = React.memo(({ customers, onViewDetails, onEdit, onDelete, onBulkDelete, onAddCustomer }) => {
  const [searchTerm, setSearchTerm] = useSessionStorage('customerListSearchTerm', '');
  const [tagFilter, setTagFilter] = useSessionStorage<string | 'all'>('customerListTagFilter', 'all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete Confirmation States
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    customers.forEach(c => c.tags?.forEach(t => tags.add(t)));
    return ['all', ...Array.from(tags)];
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return customers
      .filter(customer => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const matchesSearch =
          customer.name.toLowerCase().includes(lowerSearchTerm) ||
          customer.phone.includes(searchTerm) ||
          customer.email?.toLowerCase().includes(lowerSearchTerm);

        const matchesTag = tagFilter === 'all' || customer.tags?.includes(tagFilter);
        return matchesSearch && matchesTag;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [customers, searchTerm, tagFilter]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, tagFilter]);

  const handleExportPhones = () => {
    const phones = filteredCustomers.map(c => c.phone).join('\n');
    const blob = new Blob([phones], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    link.download = `danh-sach-sdt-khach-hang-${date}.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredCustomers.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelectedIds = new Set(selectedIds);
    if (newSelectedIds.has(id)) {
      newSelectedIds.delete(id);
    } else {
      newSelectedIds.add(id);
    }
    setSelectedIds(newSelectedIds);
  };

  const confirmSingleDelete = () => {
    if (customerToDelete) {
      onDelete(customerToDelete.id);
      setCustomerToDelete(null);
    }
  }

  const confirmBulkDelete = () => {
    onBulkDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6 mb-12">
        <div>
          <h2 className="text-[28px] font-black font-heading text-foreground tracking-tighter leading-none">Quản lý Khách hàng</h2>
          <p className="text-[13px] font-bold text-muted-foreground mt-2">Lưu trữ, phân loại và thấu hiểu chân dung khách hàng của bạn.</p>
        </div>
        <button onClick={onAddCustomer} className="px-8 py-3.5 bg-primary text-white hover:bg-primary-dark rounded-[18px] font-black text-[15px] shadow-soft-lg active:scale-95 transition-all flex items-center border-b-4 border-primary-dark/30">
          <PlusIcon className="w-5 h-5 mr-2" />
          <span>Thêm khách hàng</span>
        </button>
      </div>

      <div className="p-6 bg-muted/20 border border-border/50 rounded-[32px] flex flex-col md:flex-row gap-6 items-center">
        <div className="relative flex-grow w-full group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-muted-foreground/30 group-focus-within:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên, SĐT hoặc email khách hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border border-border rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-[15px] font-bold outline-none shadow-soft-sm placeholder:text-muted-foreground/20"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-56">
            <select
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              className="w-full pl-12 pr-12 py-4 bg-white border border-border rounded-2xl focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all text-[14px] font-black uppercase tracking-widest text-foreground outline-none cursor-pointer appearance-none shadow-soft-sm"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236B7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2.5' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center', backgroundSize: '1.25rem' }}
            >
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag === 'all' ? 'TẤT CẢ NHÃN' : tag.toUpperCase()}</option>
              ))}
            </select>
            <TagIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/30" />
          </div>

          <div className="flex gap-2">
            <button onClick={handleExportPhones} disabled={filteredCustomers.length === 0} className="w-14 h-14 flex items-center justify-center bg-white border border-border text-muted-foreground hover:text-primary rounded-2xl transition-all shadow-soft-sm disabled:opacity-30 disabled:cursor-not-allowed group active:scale-90" title="Xuất danh sách SĐT">
              <ArrowDownTrayIcon className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
            </button>
            {selectedIds.size > 0 && (
              <button onClick={() => setShowBulkDeleteConfirm(true)} className="h-14 flex items-center gap-3 px-6 bg-accent-pink/5 text-accent-pink border border-accent-pink/20 hover:bg-accent-pink hover:text-white rounded-2xl font-black text-[14px] uppercase tracking-wider transition-all shadow-soft animate-in zoom-in-95">
                <TrashIcon className="w-5 h-5" />
                <span>Xóa ({selectedIds.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="text-center py-20 card-base border-dashed flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-muted/30 rounded-[32px] flex items-center justify-center mb-6">
            <UserGroupIcon className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Chưa có khách hàng nào</h3>
          <p className="text-muted-foreground max-w-xs mb-8">Hãy thêm khách hàng đầu tiên để bắt đầu xây dựng mối quan hệ kinh doanh.</p>
          <button onClick={onAddCustomer} className="btn-primary flex items-center gap-2 px-6 py-3 shadow-soft hover:shadow-soft-md transition-all active:scale-95">
            <PlusIcon className="w-5 h-5" />
            <span className="font-bold">Thêm khách hàng mới</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-border/50 rounded-[32px] overflow-hidden shadow-soft-lg">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-border/50">
              <thead>
                <tr className="bg-muted/20">
                  <th scope="col" className="px-8 py-5 text-left w-10">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded-lg border-border text-primary focus:ring-4 focus:ring-primary/10 cursor-pointer transition-all appearance-none bg-white checked:bg-primary checked:border-primary relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white checked:after:text-[10px] checked:after:font-black"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredCustomers.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th scope="col" className="px-8 py-5 text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Khách hàng</th>
                  <th scope="col" className="px-8 py-5 text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Thông tin Liên hệ</th>
                  <th scope="col" className="px-8 py-5 text-left text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Phân loại Nhãn</th>
                  <th scope="col" className="px-8 py-5 text-center text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-border/30">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="transition-all duration-200 group hover:bg-muted/30">
                    <td className="px-6 py-5">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded-lg border-border text-primary focus:ring-primary/20 cursor-pointer transition-all"
                        checked={selectedIds.has(customer.id)}
                        onChange={() => handleSelectOne(customer.id)}
                      />
                    </td>
                    <td onClick={() => onViewDetails(customer)} className="px-6 py-5 whitespace-nowrap cursor-pointer">
                      <span className="text-[14px] font-bold text-foreground group-hover:text-primary transition-colors">{customer.name}</span>
                    </td>
                    <td onClick={() => onViewDetails(customer)} className="px-6 py-5 whitespace-nowrap cursor-pointer">
                      <p className="text-[13px] font-bold text-foreground">{customer.phone}</p>
                      {customer.email && <p className="text-[11px] text-muted-foreground font-medium">{customer.email}</p>}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1.5">
                        {customer.tags?.map(tag => (
                          <span key={tag} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20 rounded-lg">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                        <button
                          type="button"
                          onClick={() => onViewDetails(customer)}
                          className="w-9 h-9 flex items-center justify-center text-primary-dark bg-primary/10 hover:bg-primary transition-all rounded-xl hover:text-white shadow-soft-sm"
                          title="Xem chi tiết"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(customer)}
                          className="w-9 h-9 flex items-center justify-center text-secondary-dark bg-secondary/10 hover:bg-secondary transition-all rounded-xl hover:text-white shadow-soft-sm"
                          title="Sửa"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerToDelete(customer)}
                          className="w-9 h-9 flex items-center justify-center text-accent-pink bg-accent-pink/10 hover:bg-accent-pink transition-all rounded-xl hover:text-white shadow-soft-sm"
                          title="Xóa khách hàng"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation Modal */}
      <Modal isOpen={!!customerToDelete} onClose={() => setCustomerToDelete(null)} title="Xác nhận xóa khách hàng">
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center p-6 bg-accent-pink/5 rounded-3xl border border-accent-pink/10">
            <div className="w-16 h-16 bg-accent-pink/10 rounded-full flex items-center justify-center text-accent-pink mb-4">
              <ExclamationTriangleIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Xóa khách hàng này?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Khách hàng <span className="font-bold text-foreground">{customerToDelete?.name}</span> sẽ bị xóa vĩnh viễn khỏi hệ thống và không thể khôi phục.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCustomerToDelete(null)} className="flex-1 px-4 py-3 bg-muted text-foreground rounded-2xl hover:bg-muted/80 font-bold transition-all">Hủy bỏ</button>
            <button onClick={confirmSingleDelete} className="flex-1 px-4 py-3 bg-accent-pink text-white rounded-2xl hover:bg-accent-pink/90 font-bold shadow-soft transition-all flex items-center justify-center gap-2">
              <TrashIcon className="w-4 h-4" /> Xác nhận xóa
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal isOpen={showBulkDeleteConfirm} onClose={() => setShowBulkDeleteConfirm(false)} title="Xác nhận xóa nhiều khách hàng">
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center p-6 bg-accent-pink/5 rounded-3xl border border-accent-pink/10">
            <div className="w-16 h-16 bg-accent-pink/10 rounded-full flex items-center justify-center text-accent-pink mb-4">
              <ExclamationTriangleIcon className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Cảnh báo xóa dữ liệu hàng loạt</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bạn đang chuẩn bị xóa <span className="font-bold text-foreground">{selectedIds.size}</span> khách hàng đã chọn. Hành động này sẽ xóa vĩnh viễn dữ liệu và không thể hoàn tác.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowBulkDeleteConfirm(false)} className="flex-1 px-4 py-3 bg-muted text-foreground rounded-2xl hover:bg-muted/80 font-bold transition-all">Hủy bỏ</button>
            <button onClick={confirmBulkDelete} className="flex-1 px-4 py-3 bg-accent-pink text-white rounded-2xl hover:bg-accent-pink/90 font-bold shadow-soft transition-all flex items-center justify-center gap-2">
              <TrashIcon className="w-4 h-4" /> Xác nhận xóa tất cả
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
});

export default CustomerListPage;
