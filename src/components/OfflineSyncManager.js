"use client";
import { useEffect } from 'react';
import { syncOfflineInvoices } from '@/lib/offlineSync';
import { notify } from '@/lib/notify';

export default function OfflineSyncManager() {
    useEffect(() => {
        // Sync on mount (if online)
        if (navigator.onLine) {
            syncOfflineInvoices();
        }

        const handleOnline = () => {
            // notify.info("تم استعادة الاتصال. جاري المزامنة...");
            syncOfflineInvoices();
        };

        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('online', handleOnline);
        };
    }, []);

    return null; // Headless component
}
