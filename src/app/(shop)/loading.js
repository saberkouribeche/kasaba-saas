export default function Loading() {
    return (
        <div className="pb-32 bg-slate-50 min-h-screen animate-pulse">
            {/* Header Skeleton */}
            <div className="sticky top-0 z-40 bg-white border-b border-white/50 px-4 pt-4 pb-3 rounded-b-3xl shadow-sm h-[140px]">
                <div className="flex justify-between items-center mb-6">
                    <div className="w-10 h-10 bg-slate-100 rounded-full"></div>
                    <div className="w-32 h-8 bg-slate-100 rounded-xl"></div>
                    <div className="w-10 h-10 bg-slate-100 rounded-full"></div>
                </div>
                <div className="w-full h-12 bg-slate-100 rounded-2xl"></div>
            </div>

            <div className="px-4 mt-6 space-y-8">
                {/* Categories Skeleton */}
                <div className="flex gap-3 overflow-hidden">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-24 h-10 bg-slate-200 rounded-2xl shrink-0"></div>
                    ))}
                </div>

                {/* Banner Skeleton */}
                <div className="w-full h-48 bg-slate-200 rounded-3xl"></div>

                {/* Grid Skeleton */}
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-white rounded-3xl p-3 h-64 border border-slate-100">
                            <div className="w-full h-32 bg-slate-100 rounded-2xl mb-4"></div>
                            <div className="space-y-2">
                                <div className="h-4 bg-slate-100 w-3/4 rounded"></div>
                                <div className="flex justify-between mt-2">
                                    <div className="h-6 bg-slate-100 w-16 rounded"></div>
                                    <div className="h-6 bg-slate-100 w-12 rounded"></div>
                                </div>
                                <div className="h-10 bg-slate-100 w-full rounded-xl mt-4"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
