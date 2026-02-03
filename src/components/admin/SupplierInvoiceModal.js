import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, Scale, Plus, Trash2, Calculator } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';

import { notify } from '@/lib/notify';
import { addTreasuryTransaction } from "@/services/treasuryService";
import { getOpenShift } from "@/services/shiftService";

export default function SupplierInvoiceModal({ isOpen, onClose, supplier }) {
    // Mode: 'simple' | 'weight'
    const [mode, setMode] = useState('simple');

    // Common State
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'bank'
    const [note, setNote] = useState('');
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [preview, setPreview] = useState(null);

    // Simple Mode State
    const [simpleAmount, setSimpleAmount] = useState('');

    // Weight System State
    // groups: [{ id, batches: [], currentBatch: '', boxCount: 0, boxTare: 0, pricePerKg: 0 }]
    const [groups, setGroups] = useState([
        { id: 1, batches: [], currentBatch: '', boxCount: '', boxTare: '', pricePerKg: '' }
    ]);

    useEffect(() => {
        if (isOpen) {
            // Reset state on open
            setMode('simple');
            setSimpleAmount('');
            setPaidAmount('');
            setNote('');
            setImage(null);
            setPreview(null);
            setGroups([{ id: 1, batches: [], currentBatch: '', boxCount: '', boxTare: '', pricePerKg: '' }]);
            setDate(new Date().toISOString().split('T')[0]);
        }
    }, [isOpen]);

    if (!isOpen || !supplier) return null;

    // --- Weight Logic ---
    const handleAddBatchToGroup = (groupId) => {
        setGroups(prev => prev.map(g => {
            if (g.id === groupId) {
                const val = parseFloat(g.currentBatch);
                if (val > 0) {
                    return { ...g, batches: [...g.batches, val], currentBatch: '' };
                }
            }
            return g;
        }));
    };

    const handleRemoveBatchFromGroup = (groupId, batchIndex) => {
        setGroups(prev => prev.map(g => {
            if (g.id === groupId) {
                const newBatches = [...g.batches];
                newBatches.splice(batchIndex, 1);
                return { ...g, batches: newBatches };
            }
            return g;
        }));
    };

    const updateGroupField = (groupId, field, value) => {
        setGroups(prev => prev.map(g => {
            if (g.id === groupId) return { ...g, [field]: value };
            return g;
        }));
    };

    const addGroup = () => {
        setGroups(prev => [
            ...prev,
            { id: Date.now(), batches: [], currentBatch: '', boxCount: '', boxTare: '', pricePerKg: '' }
        ]);
    };

    const removeGroup = (groupId) => {
        if (groups.length > 1) {
            setGroups(prev => prev.filter(g => g.id !== groupId));
        }
    };

    // Calculations
    const calculateGroupStats = (group) => {
        const grossWeight = group.batches.reduce((a, b) => a + b, 0);
        const totalTare = (Number(group.boxCount) || 0) * (Number(group.boxTare) || 0);
        const netWeight = Math.max(0, grossWeight - totalTare);
        const total = netWeight * (Number(group.pricePerKg) || 0);
        return { grossWeight, netWeight, total };
    };

    const grandTotal = mode === 'simple'
        ? Number(simpleAmount)
        : groups.reduce((acc, g) => acc + calculateGroupStats(g).total, 0);


    // --- Submission ---
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const finalAmount = grandTotal;
        const paid = Number(paidAmount);

        if (!finalAmount || finalAmount <= 0) {
            notify.error("الرجاء التأكد من قيمة الفاتورة");
            return;
        }

        setLoading(true);
        try {
            let imageUrl = null;

            if (image) {
                const storageRef = ref(storage, `suppliers/${supplier.id}/invoices/${Date.now()}_${image.name}`);
                const snapshot = await uploadBytes(storageRef, image);
                imageUrl = await getDownloadURL(snapshot.ref);
            }

            const transactionData = {
                type: 'invoice',
                amount: finalAmount,
                imageUrl: imageUrl,
                note: note || (mode === 'weight' ? 'فاتورة وزن' : 'فاتورة مشتريات'),
                createdAt: date ? Timestamp.fromDate(new Date(date)) : serverTimestamp()
            };

            if (mode === 'weight') {
                transactionData.details = {
                    system: 'weight_multi', // New system tag
                    groups: groups.map(g => ({
                        batches: g.batches,
                        boxCount: Number(g.boxCount),
                        boxTare: Number(g.boxTare),
                        pricePerKg: Number(g.pricePerKg),
                        // Save calculated snapshots too
                        ...calculateGroupStats(g)
                    }))
                };
            }

            // 1. Add Invoice with Payment Info
            if (paid > 0) {
                transactionData.paymentAmount = paid;
                if (!transactionData.note) transactionData.note = 'فاتورة';
                // Append info to note is optional, but let's keep it clean
            }

            await addDoc(collection(db, `suppliers/${supplier.id}/transactions`), transactionData);

            // 2. Update Supplier Debt
            // Debt increases by (InvoiceAmount - PaidAmount)
            const debtChange = finalAmount - paid;

            const supplierRef = doc(db, 'suppliers', supplier.id);
            await updateDoc(supplierRef, {
                debt: increment(debtChange),
                lastTransactionDate: date ? Timestamp.fromDate(new Date(date)) : serverTimestamp()
            });

            // 3. Treasury Transaction (If Paid)
            if (paid > 0) {
                let activeShiftId = null;
                try {
                    const shift = await getOpenShift();
                    if (shift) activeShiftId = shift.id;
                } catch (e) { console.warn("Shift check failed", e); }

                await addTreasuryTransaction({
                    type: paymentMethod,
                    operation: 'debit',
                    amount: paid,
                    source: 'supplier_payment',
                    destination: paymentMethod === 'cash' ? 'drawer' : 'bank',
                    description: `دفعة فورية لفاتورة مورد (${note || 'فاتورة'})`,
                    relatedId: supplier.id,
                    shiftId: activeShiftId
                });
            }

            notify.success(`تم إضافة الفاتورة بنجاح`);
            onClose();
        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ أثناء حفظ الفاتورة");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl relative max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 pb-2 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">تسجيل فاتورة جديدة</h2>
                        <p className="text-sm text-slate-500 font-bold mt-1">للمورد: {supplier.name}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="overflow-y-auto flex-1 p-6 space-y-6">

                    {/* Mode Toggle */}
                    <div className="bg-slate-100 p-1 rounded-2xl flex font-bold text-sm">
                        <button
                            type="button"
                            onClick={() => setMode('simple')}
                            className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${mode === 'simple' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                        >
                            <FileText size={18} /> فاتورة عادية
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('weight')}
                            className={`flex-1 py-3 rounded-xl transition flex items-center justify-center gap-2 ${mode === 'weight' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                        >
                            <Scale size={18} /> نظام الوزن
                        </button>
                    </div>

                    <form id="invoiceForm" onSubmit={handleSubmit} className="space-y-6">

                        {/* Common: Date */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">تاريخ الفاتورة</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-slate-500 outline-none font-bold text-slate-700"
                                required
                            />
                        </div>

                        {/* SIMPLE MODE */}
                        {mode === 'simple' && (
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">إجمالي الفاتورة (دج)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={simpleAmount}
                                        onChange={(e) => setSimpleAmount(e.target.value)}
                                        className="w-full text-3xl font-black text-center bg-slate-50 border-2 border-slate-100 rounded-2xl py-6 focus:ring-4 focus:ring-red-100 focus:border-red-500 outline-none transition"
                                        placeholder="0"
                                        autoFocus
                                    />
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">دج</div>
                                </div>
                            </div>
                        )}

                        {/* WEIGHT SYSTEM MODE */}
                        {mode === 'weight' && (
                            <div className="space-y-6">
                                {groups.map((group, index) => {
                                    const stats = calculateGroupStats(group);
                                    return (
                                        <div key={group.id} className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-5 relative group-card">
                                            {/* Header of Group */}
                                            <div className="flex justify-between items-center mb-4">
                                                <div className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full">
                                                    مجموعة #{index + 1}
                                                </div>
                                                {groups.length > 1 && (
                                                    <button type="button" onClick={() => removeGroup(group.id)} className="text-red-400 hover:text-red-600 p-1">
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-4">
                                                {/* Batches Input */}
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 mb-1 block">الأوزان (ادخال متتابع)</label>
                                                    <div className="flex gap-2 mb-2">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={group.currentBatch}
                                                            onChange={e => updateGroupField(group.id, 'currentBatch', e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddBatchToGroup(group.id); } }}
                                                            className="flex-1 bg-white border border-slate-300 rounded-xl p-3 text-lg font-bold text-center focus:border-blue-500 outline-none"
                                                            placeholder="أدخل الوزن..."
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddBatchToGroup(group.id)}
                                                            className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 active:scale-95 transition"
                                                        >
                                                            <Plus size={24} />
                                                        </button>
                                                    </div>

                                                    {/* Batches List */}
                                                    <div className="flex flex-wrap gap-2 min-h-[40px] bg-white border border-dashed border-slate-300 rounded-xl p-2">
                                                        {group.batches.map((b, i) => (
                                                            <div key={i} onClick={() => handleRemoveBatchFromGroup(group.id, i)} className="bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 border border-slate-200 px-2 py-1 rounded-lg text-sm font-bold cursor-pointer transition flex items-center gap-1">
                                                                {b} <X size={12} />
                                                            </div>
                                                        ))}
                                                        {group.batches.length === 0 && <span className="text-xs text-slate-400 m-auto">لا توجد أوزان مدخلة</span>}
                                                    </div>
                                                    <div className="text-left mt-1 text-xs font-bold text-slate-400">الإجمالي القائم: {stats.grossWeight.toFixed(2)}</div>
                                                </div>

                                                {/* Boxes & Tare */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 mb-1 block">عدد الصناديق</label>
                                                        <input
                                                            type="number"
                                                            value={group.boxCount}
                                                            onChange={e => updateGroupField(group.id, 'boxCount', e.target.value)}
                                                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-center font-bold outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-slate-500 mb-1 block">تارة الصندوق</label>
                                                        <input
                                                            type="number"
                                                            value={group.boxTare}
                                                            onChange={e => updateGroupField(group.id, 'boxTare', e.target.value)}
                                                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-center font-bold outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Price & Result */}
                                                <div>
                                                    <label className="text-xs font-bold text-emerald-600 mb-1 block">سعر الكيلو (DA)</label>
                                                    <input
                                                        type="number"
                                                        value={group.pricePerKg}
                                                        onChange={e => updateGroupField(group.id, 'pricePerKg', e.target.value)}
                                                        className="w-full bg-emerald-50 border_2 border-emerald-100 rounded-xl p-3 text-xl font-black text-center text-emerald-800 outline-none focus:border-emerald-500"
                                                        placeholder="0"
                                                    />
                                                </div>

                                                {/* Group Summary */}
                                                <div className="bg-slate-800 rounded-xl p-3 flex justify-between items-center text-white">
                                                    <div className="text-xs opacity-70">
                                                        صافي: <span className="font-bold text-emerald-300">{stats.netWeight.toFixed(2)} كغ</span>
                                                    </div>
                                                    <div className="font-black text-lg">
                                                        {stats.total.toLocaleString()} <span className="text-xs font-normal opacity-70">دج</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}

                                <button
                                    type="button"
                                    onClick={addGroup}
                                    className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-2xl font-bold hover:bg-slate-50 hover:border-slate-400 transition flex items-center justify-center gap-2"
                                >
                                    <Plus size={20} /> إضافة مجموعة أوزان أخرى (سعر مختلف)
                                </button>
                            </div>
                        )}

                        {/* Grand Total Display */}
                        <div className="bg-slate-100 p-5 rounded-3xl text-center space-y-1">
                            <p className="text-slate-500 font-bold text-sm">الإجمالي النهائي للفاتورة</p>
                            <h3 className="text-4xl font-black text-slate-900">{grandTotal.toLocaleString()} <span className="text-lg text-slate-500">دج</span></h3>
                        </div>

                        {/* Payment & Notes */}
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div>
                                <label className="block text-sm font-bold text-emerald-700 mb-2">المدفوع حالاً (اختياري)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(e.target.value)}
                                        className="w-full text-xl font-black text-center bg-emerald-50 border-2 border-emerald-100 rounded-2xl py-3 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition text-emerald-700"
                                        placeholder="0"
                                    />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-sm">دج</div>
                                </div>
                            </div>

                            {/* Payment Method Selector (Only if amount entered) */}
                            {paidAmount && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('cash')}
                                        className={`p-2 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition text-xs ${paymentMethod === 'cash'
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        نقداً (الخزنة)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentMethod('bank')}
                                        className={`p-2 rounded-xl border-2 flex items-center justify-center gap-2 font-bold transition text-xs ${paymentMethod === 'bank'
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'
                                            }`}
                                    >
                                        بنكي
                                    </button>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">ملاحظة</label>
                                <input
                                    type="text"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-red-500 outline-none font-bold"
                                    placeholder="ملاحظات..."
                                />
                            </div>

                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">صورة الفاتورة (اختياري)</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative overflow-hidden group">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    />
                                    {preview ? (
                                        <div className="relative h-24 w-full flex items-center justify-center bg-slate-900 rounded-xl overflow-hidden">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={preview} alt="Preview" className="h-full object-contain" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                <p className="text-white font-bold text-xs flex items-center gap-2"><Upload size={14} /> تغيير</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-2 text-slate-400">
                                            <Upload className="mx-auto mb-1" size={20} />
                                            <p className="text-[10px] font-bold">صورة المرفق</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-gray-100 bg-white rounded-b-[32px]">
                    <button
                        type="submit"
                        disabled={loading}
                        form="invoiceForm"
                        className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-slate-900/10 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? "جاري الحفظ..." : "حفظ الفاتورة"}
                    </button>
                </div>
            </div>
        </div>
    );
}
