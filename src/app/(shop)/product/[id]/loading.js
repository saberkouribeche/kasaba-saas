export default function Loading() {
    return (
        <div className="min-h-screen bg-white pb-32 animate-pulse">
            {/* Header Image Skeleton */}
            <div className="relative h-[40vh] bg-slate-200"></div>

            {/* Content Skeleton */}
            <div className="px-6 -mt-10 relative z-10">
                <div className="bg-white rounded-[32px] shadow-xl p-6 border border-slate-50 space-y-4">

                    <div className="flex justify-between items-start">
                        <div className="space-y-2">
                            <div className="h-4 bg-slate-100 w-20 rounded"></div>
                            <div className="h-8 bg-slate-200 w-48 rounded-xl"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-8 bg-slate-200 w-24 rounded-xl"></div>
                            <div className="h-3 bg-slate-100 w-12 rounded ml-auto"></div>
                        </div>
                    </div>

                    <div className="space-y-2 py-2">
                        <div className="h-3 bg-slate-100 w-full rounded"></div>
                        <div className="h-3 bg-slate-100 w-3/4 rounded"></div>
                    </div>

                    {/* Options Skeleton */}
                    <div className="mt-8 space-y-6">
                        <div className="space-y-3">
                            <div className="h-4 bg-slate-200 w-32 rounded"></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="h-12 bg-slate-100 rounded-xl"></div>
                                <div className="h-12 bg-slate-100 rounded-xl"></div>
                            </div>
                        </div>
                    </div>

                    {/* Value Packs Skeleton */}
                    <div className="mt-10">
                        <div className="h-6 bg-slate-100 w-40 rounded mb-4"></div>
                        <div className="flex gap-4 overflow-hidden">
                            <div className="min-w-[200px] h-48 bg-slate-100 rounded-2xl"></div>
                            <div className="min-w-[200px] h-48 bg-slate-100 rounded-2xl"></div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
