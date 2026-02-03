"use client";
import { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { notify } from "@/lib/notify";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

export default function ClientModal({ isOpen, onClose, clientToEdit }) {
    useLockBodyScroll(isOpen);
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        location: "",
        isCreditAllowed: false,
        creditLimit: 0,
        priceTier: "standard",
        password: "",
        role: "restaurant", // Default
        status: "active"
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (clientToEdit) {
            setFormData({
                name: clientToEdit.firstName || clientToEdit.fullName || "",
                phone: clientToEdit.phone || "",
                location: clientToEdit.location || "",
                isCreditAllowed: clientToEdit.isCreditAllowed || false,
                creditLimit: clientToEdit.creditLimit || 0,
                priceTier: clientToEdit.priceTier || "standard",
                freeDeliveriesPerDay: clientToEdit.freeDeliveriesPerDay || 1,
                password: "",
                role: clientToEdit.role || "restaurant",
                status: clientToEdit.status || "active"
            });
        } else {
            setFormData({
                name: "",
                phone: "",
                location: "",
                isCreditAllowed: false,
                creditLimit: 0,
                priceTier: "standard",
                freeDeliveriesPerDay: 1,
                password: "",
                role: "restaurant",
                status: "active"
            });
        }
    }, [clientToEdit, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let userId;
            const isOffline = !formData.phone.trim();

            if (clientToEdit) {
                userId = clientToEdit.id;
            } else if (isOffline) {
                userId = `offline_${Date.now()}`;
            } else {
                userId = formData.phone.trim();
            }

            const docRef = doc(db, "users", userId);

            const userData = {
                fullName: formData.name.trim(),
                phone: formData.phone.trim(),
                location: formData.location,
                isCreditAllowed: formData.isCreditAllowed,
                creditLimit: Number(formData.creditLimit),
                priceTier: formData.priceTier,
                role: formData.role, // Use selected role
                currentDebt: 0,
                freeDeliveriesPerDay: formData.freeDeliveriesPerDay || 1,
                status: formData.status,
                isOffline: isOffline
            };

            if (!clientToEdit) {
                // Check if exists ONLY for standard users (with phone)
                if (!isOffline) {
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        notify.error("رقم الهاتف مسجل بالفعل");
                        setLoading(false);
                        return;
                    }
                }

                // New User Password Logic
                if (!formData.password && !isOffline) {
                    notify.error("يرجى تعيين كلمة مرور");
                    setLoading(false);
                    return;
                }

                // Set password (default for offline if empty)
                userData.password = formData.password || "offline_user";
                userData.createdAt = serverTimestamp();
                userData.currentDebt = 0;

                await setDoc(docRef, userData);
                notify.success(isOffline ? "تم إضافة الحساب الداخلي" : "تم إضافة العميل بنجاح");
            } else {
                // Update
                if (formData.password && formData.password.trim()) {
                    userData.password = formData.password.trim();
                }
                // Don't overwrite isOffline on edit usually, but safe to re-assert if phone is empty
                userData.isOffline = isOffline;

                await updateDoc(docRef, userData);
                notify.success("تم تحديث البيانات");
            }

            onClose();
        } catch (error) {
            console.error(error);
            notify.error("حدث خطأ ما");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-fade-up overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-black text-xl text-gray-800">
                        {clientToEdit ? "تعديل بيانات العميل" : "إضافة عميل (B2B) جديد"}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* Basic Info */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-500">بيانات أساسية</label>

                        {/* Type Selection */}
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            <button type="button" onClick={() => setFormData({ ...formData, role: 'restaurant' })} className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${formData.role === 'restaurant' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                                مطعم (B2B)
                            </button>
                            <button type="button" onClick={() => setFormData({ ...formData, role: 'individual' })} className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${formData.role === 'individual' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-transparent text-gray-400'}`}>
                                زبون عادي
                            </button>
                        </div>

                        <input required placeholder="الاسم الكامل" className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-red-500 outline-none transition font-bold"
                            value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <input type="tel" placeholder="رقم الهاتف (اتركه فارغاً للحساب الداخلي)" className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-red-500 outline-none transition font-bold"
                                value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} disabled={!!clientToEdit}
                            />
                            <input placeholder={clientToEdit ? "كلمة المرور (اتركها فارغة للإبقاء على الحالية)" : "كلمة المرور (اختياري للحساب الداخلي)"} className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-red-500 outline-none transition font-bold"
                                value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                        <input placeholder="العنوان / المنطقة" className="w-full p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-red-500 outline-none transition font-bold"
                            value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })}
                        />
                    </div>

                    <hr className="border-dashed" />

                    {/* Financial Sittings */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-500 flex items-center gap-2">
                            الإعدادات المالية <AlertCircle size={14} />
                        </label>

                        <div className="flex items-center gap-4 bg-orange-50 p-4 rounded-xl border border-orange-100">
                            <input type="checkbox" id="credit" className="w-5 h-5 accent-red-600"
                                checked={formData.isCreditAllowed} onChange={e => setFormData({ ...formData, isCreditAllowed: e.target.checked })}
                            />
                            <label htmlFor="credit" className="font-bold text-gray-800 text-sm">السماح بالدفع الآجل (الكريدي)</label>
                        </div>

                        {formData.isCreditAllowed && (
                            <div className="animate-fade-in">
                                <label className="text-xs font-bold text-slate-400 mb-1 block">سقف الدين المسموح (دج)</label>
                                <input type="number" className="w-full p-3 bg-white border-2 border-orange-200 rounded-xl font-black text-lg focus:border-orange-500 outline-none"
                                    value={formData.creditLimit} onChange={e => setFormData({ ...formData, creditLimit: e.target.value })}
                                />
                            </div>
                        )}

                        <label className="text-xs font-bold text-slate-400 mb-1 block">شريحة الأسعار</label>
                        <select className="w-full p-3 bg-gray-50 rounded-xl font-bold outline-none"
                            value={formData.priceTier} onChange={e => setFormData({ ...formData, priceTier: e.target.value })}
                        >
                            <option value="standard">Standard (سعر عادي)</option>
                            <option value="vip">VIP (سعر خاص)</option>
                            <option value="wholesale">Wholesale (جملة)</option>
                        </select>
                    </div>

                    <div className="animate-fade-in pt-2">
                        <label className="text-xs font-bold text-slate-400 mb-1 block">عدد التوصيلات المجانية يومياً (الافتراضي 1)</label>
                        <input type="number" className="w-full p-3 bg-gray-50 rounded-xl font-bold border-2 border-transparent focus:border-red-500 outline-none"
                            value={formData.freeDeliveriesPerDay || 1} onChange={e => setFormData({ ...formData, freeDeliveriesPerDay: Number(e.target.value) })}
                        />
                    </div>

                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center justify-between">
                        <div>
                            <span className="block font-bold text-red-800 text-sm">تجميد الحساب (أرشيف الديون)</span>
                            <span className="text-[10px] text-red-600 font-bold block mt-1">
                                عند التفعيل، سيختفي العميل من القائمة النشطة وينقل للأرشيف.
                            </span>
                        </div>
                        <div className="relative inline-block w-12 h-6 align-middle select-none transition duration-200 ease-in">
                            <input
                                type="checkbox"
                                name="toggle"
                                id="status_toggle"
                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-6"
                                checked={formData.status === 'archived'}
                                onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'archived' : 'active' })}
                            />
                            <label htmlFor="status_toggle" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${formData.status === 'archived' ? 'bg-red-500' : 'bg-gray-300'}`}></label>
                        </div>
                    </div>



                    <button disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2">
                        {loading ? "جاري الحفظ..." : <><Save size={20} /> حفظ البيانات</>}
                    </button>
                </form>
            </div >
        </div >
    );
}
