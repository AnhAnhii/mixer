import React from 'react';
import SkeletonLoader from './SkeletonLoader';

const OrderListPageSkeleton: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6 border-b border-border pb-4">
                <SkeletonLoader className="w-64 h-8" />
                <div className="flex items-center gap-2">
                    <SkeletonLoader className="w-36 h-10" />
                    <SkeletonLoader className="w-36 h-10" />
                </div>
            </div>

            <div className="card-base p-4 flex flex-col md:flex-row gap-4 border">
                <SkeletonLoader className="h-10 flex-grow" />
                <SkeletonLoader className="h-10 w-48" />
            </div>

            <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                {[...Array(8)].map((_, i) => (
                                    <th key={i} scope="col" className="px-4 py-3">
                                        <SkeletonLoader className="h-4 w-full" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {[...Array(10)].map((_, i) => (
                                <tr key={i}>
                                    {[...Array(8)].map((_, j) => (
                                        <td key={j} className="px-4 py-4">
                                            <SkeletonLoader className="h-5 w-full" />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default OrderListPageSkeleton;
