"use client";
import { useState, useEffect, useRef } from 'react';
import { X, Save, Edit, Plus, Trash2, RefreshCw, Scale, Hash, Calculator, Upload } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, increment, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { notify } from '@/lib/notify';

export default function EditTransactionModal({ isOpen, onClose, supplier, transaction }) {
    const [loading, setLoading] = useState(false);
    const [system, setSystem] = useState('invoice'); // 'invoice' | 'weight'

    // Date State
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');

    // Image State
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);

    // Invoice State
    const [amount, setAmount] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [note, setNote] = useState('');

    // Weight System State (Unify both weight and weight_multi into groups)
    const [groups, setGroups] = useState([]);

    // Legacy support or fallback
    const [grossWeight, setGrossWeight] = useState(0);



    useEffect(() => {
        if (transaction) {
            setNote(transaction.note || '');
            setImage(null);
            setPreview(null);

            const sys = transaction.details?.system;
            if (sys === 'weight' || sys === 'weight_multi') {
                setSystem('weight'); // UI treats both as "Weight Mode"

                if (sys === 'weight_multi') {
                    // Load existing groups
                    // Ensure mutable copies
                    setGroups(transaction.details.groups.map((g, i) => ({
                        id: i,
                        batches: [...(g.batches || [])],
                        currentBatch: '',
                        boxCount: g.boxCount,
                        boxTare: g.boxTare,
                        pricePerKg: g.pricePerKg
                    })));
                } else {
                    // Legacy 'weight' -> Convert to single group
                    const d = transaction.details;
                    setGroups([{
                        id: 0,
                        batches: d.batches || (d.grossWeight ? [d.grossWeight] : []),
                        currentBatch: '',
                        boxCount: d.boxCount || 0,
                        boxTare: d.boxTare || 0,
                        pricePerKg: d.pricePerKg || 0
                    }]);
                }
                setAmount(transaction.amount);
            } else {
                setSystem('invoice');
                setAmount(transaction.amount);
                setPaymentAmount(transaction.paymentAmount || 0);
            }

            // Handle Date
            const txDate = transaction.createdAt?.toDate ? transaction.createdAt.toDate() :
                (transaction.created_at?.toDate ? transaction.created_at.toDate() : new Date());

            const yyyy = txDate.getFullYear();
            const mm = String(txDate.getMonth() + 1).padStart(2, '0');
            const dd = String(txDate.getDate()).padStart(2, '0');
            setDate(`${yyyy}-${mm}-${dd}`);

            const hh = String(txDate.getHours()).padStart(2, '0');
            const min = String(txDate.getMinutes()).padStart(2, '0');
            setTime(`${hh}:${min}`);
        }
    }, [transaction, isOpen]);

    // Helpers for Groups
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

    const calculateGroupStats = (group) => {
        const gross = group.batches.reduce((a, b) => a + b, 0);
        const totalTare = (Number(group.boxCount) || 0) * (Number(group.boxTare) || 0);
        const net = Math.max(0, gross - totalTare);
        const total = net * (Number(group.pricePerKg) || 0);
        return { gross, net, total };
    };

    // Auto-Calculate Total Amount
    useEffect(() => {
        if (system === 'weight') {
            const grandTotal = groups.reduce((acc, g) => acc + calculateGroupStats(g).total, 0);
            setAmount(grandTotal);
        }
    }, [groups, system]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newAmount = Number(amount);

        if (!newAmount || newAmount < 0) {
            notify.error("الرجاء التأكد من القيم");
            return;
        }

        setLoading(true);
        try {
            let finalImageUrl = transaction.imageUrl;

            if (image) {
                const storageRef = ref(storage, `receipts/${Date.now()}_${image.name}`);
                const snapshot = await uploadBytes(storageRef, image);
                finalImageUrl = await getDownloadURL(snapshot.ref);
            }

            let transactionRef;
            if (supplier) {
                transactionRef = doc(db, `suppliers/${supplier.id}/transactions`, transaction.id);
            } else {
                transactionRef = doc(db, "transactions", transaction.id);
            }

            // Reconstruct Date Object
            const [year, month, day] = date.split('-').map(Number);
            const [hours, minutes] = time.split(':').map(Number);
            const newDate = new Date(year, month - 1, day, hours, minutes);
            const newTimestamp = Timestamp.fromDate(newDate);

            const updateData = {
                amount: newAmount,
                note: note,
                imageUrl: finalImageUrl || null,
                createdAt: newTimestamp,
                updatedAt: serverTimestamp()
            };

            if (system === 'weight') {
                updateData.details = {
                    system: 'weight_multi',
                    groups: groups.map(g => ({
                        batches: g.batches,
                        boxCount: Number(g.boxCount),
                        boxTare: Number(g.boxTare),
                        pricePerKg: Number(g.pricePerKg),
                        ...calculateGroupStats(g)
                    }))
                };
            } else {
                if (paymentAmount) updateData.paymentAmount = Number(paymentAmount);
            }

            await updateDoc(transactionRef, updateData);

            // --- CRITICAL: Update Supplier Debt automatically ---
            if (supplier) {
                const oldAmount = transaction.amount || 0;
                const oldPayment = transaction.paymentAmount || 0;
                const newAmountVal = newAmount || 0;
                const newPaymentVal = Number(paymentAmount) || 0;
                const type = transaction.type;

                let debtChange = 0;

                // Calculate Net Debt Effect of OLD transaction
                let oldEffect = 0;
                if (type === 'invoice') oldEffect = oldAmount - oldPayment; // Increases debt
                else if (type === 'payment') oldEffect = -oldAmount; // Decreases debt
                else if (type === 'old_debt' || type === 'opening_balance') oldEffect = oldAmount; // Increases debt

                // Calculate Net Debt Effect of NEW transaction
                let newEffect = 0;
                if (type === 'invoice') newEffect = newAmountVal - newPaymentVal;
                else if (type === 'payment') newEffect = -newAmountVal;
                else if (type === 'old_debt' || type === 'opening_balance') newEffect = newAmountVal;

                // The change needed is (New - Old)
                debtChange = newEffect - oldEffect;

                if (debtChange !== 0) {
                    const supplierRef = doc(db, 'suppliers', supplier.id);
                    await updateDoc(supplierRef, {
                        debt: increment(debtChange),
                        lastTransactionDate: serverTimestamp()
                    });
                }
            }

            notify.success("تم التعديل بنجاح");
            onClose();
        } catch (error) {
            console.error(error);
            if (error.message && error.message.includes("No document to update")) {
                notify.error("العملية المحددة لم تعد موجودة. الرجاء تحديث الصفحة.");
            } else {
                notify.error("فشل التعديل");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !transaction) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>

                <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                    <Edit className="text-blue-600" /> تعديل العملية
                    {system === 'weight' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">نظام الوزن</span>}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">التاريخ</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-sm outline-none focus:border-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">الوقت</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-sm outline-none focus:border-blue-500"
                                required
                            />
                        </div>
                    </div>

                    {system === 'weight' ? (
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
                                                <div className="text-left mt-1 text-xs font-bold text-slate-400">الإجمالي القائم: {stats.gross.toFixed(2)}</div>
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
                                                    صافي: <span className="font-bold text-emerald-300">{stats.net.toFixed(2)} كغ</span>
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
                                <Plus size={20} /> إضافة مجموعة أوزان أخرى
                            </button>

                            {/* Grand Total Display */}
                            <div className="bg-slate-900 p-5 rounded-3xl text-center space-y-1 text-white shadow-lg">
                                <p className="text-slate-400 font-bold text-sm">الإجمالي النهائي للفاتورة</p>
                                <h3 className="text-4xl font-black">{Number(amount).toLocaleString()} <span className="text-lg text-slate-500">دج</span></h3>
                            </div>
                        </div>
                    ) : (
                        // Normal Invoice Edit
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">
                                    {transaction.type === 'invoice' ? 'قيمة الفاتورة الكلية' : 'قيمة الدفعة'}
                                </label>
                                <input
                                    type="number"
                                    className="w-full text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-blue-500"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                />
                            </div>

                            {transaction.type === 'invoice' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">المبلغ المدفوع منها</label>
                                    <input
                                        type="number"
                                        className="w-full text-xl font-bold bg-emerald-50 border border-emerald-200 rounded-xl p-3 focus:outline-none focus:border-emerald-500 text-emerald-700"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظة</label>
                                <input
                                    type="text"
                                    className="w-full text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-blue-500"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </div>

                            {/* Image Edit Section */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2">صورة الفاتورة / الوصل</label>
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative overflow-hidden group">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    />
                                    {preview || transaction.imageUrl ? (
                                        <div className="relative h-40 w-full flex items-center justify-center bg-slate-900 rounded-xl overflow-hidden">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={preview || transaction.imageUrl} alt="Preview" className="h-full object-contain" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                <p className="text-white font-bold text-sm flex items-center gap-2"><Upload size={16} /> تغيير الصورة</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-slate-400">
                                            <Upload className="mx-auto mb-2" size={24} />
                                            <p className="text-xs font-bold">اضغط لإرفاق صورة</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition flex justify-center items-center gap-2"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : <><Save size={20} /> حفظ التعديلات</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
