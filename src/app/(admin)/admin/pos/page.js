"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, query, orderBy } from "firebase/firestore";
import { Search, ShoppingCart, Plus, Minus, Trash2, Banknote, CreditCard, Receipt, PauseCircle, PlayCircle, Scale, Calculator } from "lucide-react";
import { notify } from "@/lib/notify";
import { usePosStore } from "@/store/usePosStore";
import WeightModal from "@/components/pos/WeightModal";
import CustomerSelector from "@/components/pos/CustomerSelector";
import PosCategoryTabs from "@/components/pos/PosCategoryTabs";
import PosNumpad from "@/components/pos/PosNumpad";

export default function POSPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [showParkedModal, setShowParkedModal] = useState(false);

    // Numpad State
    const [showNumpad, setShowNumpad] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState(null);

    // Store Configuration
    const {
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        selectedCustomer,
        parkOrder,
        parkedOrders,
        retrieveOrder,
        removeParkedOrder,
        openWeightModal
    } = usePosStore();

    // Categories State
    const [categoriesList, setCategoriesList] = useState([]);

    // Fetch Products & Categories
    useEffect(() => {
        const unsubProducts = onSnapshot(collection(db, "product"), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProducts(data);
            setLoading(false);
        });

        const qCategories = query(collection(db, "categories"), orderBy("created_at"));
        const unsubCategories = onSnapshot(qCategories, (snapshot) => {
            setCategoriesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubProducts();
            unsubCategories();
        };
    }, []);

    // Merge DB categories with any specific ones found in products (resilience)
    const uniqueCategories = new Set([
        ...categoriesList.map(c => c.name),
        ...products.map(p => p.category || "غير مصنف")
    ]);
    const categories = ["all", ...Array.from(uniqueCategories)]; // Ensure "all" is first and unique

    const total = cart.reduce((acc, item) => acc + item.totalPrice, 0);

    // --- Barcode Logic ---
    useEffect(() => {
        let buffer = "";
        let lastKeyTime = Date.now();

        const handleKeyDown = (e) => {
            const currentTime = Date.now();

            // If typing into an input field, likely manual search, don't hijack unless it looks like a scan?
            // Actually, scanner sends keystrokes. If focused on search, it effectively searches.
            // But we want to bypass search for Weight Barcode items?
            // Let's listen globally. If `e.target.tagName` is INPUT, maybe let it handle?
            // User requested robust integration.
            // If I focus on search and scan, search input will get the numbers. 
            // It might be better to hijack if the scanning speed is high? 
            // For now, let's keep it simple: If not focused on input, buffer.
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'Enter') {
                if (buffer.length > 0) {
                    processBarcode(buffer);
                    buffer = "";
                }
            } else if (e.key.length === 1) { // Printable chars
                // Reset buffer if gap is too long (manual typing) - e.g. > 100ms
                if (currentTime - lastKeyTime > 100) {
                    buffer = "";
                }
                buffer += e.key;
                lastKeyTime = currentTime;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [products]); // Re-bind if products change

    const processBarcode = (code) => {
        console.log("Scanned:", code);

        // 1. Check for RONGTA Scale Barcode (Prefix '21', length 13)
        // Format: 21 PPPPP WWWWW C
        if (code.length === 13 && code.startsWith('21')) {
            const itemCode = code.substring(2, 7); // 5 digits
            const weightRaw = code.substring(7, 12); // 5 digits (grams)
            const weightKg = Number(weightRaw) / 1000;

            // Find product by barcode matching the Item Code (PLU)
            // We assume the Admin enters '10001' as barcode, and scanner sends '2110001...'
            const product = products.find(p => p.barcode === itemCode);

            if (product) {
                notify.success(`تم التعرف: ${product.title} - ${weightKg}kg`);
                addToCart({ ...product, weight: weightKg, totalPrice: product.price * weightKg, isWeight: true });
            } else {
                notify.error(`منتج غير موجود (رمز: ${itemCode})`);
            }
            return;
        }

        // 2. Normal Barcode Search
        const exactProduct = products.find(p => p.barcode === code);
        if (exactProduct) {
            handleProductClick(exactProduct); // Reuse click logic (opens modal if needed, or adds unit)
            // Note: If unit product has modal enabled (weird config), it opens. 
            // Ideally scanner adds directly for unit products.
            // If weight product scanned via normal barcode? Opens modal. Correct.
        } else {
            notify.error(`باركود غير معروف: ${code}`);
        }
    };
    // ---------------------

    const handleProductClick = (product) => {
        // "isLandingPage" in Admin Page is described as: "Activating this option makes the product sold as a 'fixed unit' (not by weight)."
        // Therefore, if isLandingPage is false, it is sold by weight.
        const isSoldByWeight = !product.isLandingPage;

        if (isSoldByWeight) {
            openWeightModal(product);
        } else {
            addToCart(product);
        }
    };

    const setItemQuantity = (cartId, newQty) => {
        const item = cart.find(i => i.cartId === cartId);
        if (!item) return;
        const current = item.quantity;
        updateQuantity(cartId, newQty - current);
    };

    // Calculate Grid Columns Helper
    // Only locally needed

    // Submit Order
    const handleCheckout = async (method = 'cash') => {
        if (cart.length === 0) return;

        if (method === 'debt' && !selectedCustomer) {
            notify.error("يجب تحديد زبون أولاً للدين");
            return;
        }

        if (!(await notify.confirm("تأكيد العملية؟"))) return;

        try {
            const orderData = {
                order_number: `POS-${Math.floor(Math.random() * 100000)}`,
                customer_name: selectedCustomer ? selectedCustomer.fullName : "زبون مباشر",
                customer_id: selectedCustomer ? selectedCustomer.id : null,
                customer_phone: selectedCustomer ? selectedCustomer.phone : "-",
                delivery_area: "المتجر",
                source: "pos",
                payment_method: method,
                order_status: method === 'debt' ? 'unpaid' : 'delivered',
                order_items: cart.map(i => ({
                    title: i.title,
                    price: i.price,
                    quantity: i.quantity,
                    weight: i.weight || null,
                    total: i.totalPrice
                })),
                order_total: total,
                created_at: serverTimestamp()
            };

            await addDoc(collection(db, "order"), orderData);

            // Update user debt if debt
            if (method === 'debt' && selectedCustomer) {
                const userRef = doc(db, "users", selectedCustomer.id);
                await updateDoc(userRef, {
                    totalDebt: increment(total)
                });
            }

            clearCart();
            notify.success("تمت العملية بنجاح! ✅");
        } catch (error) {
            console.error(error);
            notify.error("فشل العملية");
        }
    };


    const filteredProducts = products.filter(p => {
        const titleMatch = (p.title || "").toLowerCase().includes(searchTerm.toLowerCase());
        const categoryMatch = categoryFilter === "all" || (p.category || "غير مصنف") === categoryFilter;
        return titleMatch && categoryMatch;
    });

    return (
        <div className="flex h-[calc(100vh-2rem)] gap-6 p-2 relative">
            <WeightModal />

            {/* Parked Orders Modal (Simple overlay for now) */}
            {showParkedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-xl">الطلبات المعلقة ({parkedOrders.length})</h3>
                            <button onClick={() => setShowParkedModal(false)} className="bg-gray-100 p-2 rounded-full"><Plus className="rotate-45" /></button>
                        </div>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {parkedOrders.length === 0 && <p className="text-gray-400 text-center py-8">لا توجد طلبات معلقة</p>}
                            {parkedOrders.map(order => (
                                <div key={order.id} className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center border border-gray-100 hover:border-blue-200 transition">
                                    <div>
                                        <p className="font-bold text-slate-800">{order.customer?.fullName || "زبون مباشر"}</p>
                                        <p className="text-xs text-gray-400">{new Date(order.date).toLocaleTimeString()}</p>
                                        <p className="text-sm font-semibold text-blue-600 mt-1">{order.cart.length} عناصر</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { retrieveOrder(order.id); setShowParkedModal(false); }} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-600">استرجاع</button>
                                        <button onClick={() => removeParkedOrder(order.id)} className="bg-red-50 text-red-500 px-3 py-2 rounded-xl hover:bg-red-100"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* LEFT: Products Grid */}
            <div className="flex-1 flex flex-col gap-6 w-full">
                {/* Top Controls */}
                <div className="bg-white p-5 rounded-[24px] shadow-soft border border-gray-100 flex flex-col gap-4">
                    <div className="flex gap-4 items-center">
                        <div className="relative flex-1">
                            <Search className="absolute right-4 top-3.5 text-slate-400" size={20} />
                            <input
                                className="w-full pr-12 pl-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-slate-800 outline-none transition font-bold text-slate-700 placeholder-gray-400"
                                placeholder="بحث عن منتج..."
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <PosCategoryTabs
                        categories={categories}
                        activeCategory={categoryFilter}
                        onSelect={setCategoryFilter}
                    />
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto bg-white p-6 rounded-[32px] shadow-soft border border-gray-100 custom-scrollbar">
                    {filteredProducts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
                            <div className="bg-gray-50 p-6 rounded-full">
                                <Search size={48} className="text-gray-300" />
                            </div>
                            <p className="font-bold text-lg">لا توجد منتجات</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    className="border border-gray-100 rounded-[20px] p-3 cursor-pointer hover:border-red-500/30 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white group relative"
                                >
                                    <div className="aspect-square bg-gray-50 rounded-2xl mb-3 relative overflow-hidden">
                                        {(product.img || product.image) ? (
                                            <img src={product.img || product.image} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <ShoppingCart size={32} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition flex items-center justify-center backdrop-blur-[2px]">
                                            {!product.isLandingPage ? (
                                                <Scale className="text-white drop-shadow-md bg-emerald-500/80 rounded-full p-2 w-12 h-12" />
                                            ) : (
                                                <Plus className="text-white drop-shadow-md bg-slate-900/50 rounded-full p-2 w-12 h-12" />
                                            )}
                                        </div>
                                    </div>
                                    <h3 className="font-black text-slate-800 text-sm truncate px-1">{product.title}</h3>
                                    <div className="flex justify-between items-center mt-1 px-1">
                                        <p className="text-red-600 font-black text-lg">{product.price} <span className="text-xs text-red-400">دج</span></p>
                                    </div>
                                    {/* Weight Badge */}
                                    {!product.isLandingPage && (
                                        <div className="absolute top-2 right-2 bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-1 rounded-full shadow-sm">
                                            وزن
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Cart Sidebar */}
            <div className="w-96 bg-white border border-gray-100 shadow-soft flex flex-col rounded-[32px] overflow-hidden shrink-0 relative">
                <div className="p-6 bg-slate-900 text-white relative overflow-hidden shrink-0">
                    <div className="relative z-10 flex justify-between items-start mb-4">
                        <div>
                            <h2 className="font-black text-xl flex items-center gap-2">
                                فاتورة بيع
                            </h2>
                            <p className="text-slate-400 text-xs mt-1 font-bold">نقطة بيع مباشرة</p>
                        </div>

                        <div className="flex gap-2">
                            {/* Scale Connection Removed as per user request */}
                            <button
                                onClick={() => setShowNumpad(!showNumpad)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${showNumpad ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'}`}
                                title="لوحة الأرقام"
                            >
                                <Calculator size={20} />
                            </button>
                            <button
                                onClick={parkOrder}
                                className="w-10 h-10 rounded-xl bg-slate-800 text-yellow-400 flex items-center justify-center hover:bg-slate-700 transition"
                                title="تعليق الطلب"
                            >
                                <PauseCircle size={20} />
                            </button>
                            <button
                                onClick={() => setShowParkedModal(true)}
                                className="w-10 h-10 rounded-xl bg-slate-800 text-blue-400 flex items-center justify-center hover:bg-slate-700 transition relative"
                                title="الطلبات المعلقة"
                            >
                                <PlayCircle size={20} />
                                {parkedOrders.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center border border-slate-900">{parkedOrders.length}</span>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <CustomerSelector />
                    </div>

                    <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-600 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative">
                    {cart.map(item => (
                        <div
                            key={item.cartId}
                            onClick={() => setSelectedItemId(item.cartId)}
                            className={`flex gap-3 items-center p-3 rounded-2xl border transition group relative cursor-pointer ${selectedItemId === item.cartId ? 'bg-blue-50 border-blue-500 shadow-md transform scale-[1.02]' : 'bg-gray-50/50 border-gray-100 hover:border-blue-100'}`}
                        >
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                                <div className="flex items-center gap-3 mt-1">
                                    {item.isWeight ? (
                                        <div className="bg-emerald-50 text-emerald-600 text-xs font-bold px-2 py-1 rounded-lg border border-emerald-100">
                                            {item.weight} kg
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-gray-100 shadow-sm">
                                            <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartId, -1); }} className="w-6 h-6 flex items-center justify-center rounded bg-gray-50 hover:bg-gray-200 text-gray-600"><Minus size={12} /></button>
                                            <span className="font-bold text-sm w-6 text-center">{item.quantity}</span>
                                            <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartId, 1); }} className="w-6 h-6 flex items-center justify-center rounded bg-gray-50 hover:bg-gray-200 text-gray-600"><Plus size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                                <div className="font-black text-slate-900 text-base">{item.totalPrice.toLocaleString()}</div>
                                <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.cartId); }} className="text-gray-300 hover:text-red-500 transition p-1 bg-white rounded-lg shadow-sm w-fit">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {showNumpad && (
                    <div className="bg-gray-50 border-t border-gray-200 p-4 transition-all animate-in slide-in-from-bottom duration-300">
                        {selectedItemId ? (
                            <div className="mb-2 text-center text-xs font-bold text-slate-500">
                                تعديل الكمية لـ: <span className="text-slate-800">{cart.find(i => i.cartId === selectedItemId)?.title}</span>
                            </div>
                        ) : (
                            <div className="mb-2 text-center text-xs font-bold text-red-400">
                                اختر منتجاً لتعديل كميته
                            </div>
                        )}
                        <div className="bg-slate-100/50 p-2 rounded-2xl border border-slate-200/50 backdrop-blur-md">
                            <PosNumpad
                                onInput={(num) => {
                                    if (!selectedItemId) return;
                                    const item = cart.find(i => i.cartId === selectedItemId);
                                    if (!item || item.isWeight) return;
                                    const newQty = num === '.' ? item.quantity : Number(num);
                                    if (newQty > 0) setItemQuantity(selectedItemId, newQty);
                                }}
                                onDelete={() => {
                                    if (!selectedItemId) return;
                                    setItemQuantity(selectedItemId, 1);
                                }}
                            />
                        </div>
                    </div>
                )}

                <div className="p-5 bg-white border-t border-gray-100 space-y-3 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-20">
                    <div className="flex justify-between items-end border-b border-gray-100 pb-3 border-dashed">
                        <span className="text-gray-500 font-bold text-sm">الإجمالي</span>
                        <span className="text-3xl font-black text-slate-900">{total.toLocaleString()} <span className="text-sm text-gray-400 font-medium">دج</span></span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleCheckout('cash')} className="bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition transform active:scale-95 text-sm">
                            <Banknote size={18} /> كاش
                        </button>
                        <button onClick={() => handleCheckout('card')} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition transform active:scale-95 text-sm">
                            <CreditCard size={18} /> بطاقة
                        </button>
                        <button onClick={() => handleCheckout('debt')} className="col-span-2 bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-800/20 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition transform active:scale-95 text-sm">
                            <Receipt size={18} /> تسجيل كدين (Crédit)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
