import { openDB } from 'idb';
import { db, storage } from './firebase';
import { collection, addDoc, doc, updateDoc, increment, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { recalculateCustomerBalance } from './balanceCalculator';
import toast from 'react-hot-toast';

const DB_NAME = 'kasaba-offline-db';
const STORE_NAME = 'offline-invoices';

export const initDB = async () => {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        },
    });
};

export const saveOfflineInvoice = async (invoiceData, imageFile) => {
    try {
        const db = await initDB();
        // Convert image file to blob/base64 if needed, but IndexedDB can store Blobs directly.
        // We persist everything needed to recreate the transaction.
        const record = {
            ...invoiceData,
            imageFile: imageFile || null, // Store File object (which is a Blob)
            createdAt: new Date().toISOString(), // Store as string for IDB, convert back later
            status: 'pending'
        };
        await db.add(STORE_NAME, record);
        return true;
    } catch (error) {
        console.error("Error saving offline invoice:", error);
        return false;
    }
};

export const getOfflineInvoices = async () => {
    const db = await initDB();
    return db.getAll(STORE_NAME);
};

export const clearOfflineInvoice = async (id) => {
    const db = await initDB();
    await db.delete(STORE_NAME, id);
};

export const syncOfflineInvoices = async () => {
    const offlineInvoices = await getOfflineInvoices();
    if (offlineInvoices.length === 0) return;

    const toastId = toast.loading(`جاري مزامنة ${offlineInvoices.length} فواتير...`);

    let successCount = 0;
    let failCount = 0;

    for (const invoice of offlineInvoices) {
        try {
            let imageUrl = null;

            // 1. Upload Image if exists
            if (invoice.imageFile) {
                const storageRef = ref(storage, `invoices/${invoice.userId}/${Date.now()}_offline.jpg`);
                const snapshot = await uploadBytes(storageRef, invoice.imageFile);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            // 2. Prepare Firestore Data
            // We need to reconstruct the Timestamp since IDB stored it as string/serialization
            // Note: Use serverTimestamp() for 'now', or specific date?
            // The original logic used: date === today ? serverTimestamp() : Timestamp.fromDate(...)
            // We'll trust the logic passed in or default to serverTimestamp for the sync moment?
            // Better: Use the 'date' field from invoice data.

            const invoiceDate = new Date(invoice.date); // 'YYYY-MM-DD'
            const todayStr = new Date().toISOString().split('T')[0];
            const timestamp = invoice.date === todayStr ? serverTimestamp() : Timestamp.fromDate(invoiceDate);

            const txData = {
                userId: invoice.userId,
                type: 'ORDER_PLACED',
                amount: invoice.amount,
                notes: invoice.notes,
                imageUrl: imageUrl,
                createdAt: timestamp,
                source: 'offline_sync', // Tag as offline synced
                // Add detailed fields if they exist
                ...(invoice.order_items && { order_items: invoice.order_items }),
                ...(invoice.order_total && { order_total: invoice.order_total }),
                ...(invoice.items_count && { items_count: invoice.items_count }),
            };

            await addDoc(collection(db, 'transactions'), txData);

            // 3. Update Client Debt
            const clientRef = doc(db, 'users', invoice.userId);
            await updateDoc(clientRef, {
                currentDebt: increment(invoice.amount),
                totalDebt: increment(invoice.amount),
                lastTransactionDate: timestamp
            });

            // 4. Recalculate
            await recalculateCustomerBalance(invoice.userId);

            // 5. Remove from IDB
            await clearOfflineInvoice(invoice.id);
            successCount++;

        } catch (error) {
            console.error("Sync failed for invoice:", invoice, error);
            failCount++;
        }
    }

    if (successCount > 0) {
        toast.success(`تم مزامنة ${successCount} فواتير بنجاح`, { id: toastId });
    } else if (failCount > 0) {
        toast.error(`فشلت مزامنة ${failCount} فواتير`, { id: toastId });
    } else {
        toast.dismiss(toastId);
    }
};
