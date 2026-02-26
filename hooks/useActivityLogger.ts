import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { useActivityLogsData } from './useData';

export function useActivityLogger() {
    const { currentUser } = useAuth();
    const { addLog } = useActivityLogsData();

    const logActivity = useCallback((description: string, entityId?: string, entityType?: 'order' | 'product' | 'customer' | 'voucher' | 'rule') => {
        addLog({
            description,
            entityId,
            entityType
        });
    }, [addLog]);

    return { logActivity, currentUser };
}
