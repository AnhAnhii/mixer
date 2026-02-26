/**
 * useRealtimeSubscription — subscribes to Supabase Realtime changes.
 * When a row is inserted/updated/deleted, the local state is updated immediately.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

interface RealtimeOptions<T> {
    table: string;
    schema?: string;
    onInsert?: (record: T) => void;
    onUpdate?: (record: T) => void;
    onDelete?: (oldRecord: T) => void;
    enabled?: boolean;
}

export function useRealtimeSubscription<T extends { id: string }>({
    table,
    schema = 'public',
    onInsert,
    onUpdate,
    onDelete,
    enabled = true,
}: RealtimeOptions<T>) {
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Use refs for callbacks to avoid re-subscribing on every render
    const onInsertRef = useRef(onInsert);
    const onUpdateRef = useRef(onUpdate);
    const onDeleteRef = useRef(onDelete);

    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onDeleteRef.current = onDelete;

    useEffect(() => {
        if (!enabled || !isSupabaseConfigured()) return;

        const channelName = `realtime-${table}`;

        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes' as any,
                { event: '*', schema, table },
                (payload: RealtimePostgresChangesPayload<T>) => {
                    switch (payload.eventType) {
                        case 'INSERT':
                            onInsertRef.current?.(payload.new as T);
                            break;
                        case 'UPDATE':
                            onUpdateRef.current?.(payload.new as T);
                            break;
                        case 'DELETE':
                            onDeleteRef.current?.(payload.old as T);
                            break;
                    }
                },
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ Realtime: listening to ${table}`);
                }
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [table, schema, enabled]);
}

/**
 * Convenience: subscribe to a table and auto-update a setState array.
 */
export function useRealtimeSync<T extends { id: string }>(
    table: string,
    setData: React.Dispatch<React.SetStateAction<T[]>>,
    enabled = true,
) {
    useRealtimeSubscription<T>({
        table,
        enabled,
        onInsert: useCallback(
            (record: T) => {
                setData((prev) => {
                    if (prev.some((item) => item.id === record.id)) return prev;
                    return [...prev, record];
                });
            },
            [setData],
        ),
        onUpdate: useCallback(
            (record: T) => {
                setData((prev) =>
                    prev.map((item) => (item.id === record.id ? { ...item, ...record } : item)),
                );
            },
            [setData],
        ),
        onDelete: useCallback(
            (oldRecord: T) => {
                setData((prev) => prev.filter((item) => item.id !== oldRecord.id));
            },
            [setData],
        ),
    });
}
