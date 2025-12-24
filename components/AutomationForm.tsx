import React, { useState, useEffect } from 'react';
import type { AutomationRule, RuleTriggerType, RuleCondition, RuleAction, RuleActionType } from '../types';
import { TrashIcon } from './icons';

interface AutomationFormProps {
  rule: AutomationRule | null;
  onSave: (rule: AutomationRule) => void;
  onClose: () => void;
}

const AutomationForm: React.FC<AutomationFormProps> = ({ rule, onSave, onClose }) => {
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<RuleTriggerType>('ORDER_CREATED');
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [actions, setActions] = useState<RuleAction[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (rule) {
      setName(rule.name);
      setTrigger(rule.trigger);
      setConditions(rule.conditions);
      setActions(rule.actions);
    } else {
      // Default for new rule
      setName('');
      setTrigger('ORDER_CREATED');
      setConditions([{ field: 'totalAmount', operator: 'GREATER_THAN', value: 0 }]);
      setActions([{ type: 'ADD_CUSTOMER_TAG', value: '' }]);
    }
  }, [rule]);
  
  const validate = () => {
      const newErrors: Record<string, string> = {};
      if (!name.trim()) newErrors.name = 'Tên quy tắc không được trống.';
      if (conditions.some(c => c.value <= 0)) newErrors.conditionValue = 'Giá trị điều kiện phải lớn hơn 0.';
      if (actions.some(a => !a.value.trim())) newErrors.actionValue = 'Giá trị hành động không được trống.';
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    onSave({
      id: rule?.id || crypto.randomUUID(),
      name,
      trigger,
      conditions,
      actions,
      isEnabled: rule?.isEnabled ?? true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tên quy tắc*</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="Ví dụ: Tự động gắn tag VIP"
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
      </div>

      <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
          <h3 className="font-semibold text-gray-800">1. KHI (Trigger)</h3>
          <p className="text-sm">Sự kiện này xảy ra:</p>
          <select value={trigger} disabled className="w-full bg-gray-200 p-2 border border-gray-300 rounded-md">
              <option value="ORDER_CREATED">Đơn hàng mới được tạo</option>
          </select>
          <p className="text-xs text-gray-500">Nhiều trigger hơn sẽ được hỗ trợ trong tương lai.</p>
      </div>
      
      <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
          <h3 className="font-semibold text-gray-800">2. NẾU (Conditions)</h3>
          <p className="text-sm">Tất cả các điều kiện sau được thỏa mãn:</p>
           {conditions.map((cond, index) => (
             <div key={index} className="flex items-center gap-2">
                 <select value={cond.field} disabled className="bg-gray-200 p-2 border border-gray-300 rounded-md">
                    <option value="totalAmount">Tổng giá trị đơn hàng</option>
                 </select>
                 <select value={cond.operator} disabled className="bg-gray-200 p-2 border border-gray-300 rounded-md">
                    <option value="GREATER_THAN">Lớn hơn</option>
                 </select>
                 <input 
                    type="number"
                    value={cond.value}
                    onChange={e => {
                        const newConds = [...conditions];
                        newConds[index].value = Number(e.target.value);
                        setConditions(newConds);
                    }}
                    className="flex-grow p-2 border border-gray-300 rounded-md"
                 />
             </div>
           ))}
           {errors.conditionValue && <p className="text-red-500 text-xs mt-1">{errors.conditionValue}</p>}
           <p className="text-xs text-gray-500">Chức năng thêm nhiều điều kiện sẽ sớm được cập nhật.</p>
      </div>

      <div className="space-y-4 p-4 bg-slate-50 rounded-lg border">
          <h3 className="font-semibold text-gray-800">3. THÌ (Actions)</h3>
          <p className="text-sm">Thực hiện các hành động sau:</p>
          {actions.map((act, index) => (
            <div key={index} className="flex items-center gap-2">
                 <select value={act.type} disabled className="bg-gray-200 p-2 border border-gray-300 rounded-md">
                    <option value="ADD_CUSTOMER_TAG">Thêm nhãn cho khách hàng</option>
                 </select>
                 <input 
                    type="text"
                    value={act.value}
                    onChange={e => {
                        const newActions = [...actions];
                        newActions[index].value = e.target.value;
                        setActions(newActions);
                    }}
                    placeholder="Nhập tên nhãn, ví dụ: VIP"
                    className="flex-grow p-2 border border-gray-300 rounded-md"
                 />
            </div>
          ))}
          {errors.actionValue && <p className="text-red-500 text-xs mt-1">{errors.actionValue}</p>}
          <p className="text-xs text-gray-500">Chức năng thêm nhiều hành động sẽ sớm được cập nhật.</p>
      </div>

      <div className="flex justify-end gap-4 pt-4 border-t">
        <button type="button" onClick={onClose} className="btn-muted px-4 py-2">Hủy</button>
        <button type="submit" className="btn-primary px-6 py-2">Lưu Quy tắc</button>
      </div>
    </form>
  );
};

export default AutomationForm;