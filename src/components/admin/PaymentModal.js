"use client";
import { useState, useEffect } from "react";
import { X, Save, Upload, Calendar, Clock, DollarSign, FileText, Wallet, CreditCard, Banknote } from "lucide-react";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, Timestamp, updateDoc, doc, arrayUnion, query, where, getDocs, orderBy, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { notify } from "@/lib/notify";
import { recalculateCustomerBalance } from "@/lib/balanceCalculator";
import { addTreasuryTransaction } from "@/services/treasuryService";
import { getOpenShift } from "@/services/shiftService";

export default function PaymentModal({ isOpen, onClose, invoice, client, onSuccess }) {
    const [amount, setAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [availableInvoices, setAvailableInvoices] = useState([]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'bank'

    useEffect(() => {
        if (isOpen) {
            if (invoice && invoice.id) {
                // Specific Invoice mode
                setAmount('');
                const invoiceRef = invoice.order_number ? `الطلب #${invoice.order_number}` : (invoice.notes || 'الفاتورة');
                setNotes(`تسديد: ${invoiceRef}`);
                setSelectedInvoiceId(invoice.id);
            } else {
                // Generic Payment mode - Fetch available invoices
                setAmount('');
                setNotes('دفعة حساب');
                setSelectedInvoiceId('');

                if (client?.phone) {
                    const fetchInvoices = async () => {
                        try {
                            // 1. Fetch Orders
                            const qOrders = query(
                                collection(db, "order"),
                                where("customer_phone", "==", client.phone),
                                orderBy("created_at", "desc")
                            );

                            // 2. Fetch Manual Invoices (Transactions with type ORDER_PLACED)
                            // We can't easily composite sort with different collections, so we fetch and merge.
                            const qManual = query(
                                collection(db, "transactions"),
                                where("userId", "==", client.id),
                                where("type", "==", "ORDER_PLACED")
                            );

                            const [snapOrders, snapManual] = await Promise.all([getDocs(qOrders), getDocs(qManual)]);

                            const orders = snapOrders.docs.map(d => ({
                                id: d.id,
                                ...d.data(),
                                _isManual: false,
                                _collection: 'order'
                            }));

                            const manualInvoices = snapManual.docs.map(d => ({
                                id: d.id,
                                ...d.data(),
                                _isManual: true,
                                _collection: 'transactions',
                                order_number: 'manual', // Marker
                                order_total: d.data().amount
                            }));

                            // Merge and Sort
                            const allInvoices = [...orders, ...manualInvoices].sort((a, b) => {
                                const tA = a.created_at?.seconds || a.createdAt?.seconds || 0;
                                const tB = b.created_at?.seconds || b.createdAt?.seconds || 0;
                                return tB - tA;
                            });

                            setAvailableInvoices(allInvoices);
                        } catch (err) {
                            console.error("Error fetching invoices:", err);
                        }
                    };
                    fetchInvoices();
                }
            }

            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            setDate(`${yyyy}-${mm}-${dd}`);

            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            setTime(`${hh}:${min}`);

            setImage(null);
            setPreview(null);
            setPaymentMethod('cash');
        }
    }, [isOpen, invoice, client]);

    if (!isOpen || !client || !invoice) return null;

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Reconstruct Date Object
            const [year, month, day] = date.split('-').map(Number);
            const [hours, minutes] = time.split(':').map(Number);
            const newDate = new Date(year, month - 1, day, hours, minutes);
            const newTimestamp = Timestamp.fromDate(newDate);

            // Upload Image
            let imageUrl = null;
            if (image) {
                const storageRef = ref(storage, `payments/${client.id}/${Date.now()}_${image.name}`);
                const snapshot = await uploadBytes(storageRef, image);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const finalAmount = Number(amount);

            // Create Transaction
            // Create Transaction (ONLY if Generic Payment)
            // If linked to an invoice, we rely on the invoice's internal 'payments' array and 'total_paid' field
            // to track this, effectively "hiding" it from the main transaction list as a separate row.
            let paymentDocId = null;

            if (!selectedInvoiceId) {
                const paymentTx = {
                    userId: client.id,
                    amount: finalAmount,
                    type: 'PAYMENT_RECEIVED',
                    description: 'Payment Received',
                    notes: notes.trim(),
                    createdAt: newTimestamp,
                    imageUrl: imageUrl || null,
                    relatedInvoiceId: selectedInvoiceId || null,
                    source: 'manual_payment',
                    paymentMethod // 'cash' or 'bank'
                };

                const docRef = await addDoc(collection(db, "transactions"), paymentTx);
                paymentDocId = docRef.id;
            }

            // Update Linked Invoice (if Order OR Manual Invoice)
            if (selectedInvoiceId) {
                try {
                    let targetCollection = "order"; // Default

                    // Logic to find collection
                    if (invoice && invoice.id === selectedInvoiceId) {
                        // Props mode
                        if (invoice.source === 'tx' || invoice.source === 'manual_payment' || invoice.source === 'manual_invoice' || invoice.source === 'merged' || invoice._collection === 'transactions') targetCollection = "transactions";
                    } else {
                        // Dropdown mode
                        const selectedInv = availableInvoices.find(i => i.id === selectedInvoiceId);
                        if (selectedInv && selectedInv._collection) {
                            targetCollection = selectedInv._collection;
                        }
                    }

                    const docRef = doc(db, targetCollection, selectedInvoiceId);
                    await updateDoc(docRef, {
                        payments: arrayUnion({
                            amount: finalAmount,
                            date: newTimestamp,
                            notes: notes.trim(),
                            imageUrl: imageUrl || null,
                            method: paymentMethod
                        }),
                        total_paid: increment(finalAmount)
                    });
                } catch (err) {
                    console.error("Could not update parent invoice with payment info:", err);
                }
            }

            // Recalculate customer balance
            await recalculateCustomerBalance(client.id);

            // --- AUTO TREASURY ENTRY ---
            // Automatically add to Safe/Bank
            try {
                // Get active shift to link payment
                let activeShiftId = null;
                try {
                    const shift = await getOpenShift();
                    if (shift) activeShiftId = shift.id;
                } catch (e) { console.warn("Could not fetch active shift", e); }

                await addTreasuryTransaction({
                    type: paymentMethod, // 'cash' or 'bank'
                    operation: 'credit',
                    amount: finalAmount,
                    source: 'b2b_payment',
                    destination: paymentMethod === 'cash' ? 'drawer' : 'bank', // Cash payments go to Drawer first!
                    description: `دفع من: ${client.fullName || client.email} (${notes.trim()})`,
                    relatedId: client.id,
                    shiftId: activeShiftId
                });
            } catch (treasuryErr) {
                console.error("Failed to auto-log treasury transaction:", treasuryErr);
                notify.error("تم تسجيل الدفع ولكن فشل تحديث الخزنة تلقائياً");
            }
            // ---------------------------

            notify.success("تم تسجيل الدفع بنجاح");
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error creating payment:", error);
            notify.error("فشل تسجيل الدفع");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-900 px-6 py-5 flex justify-between items-center text-white flex-shrink-0">
                    <div>
                        <h3 className="text-xl font-black flex items-center gap-2">
                            <Wallet className="text-green-400" size={24} /> تسجيل دفع
                        </h3>
                        <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">
                            للمعاملة: {invoice.order_number ? `#${invoice.order_number}` : 'يدوية'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">

                        {/* Invoice Selector (If generic mode) */}
                        {(!invoice?.id && availableInvoices.length > 0) && (
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                                    <FileText size={14} /> ربط بفاتورة (اختياري)
                                </label>
                                <select
                                    value={selectedInvoiceId}
                                    onChange={(e) => {
                                        setSelectedInvoiceId(e.target.value);
                                        const inv = availableInvoices.find(i => i.id === e.target.value);
                                        if (inv) setNotes(`تسديد: الطلب #${inv.order_number}`);
                                    }}
                                    className="w-full p-3 rounded-xl border border-gray-200 bg-slate-50 focus:border-green-500 outline-none font-bold text-sm"
                                >
                                    <option value="">بدون ربط (دفعة عامة)</option>
                                    {availableInvoices.map(inv => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv._isManual ? (
                                                `فاتورة يدوية: ${inv.notes} (${inv.amount} دج)`
                                            ) : (
                                                `طلب #${inv.order_number} - ${new Date(inv.created_at?.seconds * 1000).toLocaleDateString()} (${inv.order_total} دج)`
                                            )}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Amount & Date Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                                    <DollarSign size={14} className="text-green-600" /> المبلغ المدفوع (دج)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full text-2xl font-black text-center bg-green-50 border-2 border-green-100 text-green-700 rounded-2xl py-3 focus:ring-4 focus:ring-green-50 focus:border-green-500 outline-none transition placeholder:text-green-200"
                                    placeholder="0.00"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                                    <Calendar size={14} /> التاريخ
                                </label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-200 bg-white focus:border-green-500 outline-none font-bold text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                                    <Clock size={14} /> الوقت
                                </label>
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-200 bg-white focus:border-green-500 outline-none font-bold text-sm"
                                    required
                                />
                            </div>
                        </div>

                        {/* Payment Method Selector */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                                <Wallet size={14} /> طريقة الدفع (أين ستذهب الأموال؟)
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition ${paymentMethod === 'cash'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                        }`}
                                >
                                    <Banknote size={20} />
                                    نقداً (الخزنة)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('bank')}
                                    className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition ${paymentMethod === 'bank'
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                        }`}
                                >
                                    <CreditCard size={20} />
                                    بنكي (CIB/Barid)
                                </button>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                                <FileText size={14} /> ملاحظات
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="w-full p-3 rounded-xl border border-gray-200 bg-slate-50 focus:border-green-500 outline-none font-bold text-sm resize-none"
                                placeholder="أضف ملاحظات..."
                            />
                        </div>

                        {/* Image Upload */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                                <Upload size={14} /> صورة الوصل (اختياري)
                            </label>
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative overflow-hidden group h-32 bg-slate-50/50">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                />
                                {preview ? (
                                    <div className="relative h-full w-full flex items-center justify-center rounded-xl overflow-hidden">
                                        <img
                                            src={preview}
                                            alt="Preview"
                                            className="h-full w-full object-contain"
                                        />
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setPreview(null);
                                                setImage(null);
                                            }}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 z-20 hover:bg-red-600"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <Upload className="text-slate-300 mb-2" size={24} />
                                        <p className="text-xs font-bold text-slate-500">اختر صورة</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                    <div className="flex-shrink-0 p-6 pt-0">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-2xl font-black text-white bg-green-600 hover:bg-green-700 transition shadow-xl shadow-green-600/20 disabled:opacity-50 flex items-center justify-center gap-2 text-lg active:scale-[0.98]"
                        >
                            {loading ? "جاري الحفظ..." : (
                                <>
                                    <Save size={20} />
                                    تسجيل الدفع
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
