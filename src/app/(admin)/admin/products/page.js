"use client";
import { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  Plus, Edit, Trash2, Search, Image as ImageIcon, Save, X, UploadCloud, Loader2,
  LayoutGrid, List, Filter, TrendingUp, AlertCircle, Package, DollarSign, ChefHat, Folder, Users, CheckCircle2, Share2, Link as LinkIcon
} from "lucide-react";
import { notify } from "@/lib/notify";
import { CONFIG } from "@/config";

import { useAdminData } from "@/context/AdminDataContext";

export default function ProductManager() {
  const { products, categories, templates, restaurants, loading, suppliers } = useAdminData();
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'

  // Categories State
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("الكل");
  const [statusFilter, setStatusFilter] = useState("الكل"); // 'الكل' | 'منخفض' | 'نفذت'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("basic"); // 'basic' | 'pricing' | 'customization'

  // Image Upload State
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState("");

  const initialForm = {
    title: "",
    barcode: "",
    price: "",
    category: "",
    costPrice: "",
    stock: "100",
    img: "",
    is_pos_only: false,
    customizationGroups: [],
    bundles: [],
    isB2bVisible: false,
    visibleToRestaurants: [], // Array of restaurant IDs
    restaurantPricing: {}, // Map { restaurantId: price }
    isLandingPage: false,
    showInStore: true, // Default to true
    pricingTiers: { vip: "", wholesale: "" },
    supplierId: "",
    alternativeSupplierIds: []
  };
  const [formData, setFormData] = useState(initialForm);

  // --- No Local Fetching Needed ---

  // --- Logic Helpers ---
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      let finalImageUrl = formData.img;
      if (imageFile) {
        const storageRef = ref(storage, `products/${Date.now()}_${imageFile.name}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(snapshot.ref);
      }

      const productData = {
        ...formData,
        img: finalImageUrl,
        price: Number(formData.price),
        costPrice: Number(formData.costPrice),
        stock: Number(formData.stock),
        updated_at: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, "product", editingId), productData);
      } else {
        await addDoc(collection(db, "product"), { ...productData, created_at: serverTimestamp() });
      }
      closeModal();
    } catch (error) {
      notify.error("Error: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (await notify.confirm("حذف المنتج نهائياً؟")) await deleteDoc(doc(db, "product", id));
  };

  const handleShareProduct = (id) => {
    const link = `${window.location.origin}/product/${id}`;
    navigator.clipboard.writeText(link);
    notify.success("تم نسخ رابط المنتج");
  };

  // --- Category Logic ---
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, "categories"), {
        name: newCategoryName,
        created_at: serverTimestamp()
      });
      setNewCategoryName("");
    } catch (error) {
      console.error(error);
      notify.error("فشل إضافة التصنيف");
    }
  };

  const handleDeleteCategory = async (id) => {
    if (await notify.confirm("حذف هذا التصنيف؟", "لن يتم حذف المنتجات المرتبطة به ولكن ستظهر بدون تصنيف.")) {
      await deleteDoc(doc(db, "categories", id));
    }
  };

  const saveAsTemplate = async (group) => {
    if (!group.title || group.options.length === 0) return notify.error("المجموعة فارغة!");
    const name = await notify.prompt("اسم القالب:", group.title);
    if (!name) return;
    await addDoc(collection(db, "customization_templates"), {
      title: name, groupTitle: group.title, options: group.options, required: group.required,
      created_at: serverTimestamp()
    });
    notify.success("تم حفظ القالب");
  };

  const openAddModal = () => {
    setFormData({ ...initialForm, category: categories[0]?.name || "" });
    setEditingId(null);
    setImageFile(null);
    setImagePreview("");
    setActiveTab("basic");
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setFormData({ ...initialForm, ...product });
    setEditingId(product.id);
    setImageFile(null);
    setImagePreview(product.img);
    setActiveTab("basic");
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setUploading(false); };

  // --- Filtering ---
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "الكل" || p.category === categoryFilter;
    let matchesStatus = true;
    if (statusFilter === "منخفض") matchesStatus = p.stock > 0 && p.stock <= 5;
    if (statusFilter === "نفذت") matchesStatus = p.stock <= 0;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // --- Stats Calculation ---
  const totalValue = products.reduce((acc, curr) => acc + (curr.price * curr.stock), 0);
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 5).length;

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-red-600" size={40} /></div>;

  return (
    <div className="space-y-6">

      {/* 1. Dashboard Stats */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false ? 'lg:grid-cols-3' : ''} gap-4`}>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Package size={24} /></div>
          <div>
            <p className="text-sm font-bold text-slate-400">إجمالي المنتجات</p>
            <p className="text-2xl font-black text-slate-800">{products.length}</p>
          </div>
        </div>

        {CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false && (
          <>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="bg-red-50 p-3 rounded-xl text-red-600"><AlertCircle size={24} /></div>
              <div>
                <p className="text-sm font-bold text-slate-400">تنبيهات المخزون</p>
                <p className="text-2xl font-black text-slate-800">{lowStockCount} <span className="text-xs font-medium text-slate-400">منخفض</span></p>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="bg-green-50 p-3 rounded-xl text-green-600"><DollarSign size={24} /></div>
              <div>
                <p className="text-sm font-bold text-slate-400">قيمة المخزون</p>
                <p className="text-2xl font-black text-slate-800">{totalValue.toLocaleString()} دج</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2. Controls Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center sticky top-4 z-20">

        {/* Search & Filters */}
        <div className="flex flex-1 gap-3 w-full md:w-auto">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="ابحث..."
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="bg-slate-50 border rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none hover:bg-slate-100 cursor-pointer"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="الكل">كل التصنيفات</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>

          {CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false && (
            <select
              className="bg-slate-50 border rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none hover:bg-slate-100 cursor-pointer"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="الكل">الحالة: الكل</option>
              <option value="منخفض">مخزون منخفض</option>
              <option value="نفذت">نفذت الكمية</option>
            </select>
          )}
        </div>

        {/* Actions & View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-900 transition"
          >
            <Folder size={18} /> التصنيفات
          </button>

          <div className="bg-slate-100 p-1 rounded-lg flex">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-md transition ${viewMode === "grid" ? "bg-white shadow text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-md transition ${viewMode === "table" ? "bg-white shadow text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
            >
              <List size={18} />
            </button>
          </div>
          <button
            onClick={openAddModal}
            className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition shadow-lg shadow-red-600/20"
          >
            <Plus size={20} /> <span className="hidden md:inline">منتج جديد</span>
          </button>
        </div>
      </div>

      {/* 3. Content Area */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-lg transition">
              <div className="h-44 bg-slate-100 relative overflow-hidden">
                <img
                  src={product.img || "https://placehold.co/400x300/eee/999?text=No+Image"}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                />
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm text-slate-700">
                  {product.category}
                </div>
                {product.visibleToRestaurants?.length > 0 && (
                  <div className="absolute top-2 left-2 bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <Users size={10} />
                    {product.visibleToRestaurants.length}
                  </div>
                )}
                {CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false && product.stock <= 5 && (
                  <div className="absolute bottom-2 right-2 bg-red-600 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1">
                    <AlertCircle size={12} /> {product.stock === 0 ? "نفذت" : "منخفض"}
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-800 text-lg line-clamp-1">{product.title}</h3>
                  <span className="text-red-600 font-extrabold">{product.price} دج</span>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50">
                  <button onClick={() => openEditModal(product)} className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-xl font-bold text-sm hover:bg-slate-100 flex items-center justify-center gap-2 transition">
                    <Edit size={16} /> تعديل
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-100 transition">
                    <Trash2 size={18} />
                  </button>
                  <button onClick={() => handleShareProduct(product.id)} className="bg-slate-50 text-slate-500 p-2.5 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition" title="نسخ الرابط">
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          {/* Mobile Product List (Visible only on mobile in table mode) */}
          <div className="md:hidden divide-y divide-gray-50">
            {filteredProducts.map(product => (
              <div key={product.id} className="p-4 flex gap-4 items-start">
                <img src={product.img || "https://placehold.co/100"} className="w-16 h-16 rounded-xl object-cover bg-slate-100 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{product.title}</h3>
                    <span className="font-black text-red-600 text-sm">{product.price} دج</span>
                  </div>
                  <div className="text-xs text-slate-400 font-bold mt-1 mb-2">{product.category}</div>

                  <div className="flex items-center justify-between">
                    <div className={`text-[10px] font-bold px-2 py-1 rounded-lg ${product.stock > 5 ? "bg-green-100 text-green-700" : product.stock > 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                      {product.stock > 0 ? `${product.stock} متوفر` : 'نفذت الكمية'}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(product)} className="text-blue-600 p-1.5 bg-blue-50 rounded-lg"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(product.id)} className="text-red-600 p-1.5 bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (Hidden on mobile) */}
          <table className="w-full text-right hidden md:table">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-6 py-4">المنتج</th>
                <th className="px-6 py-4">التصنيف</th>
                <th className="px-6 py-4">السعر</th>
                {CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false && (
                  <>
                    <th className="px-6 py-4">الكمية</th>
                    <th className="px-6 py-4">الحالة</th>
                  </>
                )}
                <th className="px-6 py-4">تخصيص</th>
                <th className="px-6 py-4">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={product.img || "https://placehold.co/100"} className="w-10 h-10 rounded-lg object-cover bg-slate-100" />
                      <span className="font-bold text-slate-800">{product.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-500">{product.category}</td>
                  <td className="px-6 py-4 font-black text-slate-800">{product.price} دج</td>
                  {CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false && (
                    <>
                      <td className="px-6 py-4 font-bold text-slate-700">{product.stock}</td>
                      <td className="px-6 py-4">
                        {product.stock > 5 ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">متوفر</span>
                        ) : product.stock > 0 ? (
                          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">منخفض</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">نفذت</span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 text-xs font-medium text-slate-400">
                    {product.customizationGroups?.length || 0} مجموعات
                  </td>
                  <td className="px-6 py-4 flex gap-2">
                    <button onClick={() => openEditModal(product)} className="text-blue-600 p-2 hover:bg-blue-50 rounded-lg"><Edit size={16} /></button>
                    <button onClick={() => handleShareProduct(product.id)} className="text-slate-400 p-2 hover:bg-slate-100 hover:text-blue-600 rounded-lg" title="نسخ الرابط"><LinkIcon size={16} /></button>
                    <button onClick={() => handleDelete(product.id)} className="text-red-600 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-800">إدارة التصنيفات</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X size={20} /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="اسم التصنيف الجديد..."
                  className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                />
                <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition"><Plus size={20} /></button>
              </form>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {categories.length === 0 && <p className="text-center text-slate-400 text-sm">لا توجد تصنيفات، أضف واحداً الآن.</p>}
                {categories.map(cat => (
                  <div key={cat.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    <span className="font-bold text-slate-700">{cat.name}</span>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-up">

            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-800">{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</h2>
                <p className="text-sm text-slate-400 font-bold mt-1">أدخل تفاصيل المنتج بدقة</p>
              </div>
              <button onClick={closeModal} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition"><X size={20} /></button>
            </div>

            {/* Modal Tabs */}
            <div className="flex px-8 border-b border-slate-100 overflow-x-auto no-scrollbar flex-shrink-0">
              {[{ id: 'basic', label: 'البيانات الأساسية', icon: <Package size={16} /> }, { id: 'customization', label: 'التخصيص', icon: <ChefHat size={16} /> }, { id: 'bundles', label: 'عروض التوفير', icon: <LayoutGrid size={16} /> }, { id: 'b2b', label: 'تسعير B2B', icon: <Users size={16} /> }, { id: 'restaurant_visibility', label: 'رؤية المطاعم', icon: <Users size={16} /> }].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-bold text-sm border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? "border-red-600 text-red-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-8 min-h-0">
              <form id="productForm" onSubmit={handleSave} className="space-y-6">

                {activeTab === 'basic' && (
                  <div className="space-y-6 animate-fade-in">
                    {/* Image Upload */}
                    <div className="border border-dashed border-slate-300 rounded-2xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition cursor-pointer relative group">
                      <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleImageSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                      {imagePreview ? (
                        <img src={imagePreview} className="h-40 object-cover rounded-xl shadow-sm" />
                      ) : (
                        <div className="text-center">
                          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-3 text-slate-400 group-hover:text-red-500 transition"><UploadCloud size={32} /></div>
                          <p className="font-bold text-slate-600">اضغط لرفع صورة</p>
                          <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP up to 5MB</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">اسم المنتج</label>
                        <input required className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-500" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="مثال: لحم خروف طازج" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">الباركود (Barcode)</label>
                        <div className="relative">
                          <input
                            type="text"
                            className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-500"
                            value={formData.barcode || ""}
                            onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                            placeholder="امسح الباركود أو أدخله يدوياً"
                          />
                          <div className="absolute left-3 top-3 text-slate-400">|||||||</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">سعر البيع (دج)</label>
                          <input required type="number" className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-500" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-2">سعر التكلفة (دج)</label>
                          <input type="number" className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500" value={formData.costPrice} onChange={e => setFormData({ ...formData, costPrice: e.target.value })} placeholder="للحسابات" />
                        </div>
                        {CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false && (
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">الكمية</label>
                            <input required type="number" className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-500" value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">التصنيف</label>
                        <select className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-500" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                          <option value="" disabled>اختر تصنيفاً...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                          {categories.length === 0 && <option value="أخرى">أخرى</option>}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">المورد الرئيسي (للفواتير)</label>
                        <select className="w-full p-3 bg-slate-50 border-none rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-500" value={formData.supplierId || ""} onChange={e => setFormData({ ...formData, supplierId: e.target.value })}>
                          <option value="">-- بدون مورد محدد --</option>
                          {suppliers && suppliers.map(sup => (
                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">موردين إضافيين (اختياري)</label>
                        <p className="text-xs text-slate-500 mb-2">في حالة كان المنتج يتم توريده من أكثر من مورد</p>
                        <div className="flex flex-wrap gap-2">
                          {suppliers?.map(sup => (
                            sup.id !== formData.supplierId && (
                              <label key={sup.id} className={`cursor-pointer px-3 py-1.5 rounded-lg border text-xs font-bold transition select-none flex items-center gap-2 ${formData.alternativeSupplierIds?.includes(sup.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={formData.alternativeSupplierIds?.includes(sup.id) || false}
                                  onChange={(e) => {
                                    let newIds = [...(formData.alternativeSupplierIds || [])];
                                    if (e.target.checked) {
                                      newIds.push(sup.id);
                                    } else {
                                      newIds = newIds.filter(id => id !== sup.id);
                                    }
                                    setFormData({ ...formData, alternativeSupplierIds: newIds });
                                  }}
                                />
                                {sup.name}
                                {formData.alternativeSupplierIds?.includes(sup.id) && <CheckCircle2 size={12} />}
                              </label>
                            )
                          ))}
                        </div>
                      </div>

                      <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 mt-4">
                        <label className="flex items-center justify-between cursor-pointer">
                          <div>
                            <h3 className="font-bold text-purple-900 flex items-center gap-2">
                              صفحة هبوط (Landing Page) 🚀
                            </h3>
                            <p className="text-xs text-purple-600 mt-1">
                              تفعيل هذا الخيار يجعل المنتج يباع كـ "وحدة ثابتة" (ليس بالوزن).
                              مثالي للعروض الخاصة والمنتجات التي لا تحتاج لميزان.
                            </p>
                          </div>
                          <div className={`w-14 h-8 rounded-full p-1 transition duration-300 relative ${formData.isLandingPage ? 'bg-purple-600' : 'bg-slate-300'}`}>
                            <input type="checkbox" className="hidden" checked={formData.isLandingPage || false} onChange={e => setFormData({ ...formData, isLandingPage: e.target.checked })} />
                            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition transform duration-300 absolute top-1 left-1 ${formData.isLandingPage ? 'translate-x-[24px]' : 'translate-x-0'}`}></div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Show In Store Toggle */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">عرض في المتجر الإلكتروني؟ 🛒</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          عند التعطيل، سيظهر المنتج **فقط** في لوحة التحكم وجرد المخزون (منتج داخلي).
                        </p>
                      </div>
                      <label className={`w-14 h-8 rounded-full p-1 transition duration-300 relative cursor-pointer ${formData.showInStore !== false ? 'bg-green-500' : 'bg-slate-300'}`}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={formData.showInStore !== false}
                          onChange={e => setFormData({ ...formData, showInStore: e.target.checked })}
                        />
                        <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition transform duration-300 absolute top-1 left-1 ${formData.showInStore !== false ? 'translate-x-[24px]' : 'translate-x-0'}`}></div>
                      </label>
                    </div>

                  </div>
                )}

                {activeTab === 'customization' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-slate-800">مجموعات الخيارات</h3>
                        <p className="text-xs text-slate-500">أضف خيارات مثل (طريقة التقطيع، التغليف)</p>
                      </div>

                      <div className="flex gap-2">
                        <select
                          className="text-xs bg-white border border-slate-200 p-2 rounded-lg font-bold outline-none"
                          onChange={(e) => {
                            const tpl = templates.find(t => t.id === e.target.value);
                            if (tpl) {
                              setFormData(prev => ({ ...prev, customizationGroups: [...(prev.customizationGroups || []), { id: Date.now(), title: tpl.groupTitle || tpl.title, options: tpl.options, required: tpl.required }] }));
                              e.target.value = "";
                            }
                          }}
                        >
                          <option value="">📂 استيراد قالب</option>
                          {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, customizationGroups: [...(prev.customizationGroups || []), { id: Date.now(), title: "", options: [], required: true }] }))} className="bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-900">
                          <Plus size={14} /> جديد
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {formData.customizationGroups?.map((group, gIdx) => (
                        <div key={group.id} className="bg-white border border-slate-200 p-4 rounded-xl relative shadow-sm hover:shadow-md transition">
                          <div className="flex gap-2 mb-3 items-center">
                            <input type="text" placeholder="عنوان المجموعة (مثلاً: التقطيع)" className="flex-1 p-2 bg-slate-50 rounded-lg text-sm font-bold border-none outline-none focus:ring-2 focus:ring-red-500" value={group.title} onChange={(e) => { const newGroups = [...formData.customizationGroups]; newGroups[gIdx].title = e.target.value; setFormData({ ...formData, customizationGroups: newGroups }); }} />
                            <label className="flex items-center gap-1 text-xs font-bold bg-slate-50 px-3 py-2 rounded-lg cursor-pointer">
                              <input type="checkbox" checked={group.required} onChange={(e) => { const newGroups = [...formData.customizationGroups]; newGroups[gIdx].required = e.target.checked; setFormData({ ...formData, customizationGroups: newGroups }); }} />
                              إجباري
                            </label>
                            <button type="button" onClick={() => saveAsTemplate(group)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg" title="حفظ كقالب"><Save size={16} /></button>
                            <button type="button" onClick={() => { const newGroups = formData.customizationGroups.filter((_, i) => i !== gIdx); setFormData({ ...formData, customizationGroups: newGroups }); }} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg"><Trash2 size={16} /></button>
                          </div>

                          <div className="flex flex-wrap gap-2 items-center">
                            {group.options.map((opt, oIdx) => (
                              <span key={oIdx} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">
                                {opt}
                                <button type="button" onClick={() => { const newGroups = [...formData.customizationGroups]; newGroups[gIdx].options = newGroups[gIdx].options.filter((_, i) => i !== oIdx); setFormData({ ...formData, customizationGroups: newGroups }); }} className="hover:text-red-500"><X size={12} /></button>
                              </span>
                            ))}
                            <input type="text" placeholder="+ خيار" className="w-24 p-1.5 text-xs bg-transparent border-b border-slate-200 outline-none focus:border-red-500" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const val = e.target.value.trim(); if (val && !group.options.includes(val)) { const newGroups = [...formData.customizationGroups]; newGroups[gIdx].options.push(val); setFormData({ ...formData, customizationGroups: newGroups }); e.target.value = ""; } } }} />
                          </div>
                        </div>
                      ))}
                      {formData.customizationGroups?.length === 0 && <div className="text-center text-slate-400 py-8 text-sm">لا توجد خيارات تخصيص مضافة</div>}
                    </div>
                  </div>
                )}

                {activeTab === 'bundles' && (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-orange-900">عروض التوفير (Composite Bundles)</h3>
                        <p className="text-xs text-orange-600">أنشئ عروضاً تتكون من منتجات أخرى (سيتم خصم المخزون من المنتجات المكونة)</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, bundles: [...(prev.bundles || []), { id: Date.now(), title: "", price: "", img: "", components: [] }] }))}
                        className="bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-orange-700 shadow-lg shadow-orange-600/20"
                      >
                        <Plus size={14} /> عرض جديد
                      </button>
                    </div>

                    <div className="space-y-4">
                      {formData.bundles?.map((bundle, bIdx) => (
                        <div key={bundle.id} className="bg-white border border-slate-200 p-4 rounded-xl relative shadow-sm hover:shadow-md transition">

                          {/* Bundle Header */}
                          <div className="flex gap-4 items-start">
                            {/* Mini Image Upload */}
                            <div className="w-20 h-20 bg-slate-50 flex-shrink-0 rounded-lg border border-dashed border-slate-300 relative overflow-hidden group cursor-pointer hover:border-orange-400">
                              {bundle.img ? (
                                <img src={bundle.img} className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex items-center justify-center w-full h-full text-slate-400"><ImageIcon size={20} /></div>
                              )}
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={async (e) => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  // Immediate upload for simplicity in nested forms
                                  try {
                                    notify.success("جاري رفع الصورة...");
                                    const storageRef = ref(storage, `bundles/${Date.now()}_${file.name}`);
                                    const snapshot = await uploadBytes(storageRef, file);
                                    const url = await getDownloadURL(snapshot.ref);

                                    const newBundles = formData.bundles.map((b, i) => i === bIdx ? { ...b, img: url } : b);
                                    setFormData({ ...formData, bundles: newBundles });
                                    notify.success("تم رفع الصورة");
                                  } catch (err) {
                                    console.error(err);
                                    notify.error("فشل الرفع");
                                  }
                                }}
                              />
                            </div>

                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">اسم العرض</label>
                                <input
                                  type="text"
                                  placeholder="مثال: بوكس الشواء العائلي"
                                  className="w-full p-2 bg-slate-50 rounded-lg text-sm font-bold border-none outline-none focus:ring-2 focus:ring-orange-500"
                                  value={bundle.title}
                                  onChange={(e) => {
                                    const newBundles = [...formData.bundles];
                                    newBundles[bIdx].title = e.target.value;
                                    setFormData({ ...formData, bundles: newBundles });
                                  }}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">سعر العرض (دج)</label>
                                <input
                                  type="number"
                                  placeholder="0"
                                  className="w-full p-2 bg-slate-50 rounded-lg text-sm font-bold border-none outline-none focus:ring-2 focus:ring-orange-500"
                                  value={bundle.price}
                                  onChange={(e) => {
                                    const newBundles = [...formData.bundles];
                                    newBundles[bIdx].price = e.target.value;
                                    setFormData({ ...formData, bundles: newBundles });
                                  }}
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newBundles = formData.bundles.filter((_, i) => i !== bIdx);
                                setFormData({ ...formData, bundles: newBundles });
                              }}
                              className="p-2 mt-6 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Components List */}
                          <div className="bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200 mt-4">
                            <h4 className="text-xs font-bold text-slate-500 mb-2 flex justify-between items-center">
                              مكونات العرض
                              <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600">سيتم خصم هذه الكميات من المخزون</span>
                            </h4>

                            <div className="space-y-2">
                              {bundle.components?.map((comp, cIdx) => (
                                <div key={cIdx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                  <select
                                    className="flex-1 text-xs font-bold bg-transparent outline-none p-1"
                                    value={comp.product_id}
                                    onChange={(e) => {
                                      const newBundles = [...formData.bundles];
                                      newBundles[bIdx].components[cIdx].product_id = e.target.value;
                                      setFormData({ ...formData, bundles: newBundles });
                                    }}
                                  >
                                    <option value="">اختر منتجاً...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.title} {CONFIG.ENABLE_INVENTORY_MANAGEMENT !== false ? `(${p.stock} كجم)` : ''}</option>)}
                                  </select>

                                  <div className="flex items-center gap-1 bg-slate-50 px-2 rounded">
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder="الوزن"
                                      className="w-16 text-center text-xs font-black bg-transparent outline-none py-1"
                                      value={comp.qty_to_deduct}
                                      onChange={(e) => {
                                        const newBundles = [...formData.bundles];
                                        newBundles[bIdx].components[cIdx].qty_to_deduct = e.target.value;
                                        setFormData({ ...formData, bundles: newBundles });
                                      }}
                                    />
                                    <span className="text-[10px] text-slate-400 font-bold">كجم</span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newBundles = [...formData.bundles];
                                      newBundles[bIdx].components = newBundles[bIdx].components.filter((_, i) => i !== cIdx);
                                      setFormData({ ...formData, bundles: newBundles });
                                    }}
                                    className="text-red-400 hover:text-red-600 p-1"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const newBundles = [...formData.bundles];
                                if (!newBundles[bIdx].components) newBundles[bIdx].components = [];
                                newBundles[bIdx].components.push({ product_id: "", qty_to_deduct: "" });
                                setFormData({ ...formData, bundles: newBundles });
                              }}
                              className="w-full mt-3 py-2 border border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-700 hover:border-slate-400 transition flex items-center justify-center gap-1"
                            >
                              <Plus size={14} /> إضافة مكون
                            </button>
                          </div>

                        </div>
                      ))}
                      {(!formData.bundles || formData.bundles.length === 0) && <div className="text-center text-slate-400 py-8 text-sm">لا توجد عروض مضافة</div>}
                    </div>
                  </div>
                )}
              </form>
            </div>

            {activeTab === 'b2b' && (
              <div className="space-y-6 animate-fade-in px-8 pb-8">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <h3 className="font-bold text-blue-900">إظهار للمطاعم (B2B)</h3>
                      <p className="text-xs text-blue-600">تفعيل هذا الخيار سيجعل المنتج مرئياً للمطاعم المسجلة.</p>
                    </div>
                    <div className={`w-14 h-8 rounded-full p-1 transition duration-300 relative ${formData.isB2bVisible ? 'bg-blue-600' : 'bg-slate-300'}`}>
                      <input type="checkbox" className="hidden" checked={formData.isB2bVisible || false} onChange={e => setFormData({ ...formData, isB2bVisible: e.target.checked })} />
                      <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition transform duration-300 absolute top-1 left-1 ${formData.isB2bVisible ? 'translate-x-[24px]' : 'translate-x-0'}`}></div>
                    </div>
                  </label>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-700 border-b border-slate-100 pb-2">شرائح الأسعار (Tier Pricing)</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1">السعر الأساسي (للجمهور)</label>
                      <div className="p-3 bg-slate-100 rounded-xl font-black text-slate-400">{formData.price || 0} دج</div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-500 mb-1">سعر التكلفة</label>
                      <div className="p-3 bg-slate-100 rounded-xl font-black text-slate-400">{formData.costPrice || 0} دج</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                    <div className="relative">
                      <label className="block text-sm font-bold text-slate-700 mb-2">سعر VIP</label>
                      <input
                        type="number"
                        className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl font-bold text-slate-800 outline-none"
                        value={formData.pricingTiers?.vip || ""}
                        onChange={e => setFormData({ ...formData, pricingTiers: { ...formData.pricingTiers, vip: e.target.value } })}
                        placeholder={formData.price}
                      />
                      <div className="absolute left-3 top-10 text-xs font-bold text-slate-400">دج</div>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-bold text-slate-700 mb-2">سعر الجملة (Wholesale)</label>
                      <input
                        type="number"
                        className="w-full p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl font-bold text-slate-800 outline-none"
                        value={formData.pricingTiers?.wholesale || ""}
                        onChange={e => setFormData({ ...formData, pricingTiers: { ...formData.pricingTiers, wholesale: e.target.value } })}
                        placeholder={formData.price}
                      />
                      <div className="absolute left-3 top-10 text-xs font-bold text-slate-400">دج</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'restaurant_visibility' && (
              <div className="space-y-6 animate-fade-in px-8 pb-8">

                {/* 1. Visibility Scope */}
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <Users size={18} /> تخصيص المطاعم
                      </h3>
                      <p className="text-xs text-indigo-600 mt-1">
                        تحكم في من يرى هذا المنتج وكم سعره لكل مطعم.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-indigo-100 shadow-sm">
                      <span className={`text-xs font-bold ${formData.visibleToRestaurants?.length > 0 ? "text-indigo-600" : "text-slate-400"}`}>
                        {formData.visibleToRestaurants?.length > 0 ? "مطاعم محددة" : "الكل"}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={formData.visibleToRestaurants?.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Switch to specific (initially empty or keep existing)
                              setFormData({ ...formData, visibleToRestaurants: [] });
                            } else {
                              // Switch to all (clear array)
                              setFormData({ ...formData, visibleToRestaurants: [] });
                            }
                          }}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>

                  {/* Helper Text based on selection */}
                  <div className="bg-white/50 p-2 rounded-lg text-xs text-indigo-800 font-bold text-center border border-indigo-100/50">
                    {formData.visibleToRestaurants?.length > 0
                      ? "سيظهر المنتج فقط للمطاعم المختارة أدناه."
                      : "سيظهر المنتج لجميع المطاعم (الافتراضي)."
                    }
                  </div>
                </div>

                {/* 2. Restaurants List & Pricing */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-700">قائمة المطاعم ({restaurants.length})</h4>
                    {/* Quick Filter? Maybe later */}
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm max-h-[400px] overflow-y-auto">
                    {restaurants.length === 0 && <div className="p-8 text-center text-slate-400">جاري تحميل المطاعم...</div>}

                    {restaurants.map(rest => {
                      const isSelected = formData.visibleToRestaurants?.includes(rest.id);
                      const isRestrictedMode = true; // We always show selection logic, but if mode is "All", selection is irrelevant for visibility but relevant for pricing? 
                      // Actually, if "All" mode, visibleToRestaurants should be empty.
                      // Let's use a local variable to control the "Mode" visually.
                      const isSpecificMode = formData.visibleToRestaurants?.length > 0 || (formData.visibleToRestaurants && formData.visibleToRestaurants.length === 0 && false); // Logic tricky. 
                      // Let's rely on: if visibleToRestaurants is NOT null/undefined, checking the box toggles it.
                      // Wait, the toggle above clears it. How do we start "Specific Mode" with 0 selected?
                      // We need a separate flag in state or use a dummy value? 
                      // Better: Let's assume if array is empty, it's ALL. 
                      // BUT how to represent "Specific Mode but none selected yet"?
                      // Solution: The toggle above is actually tricky.
                      // Let's change the toggle logic:
                      // We need a specific state `isVisibilityRestricted` in the component to handle the UI state when [].

                      const customPrice = formData.restaurantPricing?.[rest.id] || "";

                      return (
                        <div key={rest.id} className={`flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition ${isSelected ? 'bg-indigo-50/30' : ''}`}>

                          <div className="flex items-center gap-3 flex-1">
                            {/* Checkbox for Visibility - Only meaningful if we are in "Specific" mode? 
                                Actually, let's just allow checking -> if checked, it adds to array. 
                                If array has > 0, we are effectively in specific mode.
                                If nothing selected, logic defaults to ALL? 
                                Impl Plan: "if empty = all". 
                                So "Specific Mode with 0 selected" = "All" technically.
                                We need to enforce at least 1 selection if user WANTS restriction?
                                Or just accept that 0 selected = ALL.
                                
                                User Experience: 
                                1. User toggles "Specific".
                                2. List enables checkboxes.
                                3. If user unchecks all, it reverts to ALL? That might be confusing.
                                
                                Alternative: `visibleToRestaurants` is `null` for ALL. `[]` for NONE. 
                                But Firestore array updates...
                                Let's stick to: Empty = All. 
                                If user wants to restrict to "None", they update `isB2bVisible = false`.
                                So "Specific" effectively means "Subset".
                            */}

                            <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                              <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                {isSelected && <CheckCircle2 size={14} className="text-white" />}
                              </div>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={isSelected}
                                onChange={(e) => {
                                  let newVis = [...(formData.visibleToRestaurants || [])];
                                  if (e.target.checked) {
                                    newVis.push(rest.id);
                                  } else {
                                    newVis = newVis.filter(id => id !== rest.id);
                                  }
                                  setFormData({ ...formData, visibleToRestaurants: newVis });
                                }}
                              />
                              <div>
                                <p className={`text-sm font-bold ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{rest.fullName}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{rest.phone}</p>
                              </div>
                            </label>
                          </div>

                          {/* Price Input */}
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <input
                                type="number"
                                placeholder={formData.price}
                                className={`w-24 p-2 text-sm font-bold border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition ${customPrice ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                                value={customPrice}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const newPricing = { ...(formData.restaurantPricing || {}) };
                                  if (val) newPricing[rest.id] = val;
                                  else delete newPricing[rest.id];
                                  setFormData({ ...formData, restaurantPricing: newPricing });
                                }}
                              />
                              <span className="absolute left-2 top-2.5 text-[10px] font-bold text-slate-400">دج</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}


            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex gap-4">
              <button onClick={closeModal} className="flex-1 py-4 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition">إلغاء</button>
              <button form="productForm" disabled={uploading} type="submit" className="flex-[2] bg-red-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-red-600/20 hover:bg-red-700 transition flex items-center justify-center gap-2">
                {uploading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div >
      )
      }
    </div >
  );
}