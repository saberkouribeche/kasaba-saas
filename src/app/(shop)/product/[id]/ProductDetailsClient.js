
"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { ArrowRight, Minus, Plus, ShoppingBag, Check, ChefHat, Circle, CircleDot, Scale, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { notify } from "@/lib/notify";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function ProductDetailsClient({ product }) {
    const { addToCart, setIsDrawerOpen } = useCart();
    const router = useRouter();

    // Mode: 'weight' or 'budget'
    const [mode, setMode] = useState('weight');

    // Weight Mode State (starts at 1 if landing page, else 0.500 kg)
    const [weight, setWeight] = useState(product.isLandingPage ? 1 : 0.5);

    // Budget Mode State
    const [budget, setBudget] = useState(""); // Default Empty

    // Customization State
    const [selections, setSelections] = useState({});

    // Bundle Components Data (for savings calculation)
    const [bundleComponents, setBundleComponents] = useState({});

    useEffect(() => {
        if (product.bundles?.length > 0) {
            const fetchComponents = async () => {
                const compIds = new Set();
                product.bundles.forEach(b => b.components.forEach(c => compIds.add(c.product_id)));

                const comps = {};
                const ids = Array.from(compIds).filter(id => id);

                try {
                    const futures = ids.map(id => getDoc(doc(db, "product", id)));
                    const snapshots = await Promise.all(futures);

                    snapshots.forEach((snap, idx) => {
                        if (snap.exists()) comps[ids[idx]] = snap.data();
                    });
                } catch (e) {
                    console.error("Error fetching components", e);
                }
                setBundleComponents(comps);
            };
            fetchComponents();
        }
    }, [product.bundles]);

    // Pixel: ViewContent
    useEffect(() => {
        import('react-facebook-pixel')
            .then((x) => x.default)
            .then((ReactPixel) => {
                ReactPixel.track('ViewContent', {
                    content_name: product.title,
                    content_ids: [product.id],
                    content_type: 'product',
                    value: product.price,
                    currency: 'DZD'
                });
            });
    }, [product]);

    // Logic Checks
    const hasNewGroups = product.customizationGroups && product.customizationGroups.length > 0;
    const hasLegacyOptions = product.customizationOptions && product.customizationOptions.length > 0;

    // Derived Financials
    const finalWeight = mode === 'weight' ? weight : (budget ? Number(budget) / product.price : 0);
    const finalPrice = mode === 'weight' ? (weight * product.price) : (budget ? Number(budget) : 0);

    // Prepare options
    const finalOptions = hasNewGroups ? selections : (hasLegacyOptions ? { "التحضير": selections["legacy"] } : null);

    // Add to cart with specific weight
    // ...

    const handleAddToCart = () => {
        // Validation
        if (hasNewGroups) {
            for (const group of product.customizationGroups) {
                if (group.required && !selections[group.id]) {
                    notify.error(`يرجى اختيار ${group.title} `);
                    return;
                }
            }
        } else if (hasLegacyOptions) {
            if (!selections["legacy"]) {
                notify.error("يرجى اختيار خيار التحضير");
                return;
            }
        }

        if (mode === 'budget' && (!budget || Number(budget) <= 0)) {
            notify.error("يرجى إدخال مبلغ صحيح");
            return;
        }

        // Prepare options
        const finalOptions = hasNewGroups ? selections : (hasLegacyOptions ? { "التحضير": selections["legacy"] } : null);

        // Add to cart with specific weight
        // Note: modify addToCart in context if needed to handle 'weight' property or use quantity as weight.
        // For now assuming quantity field can store weight or we pass it as custom field.
        // We will pass weight as quantity for logic consistency if system allows float quantity, 
        // OR pass it as a special property (recommended).

        // Passing weight as 'quantity' logic:
        // Passing weight as 'quantity' logic:
        addToCart({ ...product, price: product.price }, finalWeight, finalOptions, false);

        // Unified Flow: Notify and Go Home
        notify.success("تم الإضافة للسلة بنجاح");
        router.push('/');
    };

    // Helpers
    const formatWeight = (w) => {
        if (!w) return "0 غرام";
        if (w < 1) return `${(w * 1000).toFixed(0)} غرام`;
        return `${w.toFixed(3)} كج`;
    };

    return (
        <div className="min-h-screen bg-white pb-32">
            {/* Header Image */}
            <div className="relative h-[40vh] bg-slate-100">
                <Link href="/" className="absolute top-6 right-6 z-10 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-slate-800 hover:bg-white transition">
                    <ArrowRight size={20} />
                </Link>
                <Image
                    src={product.img || "https://placehold.co/600x600"}
                    alt={product.title}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent"></div>
            </div>

            {/* Content of Details */}
            <div className="px-6 -mt-10 relative z-10">
                <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 p-6 border border-slate-50">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <span className="text-red-600 font-bold text-xs uppercase tracking-wider mb-1 block">{product.category}</span>
                            <h1 className="text-2xl font-black text-slate-900 leading-tight">{product.title}</h1>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-red-600">{product.price} <span className="text-xs text-slate-400">دج</span></div>
                            <div className="text-xs font-bold text-slate-400">للكيلوغرام</div>
                        </div>
                    </div>

                    <p className="text-slate-500 text-sm leading-relaxed mt-4">
                        لحوم طازجة ذبح اليوم. محضرة بعناية فائقة لتناسب ذوقكم الرفيع.
                    </p>

                    {/* === Customization === */}
                    {hasNewGroups && (
                        <div className="mt-8 space-y-6">
                            {product.customizationGroups.map(group => (
                                <div key={group.id} className="animate-fade-up">
                                    <label className="flex items-center gap-2 text-sm font-black text-slate-800 mb-3">
                                        <CircleDot size={16} className="text-red-600" />
                                        {group.title}
                                        {group.required && <span className="text-red-500 text-[10px] bg-red-50 px-2 py-0.5 rounded-full">مطلوب</span>}
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {group.options.map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => setSelections(prev => ({ ...prev, [group.id]: opt }))}
                                                className={`w-full px-3 py-3 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-between
                                                    ${selections[group.id] === opt
                                                        ? "bg-red-50 text-red-700 border-red-500 shadow-sm"
                                                        : "bg-white text-slate-600 border-slate-100 hover:border-slate-300"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    {selections[group.id] === opt
                                                        ? <div className="w-4 h-4 min-w-[16px] rounded-full border-[4px] border-red-500 bg-white shadow-sm" />
                                                        : <div className="w-4 h-4 min-w-[16px] rounded-full border-2 border-slate-300 bg-slate-50" />
                                                    }
                                                    <span className="truncate">{opt}</span>
                                                </div>
                                                {selections[group.id] === opt && <Check size={16} className="text-red-600 min-w-[16px]" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* === Value Packs / Bundles === */}
                    {product.bundles && product.bundles.length > 0 && (
                        <div className="mt-10 animate-fade-up">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="bg-orange-100 p-2 rounded-xl text-orange-600"><ShoppingBag size={20} /></div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-lg">عروض التوفير</h3>
                                    <p className="text-xs text-slate-500 font-bold">باقات مجهزة خصيصاً لك بسعر أفضل</p>
                                </div>
                            </div>

                            <div className="flex overflow-x-auto gap-4 pb-4 -mx-6 px-6 no-scrollbar snap-x">
                                {product.bundles.map((bundle) => {
                                    // Calculate total value of components to show savings
                                    let totalComponentValue = 0;
                                    bundle.components.forEach(comp => {
                                        const p = bundleComponents[comp.product_id];
                                        if (p) totalComponentValue += (p.price * Number(comp.qty_to_deduct));
                                    });
                                    const savings = totalComponentValue > 0 ? (totalComponentValue - bundle.price) : 0;

                                    return (
                                        <div key={bundle.id} className="min-w-[200px] max-w-[220px] snap-center bg-white rounded-[24px] border border-slate-100 p-3 relative overflow-hidden group hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300">
                                            {savings > 0 && (
                                                <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-black px-3 py-1.5 rounded-br-2xl shadow-sm z-10">
                                                    وفر {Math.floor(savings).toLocaleString()} دج
                                                </div>
                                            )}

                                            <div className="h-32 bg-slate-50 rounded-2xl mb-3 flex items-center justify-center overflow-hidden relative isolate">
                                                {bundle.img ? (
                                                    <img src={bundle.img} alt={bundle.title} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" />
                                                ) : (
                                                    <div className="text-5xl drop-shadow-sm">🎁</div>
                                                )}
                                            </div>

                                            <h4 className="font-black text-slate-800 text-base mb-1 text-center line-clamp-2 px-1 leading-tight">{bundle.title}</h4>

                                            {/* Components List Hidden as per user request */}
                                            {/* <div className="space-y-1 mb-4">...</div> */}

                                            <div className="flex items-center justify-between mt-4 px-1">
                                                <button
                                                    onClick={() => addToCart({
                                                        id: `bundle_${bundle.id}`,
                                                        title: bundle.title,
                                                        price: Number(bundle.price),
                                                        isBundle: true,
                                                        bundleId: bundle.id,
                                                        components: bundle.components
                                                    }, 1, {}, true)}
                                                    className="w-10 h-10 bg-[#1a1f2c] text-white rounded-xl flex items-center justify-center hover:bg-black transition shadow-lg shadow-slate-900/20 active:scale-95"
                                                >
                                                    <Plus size={20} strokeWidth={3} />
                                                </button>
                                                <div className="font-black text-xl text-slate-900">{Number(bundle.price).toLocaleString()} <span className="text-xs text-slate-400 font-bold">دج</span></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* === Purchase System === */}
                    <div className="mt-8 bg-slate-50 rounded-3xl p-6 border border-slate-100">

                        {product.isLandingPage ? (
                            /* Landing Page Interaction (Simple Qty) */
                            <div className="text-center animate-fade-in">
                                <div className="mb-6">
                                    <p className="text-sm font-bold text-slate-500 mb-3">الكمية المطلوبة</p>
                                    <div className="flex items-center justify-center gap-6">
                                        <button
                                            onClick={() => setWeight(Math.max(1, weight - 1))}
                                            className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:text-red-600 text-2xl hover:border-red-200 transition"
                                        >
                                            <Minus size={24} strokeWidth={3} />
                                        </button>
                                        <div className="font-black text-4xl text-slate-900 w-16">{weight}</div>
                                        <button
                                            onClick={() => setWeight(weight + 1)}
                                            className="w-14 h-14 bg-red-600 rounded-2xl shadow-lg shadow-red-600/30 flex items-center justify-center text-white text-2xl hover:bg-red-700 transition"
                                        >
                                            <Plus size={24} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>

                                <div className="border-t border-slate-200 pt-6">
                                    <button
                                        onClick={handleAddToCart}
                                        className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-xl shadow-xl shadow-red-600/20 active:scale-95 transition flex items-center justify-center gap-3 hover:bg-red-700"
                                    >
                                        <ShoppingBag size={24} />
                                        <span>اشترِ الآن</span>
                                        <span className="bg-white/20 px-3 py-1 rounded-lg text-base font-bold">{(product.price * weight).toLocaleString()} دج</span>
                                    </button>
                                    <p className="text-xs text-slate-400 font-bold mt-3">🚚 التوصيل متوفر داخل ولاية بومرداس فقط</p>
                                </div>
                            </div>
                        ) : (
                            /* Standard Weight/Budget System */
                            <>
                                {/* Mode Switcher - Segmented Control */}
                                <div className="bg-slate-200/50 p-1.5 rounded-2xl mb-8 flex relative isolate">
                                    <button
                                        onClick={() => setMode('weight')}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 relative z-10 whitespace-nowrap
                                            ${mode === 'weight' ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                                    >
                                        <Scale size={18} className={mode === 'weight' ? "text-red-600" : ""} />
                                        <span>شراء بالوزن</span>
                                    </button>
                                    <button
                                        onClick={() => setMode('budget')}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 relative z-10 whitespace-nowrap
                                            ${mode === 'budget' ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                                    >
                                        <Wallet size={18} className={mode === 'budget' ? "text-red-600" : ""} />
                                        <span>شراء بالمبلغ</span>
                                    </button>

                                    {/* Animated Background Pill */}
                                    <div
                                        className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out -z-10
                                        ${mode === 'weight' ? "right-1.5" : "right-[calc(50%+3px)]"}`}
                                    />
                                </div>

                                {mode === 'weight' ? (
                                    // Weight Stepper
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-slate-400 mb-2">اختر الوزن (القفزات 250 غ)</p>
                                        <div className="flex items-center justify-center gap-4">
                                            <button
                                                onClick={() => setWeight(Math.max(0.250, weight - 0.250))}
                                                className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition active:scale-95"
                                            >
                                                <Minus size={24} strokeWidth={3} />
                                            </button>

                                            <div className="min-w-[120px]">
                                                <div className="text-3xl font-black text-slate-800">{formatWeight(weight)}</div>
                                            </div>

                                            <button
                                                onClick={() => setWeight(weight + 0.250)}
                                                className="w-12 h-12 bg-red-600 rounded-xl shadow-lg shadow-red-600/30 flex items-center justify-center text-white hover:bg-red-700 transition active:scale-95"
                                            >
                                                <Plus size={24} strokeWidth={3} />
                                            </button>
                                        </div>
                                        <div className="mt-4 animate-fade-in">
                                            <span className="text-sm font-bold text-slate-400">السعر التقريبي: </span>
                                            <span className="text-2xl font-black text-slate-900">{finalPrice.toLocaleString()} دج</span>
                                        </div>
                                    </div>
                                ) : (
                                    // Budget Input
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-slate-400 mb-2">أدخل المبلغ الذي تريد الشراء به</p>
                                        <div className="relative max-w-[200px] mx-auto">
                                            <input
                                                placeholder="0"
                                                type="number"
                                                value={budget}
                                                onChange={(e) => setBudget(e.target.value)}
                                                className="w-full text-center text-3xl font-black bg-white border border-slate-200 rounded-xl py-3 outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder:text-slate-200"
                                            />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">دج</span>
                                        </div>
                                        <div className="mt-4 animate-fade-in">
                                            <span className="text-sm font-bold text-slate-400">الكمية التي ستحصل عليها: </span>
                                            <span className="text-xl font-black text-slate-900">{formatWeight(finalWeight)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Inline Add to Cart Button */}
                                <div className="mt-8 border-t border-slate-200 pt-6">
                                    <button
                                        onClick={handleAddToCart}
                                        className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-red-600/20 active:scale-95 transition flex items-center justify-center gap-3 hover:bg-red-700"
                                    >
                                        <ShoppingBag size={20} />
                                        <span>إضافة للسلة</span>
                                        <span className="bg-white/20 px-2 py-0.5 rounded text-sm font-medium">{Math.floor(finalPrice).toLocaleString()} دج</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
