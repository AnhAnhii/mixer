import React, { useCallback } from 'react';
import { Order, AutomationRule, Customer } from '../types';
import { useActivityLogger } from './useActivityLogger';

export function useAutomations(
    automationRules: AutomationRule[],
    setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>
) {
    const { logActivity } = useActivityLogger();

    const runAutomations = useCallback((triggerType: 'ORDER_CREATED', payload: { order: Order }) => {
        const applicableRules = automationRules.filter(r => r.trigger === triggerType && r.isEnabled);

        for (const rule of applicableRules) {
            const { order } = payload;

            const conditionsMet = rule.conditions.every(cond => {
                if (cond.field === 'totalAmount' && cond.operator === 'GREATER_THAN') {
                    return order.totalAmount > (cond.value as number);
                }
                return false;
            });

            if (conditionsMet) {
                rule.actions.forEach(action => {
                    if (action.type === 'ADD_CUSTOMER_TAG') {
                        setCustomers(prev => {
                            const newCustomers = [...prev];
                            const customerIndex = newCustomers.findIndex(c => c.id === order.customerId);
                            if (customerIndex > -1) {
                                const customer = { ...newCustomers[customerIndex] };
                                const tags = new Set(customer.tags || []);
                                tags.add(action.value);
                                customer.tags = Array.from(tags);
                                newCustomers[customerIndex] = customer;

                                logActivity(`Quy tắc <strong>${rule.name}</strong> đã thêm nhãn "<strong>${action.value}</strong>" cho khách hàng <strong>${customer.name}</strong>.`, customer.id, 'customer');
                            }
                            return newCustomers;
                        });
                    }
                });
            }
        }
    }, [automationRules, setCustomers, logActivity]);

    return { runAutomations };
}
