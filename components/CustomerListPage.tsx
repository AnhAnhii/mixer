
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
      if(customerToDelete) {
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-border pb-4">
        <h2 className="text-2xl font-semibold text-card-foreground">Quản lý Khách hàng</h2>
        <button onClick={onAddCustomer} className="btn-primary flex items-center gap-2 px-4 py-2 shadow-sm">
          <PlusIcon className="w-5 h-5" /> Thêm khách hàng
        </button>
      </div>

      <div className="card-base p-4 flex flex-col md:flex-row gap-4 border">
        <div className="flex-grow">
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, SĐT, hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-4 py-2 border border-input rounded-md shadow-sm focus:ring-primary focus:border-primary bg-card"
          />
        </div>
        <div className="flex items-center gap-2">
            <TagIcon className="w-5 h-5 text-muted-foreground" />
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="w-full md:w-auto p-2 border border-input rounded-md text-sm bg-card">
                {allTags.map(tag => (
                    <option key={tag} value={tag}>{tag === 'all' ? 'Tất cả nhãn' : tag}</option>
                ))}
            </select>
        </div>
        <div className="flex gap-2">
            <button onClick={handleExportPhones} disabled={filteredCustomers.length === 0} className="btn-secondary flex items-center justify-center gap-2 px-4 py-2 shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed">
                <ArrowDownTrayIcon className="w-5 h-5" /> Xuất SĐT
            </button>
            {selectedIds.size > 0 && (
                <button onClick={() => setShowBulkDeleteConfirm(true)} className="bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-md flex items-center gap-2 font-medium transition-colors">
                    <TrashIcon className="w-5 h-5" /> Xóa ({selectedIds.size})
                </button>
            )}
        </div>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="text-center py-16 card-base border border-dashed flex flex-col items-center">
          <UserGroupIcon className="w-16 h-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-lg font-semibold">Chưa có khách hàng nào.</p>
          <p className="text-muted-foreground/70 mt-2 mb-6">Nhấn "Thêm khách hàng" để bắt đầu.</p>
          <button onClick={onAddCustomer} className="btn-primary flex items-center gap-2 px-4 py-2">
              <PlusIcon className="w-5 h-5"/> Thêm khách hàng mới
          </button>
        </div>
      ) : (
        <div className="bg-card rounded-lg shadow-sm overflow-hidden border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="p-4">
                    <input 
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredCustomers.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tên khách hàng</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Liên hệ</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Nhãn</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-muted">
                    <td className="p-4">
                      <input 
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={selectedIds.has(customer.id)}
                        onChange={() => handleSelectOne(customer.id)}
                       />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-card-foreground">{customer.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        <p>{customer.phone}</p>
                        {customer.email && <p className="text-xs">{customer.email}</p>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      <div className="flex flex-wrap gap-1">
                        {customer.tags?.map(tag => (
                          <span key={tag} className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2 relative z-50">
                         <button 
                            type="button"
                            onClick={() => onViewDetails(customer)}
                            className="text-blue-600 hover:text-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900/50 p-2 rounded-full transition-colors" 
                            title="Xem chi tiết"
                         >
                          <EyeIcon className="w-5 h-5" />
                        </button>
                        <button 
                            type="button"
                            onClick={() => onEdit(customer)} 
                            className="text-primary hover:opacity-80 hover:bg-primary/10 p-2 rounded-full transition-colors" 
                            title="Sửa"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button 
                            type="button"
                            onClick={() => setCustomerToDelete(customer)} 
                            className="text-red-600 hover:text-red-900 hover:bg-red-100 dark:hover:bg-red-900/50 p-2 rounded-full transition-colors" 
                            title="Xóa khách hàng"
                        >
                          <TrashIcon className="w-5 h-5" />
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
       <Modal isOpen={!!customerToDelete} onClose={() => setCustomerToDelete(null)} title="Xác nhận xóa">
          <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600">
                      <ExclamationTriangleIcon className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-red-800 dark:text-red-200">Bạn có chắc chắn muốn xóa?</h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                          Khách hàng <strong>{customerToDelete?.name}</strong> sẽ bị xóa vĩnh viễn.
                      </p>
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setCustomerToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Hủy bỏ</button>
                  <button onClick={confirmSingleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium shadow-sm flex items-center gap-2">
                      <TrashIcon className="w-4 h-4" /> Xóa khách hàng
                  </button>
              </div>
          </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal isOpen={showBulkDeleteConfirm} onClose={() => setShowBulkDeleteConfirm(false)} title="Xác nhận xóa nhiều">
          <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600">
                      <ExclamationTriangleIcon className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-red-800 dark:text-red-200">Cảnh báo xóa dữ liệu</h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                          Bạn đang chuẩn bị xóa <strong>{selectedIds.size}</strong> khách hàng đã chọn. Hành động này không thể hoàn tác.
                      </p>
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowBulkDeleteConfirm(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Hủy bỏ</button>
                  <button onClick={confirmBulkDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium shadow-sm flex items-center gap-2">
                      <TrashIcon className="w-4 h-4" /> Xóa tất cả
                  </button>
              </div>
          </div>
      </Modal>
    </div>
  );
});

export default CustomerListPage;
