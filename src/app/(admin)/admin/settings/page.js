"use client";
import { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Trash2, Plus, Save, MapPin, Image as ImageIcon, Tag, Loader2, ToggleLeft, ToggleRight, BarChart } from "lucide-react";
import { notify } from "@/lib/notify";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("zones"); // zones | banners | promos | pixels

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">إعدادات المتجر والتسويق</h1>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b border-gray-200 pb-1 overflow-x-auto">
        <TabButton id="zones" label="مناطق التوصيل" icon={<MapPin size={18} />} active={activeTab} onClick={setActiveTab} />
        <TabButton id="banners" label="بانرات العروض" icon={<ImageIcon size={18} />} active={activeTab} onClick={setActiveTab} />
        <TabButton id="promos" label="كوبونات الخصم" icon={<Tag size={18} />} active={activeTab} onClick={setActiveTab} />
        <TabButton id="pixels" label="أكواد التتبع" icon={<BarChart size={18} />} active={activeTab} onClick={setActiveTab} />
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm min-h-[400px] p-6">
        {activeTab === "zones" && <ZonesManager />}
        {activeTab === "banners" && <BannersManager />}
        {activeTab === "promos" && <PromosManager />}
        {activeTab === "pixels" && <PixelsManager />}
      </div>
    </div>
  );
}

// ... (ZonesManager, BannersManager, PromosManager remain unchanged) ...

// 4. مدير أكواد التتبع (بكسل)


function PixelsManager() {
  const [settings, setSettings] = useState({ facebook_pixel_id: "", tiktok_pixel_id: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch current settings
    // Assuming single doc 'pixels' in 'store_settings' collection
    // Or we can use a simpler approach if 'store_settings' is not established.
    // Let's us 'store_settings' collection, doc 'general' or 'pixels'.
    // Plan said: Firestore `store_settings` collection, document `pixels`.
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "store_settings", "pixels");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, "store_settings", "pixels"), settings, { merge: true });
      notify.success("تم الحفظ بنجاح");
    } catch (e) {
      notify.error("حدث خطأ");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><BarChart className="text-purple-600" /> أكواد التتبع (Pixel)</h2>
      <p className="text-gray-500 text-sm mb-8">أضف معرفات البيكسل الخاصة بمنصات الإعلانات لتتبع الزوار والأحداث.</p>

      <form onSubmit={handleSave} className="max-w-lg space-y-6">

        {/* Facebook */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <label className="block text-sm font-bold text-blue-900 mb-2">Facebook Pixel ID</label>
          <input
            type="text"
            dir="ltr"
            placeholder="Example: 123456789012345"
            className="w-full p-3 rounded-lg border border-blue-200 outline-none focus:ring-2 focus:ring-blue-500"
            value={settings.facebook_pixel_id || ""}
            onChange={e => setSettings({ ...settings, facebook_pixel_id: e.target.value })}
          />
        </div>

        {/* TikTok */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <label className="block text-sm font-bold text-gray-900 mb-2">TikTok Pixel ID</label>
          <input
            type="text"
            dir="ltr"
            placeholder="Example: C1234567890ABCDE"
            className="w-full p-3 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-black"
            value={settings.tiktok_pixel_id || ""}
            onChange={e => setSettings({ ...settings, tiktok_pixel_id: e.target.value })}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-black transition flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
          <span>حفظ الإعدادات</span>
        </button>
      </form>
    </div>
  );
}

// زر التبويب
function TabButton({ id, label, icon, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-5 py-3 rounded-t-xl font-bold transition-all border-b-2 
        ${active === id
          ? "border-red-600 text-red-600 bg-red-50"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
    >
      {icon} {label}
    </button>
  );
}

// --- مكونات فرعية للأقسام ---

// 1. مدير مناطق التوصيل
function ZonesManager() {
  const [zones, setZones] = useState([]);
  const [newZone, setNewZone] = useState({ zone_name: "", price: "" });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "delivery_zone"), (snap) => {
      setZones(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newZone.zone_name || !newZone.price) return;
    await addDoc(collection(db, "delivery_zone"), {
      zone_name: newZone.zone_name,
      price: Number(newZone.price)
    });
    setNewZone({ zone_name: "", price: "" });
  };

  const handleDelete = async (id) => {
    if (await notify.confirm("حذف هذه المنطقة؟")) await deleteDoc(doc(db, "delivery_zone", id));
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin className="text-red-600" /> إدارة مناطق التوصيل</h2>
      <p className="text-gray-500 text-sm mb-6">هذه المناطق ستظهر للزبون في القائمة المنسدلة عند الطلب.</p>

      {/* Form */}
      <form onSubmit={handleAdd} className="flex gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-500 mb-1">اسم المنطقة</label>
          <input type="text" placeholder="مثال: بومرداس وسط" className="w-full p-2 rounded-lg border text-gray-900"
            value={newZone.zone_name} onChange={e => setNewZone({ ...newZone, zone_name: e.target.value })} />
        </div>
        <div className="w-32">
          <label className="block text-xs font-bold text-gray-500 mb-1">السعر (دج)</label>
          <input type="number" placeholder="150" className="w-full p-2 rounded-lg border text-gray-900"
            value={newZone.price} onChange={e => setNewZone({ ...newZone, price: e.target.value })} />
        </div>
        <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 h-[42px]">إضافة</button>
      </form>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {zones.map(z => (
          <div key={z.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50">
            <div>
              <div className="font-bold text-gray-800">{z.zone_name}</div>
              <div className="text-sm text-green-600 font-bold">{z.price} دج</div>
            </div>
            <button onClick={() => handleDelete(z.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// 2. مدير البانرات
function BannersManager() {
  const [banners, setBanners] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [bannerLink, setBannerLink] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "banner"), (snap) => {
      setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `banners/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "banner"), {
        banner_url: url,
        link: bannerLink || "", // Save the link
        created_at: serverTimestamp()
      });
      setBannerLink(""); // Reset
    } catch (error) {
      notify.error("فشل الرفع");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id, url) => {
    if (await notify.confirm("حذف هذا البانر؟")) {
      await deleteDoc(doc(db, "banner", id));
      // يمكن حذف الصورة من Storage أيضاً إذا أردت
    }
  };

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><ImageIcon className="text-blue-600" /> بانرات العروض</h2>
          <p className="text-gray-500 text-sm">ارفع صوراً جذابة (يفضل مقاس عرضي 900x300) لتظهر في واجهة المتجر.</p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="رابط (اختياري) /product/123"
            className="border p-2 rounded-xl text-sm w-60 text-right"
            value={bannerLink}
            onChange={(e) => setBannerLink(e.target.value)}
          />
          <label className={`bg-blue-600 text-white px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-blue-700 transition flex items-center gap-2 ${uploading ? 'opacity-50' : ''}`}>
            {uploading ? <Loader2 className="animate-spin" /> : <Plus size={18} />}
            <span>{uploading ? "جاري الرفع..." : "رفع بانر"}</span>
            <input type="file" hidden accept="image/*" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {banners.map(b => (
          <div key={b.id} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm aspect-[3/1]">
            <img src={b.banner_url} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <button onClick={() => handleDelete(b.id, b.banner_url)} className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700">
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. مدير الكوبونات
function PromosManager() {
  const [promos, setPromos] = useState([]);
  const [newPromo, setNewPromo] = useState({ code: "", discount: "", limit: "100" });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "discount"), (snap) => {
      setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newPromo.code || !newPromo.discount) return;
    await addDoc(collection(db, "discount"), {
      discount_code: newPromo.code.toUpperCase(),
      discount_percentage: Number(newPromo.discount),
      usage_limit: Number(newPromo.limit),
      times_used: 0,
      product_id: "all", // حالياً للكل، يمكن تطويره
      created_at: serverTimestamp()
    });
    setNewPromo({ code: "", discount: "", limit: "100" });
  };

  const handleDelete = async (id) => {
    if (await notify.confirm("إيقاف هذا الكود نهائياً؟")) await deleteDoc(doc(db, "discount", id));
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Tag className="text-green-600" /> أكواد الخصم</h2>

      <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-500 mb-1">الكود (مثلاً SALE20)</label>
          <input type="text" placeholder="RAMADAN" className="w-full p-2 rounded-lg border text-gray-900 uppercase"
            value={newPromo.code} onChange={e => setNewPromo({ ...newPromo, code: e.target.value })} />
        </div>
        <div className="w-full md:w-32">
          <label className="block text-xs font-bold text-gray-500 mb-1">نسبة الخصم %</label>
          <input type="number" placeholder="20" className="w-full p-2 rounded-lg border text-gray-900"
            value={newPromo.discount} onChange={e => setNewPromo({ ...newPromo, discount: e.target.value })} />
        </div>
        <div className="w-full md:w-32">
          <label className="block text-xs font-bold text-gray-500 mb-1">حد الاستخدام</label>
          <input type="number" placeholder="100" className="w-full p-2 rounded-lg border text-gray-900"
            value={newPromo.limit} onChange={e => setNewPromo({ ...newPromo, limit: e.target.value })} />
        </div>
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 h-[42px] w-full md:w-auto">إنشاء</button>
      </form>

      <div className="space-y-3">
        {promos.map(p => (
          <div key={p.id} className="flex justify-between items-center p-4 border rounded-xl hover:bg-gray-50">
            <div>
              <div className="font-black text-xl text-gray-800 tracking-wider">{p.discount_code}</div>
              <div className="text-sm text-gray-500">
                خصم <span className="text-green-600 font-bold">{p.discount_percentage}%</span> •
                استخدم {p.times_used} من أصل {p.usage_limit} مرة
              </div>
            </div>
            <button onClick={() => handleDelete(p.id)} className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100"><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

