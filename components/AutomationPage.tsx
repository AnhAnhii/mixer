
import React, { useState } from 'react';
import type { AutomationRule } from '../types';
import { BoltIcon, PencilIcon, PlusIcon, TrashIcon, ExclamationTriangleIcon } from './icons';
import Modal from './Modal';

interface AutomationPageProps {
  rules: AutomationRule[];
  onAdd: () => void;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (ruleId: string, isEnabled: boolean) => void;
}

const AutomationPage: React.FC<AutomationPageProps> = ({ rules, onAdd, onEdit, onDelete, onToggle }) => {
  const [ruleToDelete, setRuleToDelete] = useState<AutomationRule | null>(null);

  const getTriggerText = (trigger: string) => {
    if (trigger === 'ORDER_CREATED') return 'Khi đơn hàng được tạo';
    return 'Không rõ';
  };

  const getConditionText = (rule: AutomationRule) => {
    return rule.conditions.map(c => 
      `Tổng giá trị đơn hàng lớn hơn ${c.value.toLocaleString('vi-VN')}đ`
    ).join(' và ');
  };

  const getActionText = (rule: AutomationRule) => {
    return rule.actions.map(a => 
      `Thêm nhãn "${a.value}" cho khách hàng`
    ).join(' và ');
  };
  
  const confirmDelete = () => {
      if (ruleToDelete) {
          onDelete(ruleToDelete.id);
          setRuleToDelete(null);
      }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-border pb-4">
        <div>
            <h2 className="text-2xl font-semibold text-card-foreground">Quy tắc Tự động hóa</h2>
            <p className="text-sm text-muted-foreground mt-1">Tự động hóa các công việc lặp đi lặp lại để tiết kiệm thời gian.</p>
        </div>
        <button onClick={onAdd} className="btn-primary flex items-center gap-2 px-4 py-2 shadow-sm">
          <PlusIcon className="w-5 h-5" /> Tạo quy tắc mới
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-16 card-base border border-dashed flex flex-col items-center">
          <BoltIcon className="w-16 h-16 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-lg font-semibold">Chưa có quy tắc tự động hóa nào.</p>
          <p className="text-muted-foreground/70 mt-2 mb-6">Hãy tạo quy tắc đầu tiên để hệ thống làm việc cho bạn.</p>
          <button onClick={onAdd} className="btn-primary flex items-center gap-2 px-4 py-2">
              <PlusIcon className="w-5 h-5"/> Tạo quy tắc mới
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map(rule => (
            <div key={rule.id} className="bg-card p-4 rounded-xl border border-border flex items-start gap-4">
                <div className="flex-grow space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-card-foreground">{rule.name}</h3>
                         <div className="flex items-center gap-3">
                            <div onClick={() => onToggle(rule.id, !rule.isEnabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${rule.isEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </div>
                            <button onClick={() => onEdit(rule)} className="text-primary hover:opacity-80 p-1 rounded-full hover:bg-primary/10"><PencilIcon className="w-5 h-5" /></button>
                            <button onClick={() => setRuleToDelete(rule)} className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"><TrashIcon className="w-5 h-5" /></button>
                         </div>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                        <p><span className="font-medium text-card-foreground/80">Khi:</span> {getTriggerText(rule.trigger)}</p>
                        <p><span className="font-medium text-card-foreground/80">Nếu:</span> {getConditionText(rule)}</p>
                        <p><span className="font-medium text-card-foreground/80">Thì:</span> {getActionText(rule)}</p>
                    </div>
                </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!ruleToDelete} onClose={() => setRuleToDelete(null)} title="Xác nhận xóa quy tắc">
          <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="p-3 bg-red-100 dark:bg-red-900/50 rounded-full text-red-600">
                      <ExclamationTriangleIcon className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-bold text-red-800 dark:text-red-200">Bạn có chắc chắn muốn xóa?</h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                          Quy tắc <strong>{ruleToDelete?.name}</strong> sẽ bị xóa vĩnh viễn và ngừng hoạt động.
                      </p>
                  </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setRuleToDelete(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium">Hủy bỏ</button>
                  <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium shadow-sm flex items-center gap-2">
                      <TrashIcon className="w-4 h-4" /> Xóa quy tắc
                  </button>
              </div>
          </div>
      </Modal>
    </div>
  );
};

export default AutomationPage;
