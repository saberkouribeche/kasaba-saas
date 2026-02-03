export default function PosCategoryTabs({ categories, activeCategory, onSelect }) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar select-none">
            <button
                onClick={() => onSelect('all')}
                className={`flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-black transition-all transform active:scale-95 ${activeCategory === 'all' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'bg-white text-slate-500 border border-gray-100 hover:bg-gray-50 hover:text-slate-800'}`}
            >
                الكل
            </button>
            {categories.filter(c => c !== 'all').map(cat => (
                <button
                    key={cat}
                    onClick={() => onSelect(cat)}
                    className={`flex-shrink-0 px-6 py-3 rounded-2xl text-sm font-black transition-all transform active:scale-95 ${activeCategory === cat ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'bg-white text-slate-500 border border-gray-100 hover:bg-gray-50 hover:text-slate-800'}`}
                >
                    {cat}
                </button>
            ))}
        </div>
    );
}
