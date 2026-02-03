import { useState, useEffect } from 'react';
import { Search, User, X } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { usePosStore } from '@/store/usePosStore';

export default function CustomerSelector() {
    const { selectedCustomer, setCustomer } = usePosStore();
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Debounce search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 0) { // Search even with 1 char for better feel? Standard is usually 1 or 2.
                setLoading(true);
                try {
                    // Fetch all users to ensure we find "Restaurants" or other roles.
                    // Optimally we would index this, but for now client-side filtering 
                    // ensures we catch case-insensitive partial matches.
                    const q = query(collection(db, "users"));
                    const querySnapshot = await getDocs(q);
                    const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    const term = searchTerm.toLowerCase();
                    const filtered = users.filter(u => {
                        const name = (u.fullName || "").toLowerCase();
                        const phone = (u.phone || "").toLowerCase();
                        return name.includes(term) || phone.includes(term);
                    });

                    setResults(filtered.slice(0, 10)); // Increased limit
                } catch (error) {
                    console.error("Error searching customers:", error);
                }
                setLoading(false);
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleSelect = (customer) => {
        setCustomer(customer);
        setSearchTerm("");
        setResults([]);
        setIsOpen(false);
    };

    const clearCustomer = () => {
        setCustomer(null);
    };

    return (
        <div className="relative mb-4">
            {selectedCustomer ? (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {selectedCustomer.fullName?.[0] || 'Z'}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">{selectedCustomer.fullName || selectedCustomer.phone}</p>
                            <p className="text-xs text-slate-500 font-semibold">الدين: <span className="text-red-500 font-bold">{selectedCustomer.totalDebt || 0} دج</span></p>
                        </div>
                    </div>
                    <button onClick={clearCustomer} className="w-8 h-8 rounded-full bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition shadow-sm">
                        <X size={16} />
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                        <User size={18} />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onFocus={() => setIsOpen(true)}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="ابحث عن زبون (الاسم أو الهاتف)..."
                        className="w-full bg-gray-50 border border-gray-100 text-right pr-10 pl-4 py-3 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition"
                    />
                    {loading && (
                        <div className="absolute left-3 top-3.5">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    {/* Convert to actual dropdown if results exist */}
                    {isOpen && results.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                            {results.map(customer => (
                                <div
                                    key={customer.id}
                                    onClick={() => handleSelect(customer)}
                                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-none flex justify-between items-center transition"
                                >
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{customer.fullName}</p>
                                        <p className="text-xs text-slate-400">{customer.phone}</p>
                                    </div>
                                    {customer.totalDebt > 0 && (
                                        <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full">دني: {customer.totalDebt}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
