import React from 'react';
import SkeletonLoader from './SkeletonLoader';

const StatCardSkeleton = () => (
    <div className="bg-card p-5 rounded-xl border border-border flex items-center gap-5">
        <SkeletonLoader className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
            <SkeletonLoader className="w-24 h-4" />
            <SkeletonLoader className="w-32 h-8" />
        </div>
    </div>
);

const ListSkeleton = () => (
    <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="flex justify-between items-center p-3 rounded-lg border-b border-border last:border-b-0">
                <div className="space-y-2">
                    <SkeletonLoader className="w-32 h-5" />
                    <SkeletonLoader className="w-20 h-3" />
                </div>
                <div className="space-y-2 text-right">
                    <SkeletonLoader className="w-24 h-5 ml-auto" />
                    <SkeletonLoader className="w-16 h-3 ml-auto" />
                </div>
            </div>
        ))}
    </div>
);


const DashboardSkeleton: React.FC = () => {
    return (
        <div className="space-y-8">
             <SkeletonLoader className="w-48 h-8" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 <StatCardSkeleton />
                 <StatCardSkeleton />
                 <StatCardSkeleton />
                 <StatCardSkeleton />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-card p-6 rounded-xl border border-border">
                    <SkeletonLoader className="w-40 h-6 mb-4" />
                    <ListSkeleton />
                </div>
                 <div className="bg-card p-6 rounded-xl border border-border">
                    <SkeletonLoader className="w-56 h-6 mb-4" />
                    <ListSkeleton />
                </div>
            </div>
        </div>
    );
};

export default DashboardSkeleton;
