import React from 'react';
import SkeletonLoader from './SkeletonLoader';

interface TablePageSkeletonProps {
    titleWidth?: string;
    filterWidth?: string;
    columnCount: number;
    rowCount?: number;
}

const TablePageSkeleton: React.FC<TablePageSkeletonProps> = ({ 
    titleWidth = "w-64", 
    filterWidth = "md:w-1/3", 
    columnCount, 
    rowCount = 10 
}) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-border pb-4">
                <SkeletonLoader className={`${titleWidth} h-8`} />
                <SkeletonLoader className="w-40 h-10" />
            </div>

            {filterWidth && 
                <div className="card-base p-4 flex flex-col md:flex-row gap-4 border">
                    <SkeletonLoader className={`h-10 w-full ${filterWidth}`} />
                </div>
            }

            <div className="bg-card rounded-lg shadow overflow-hidden border border-border">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50">
                            <tr>
                                {[...Array(columnCount)].map((_, i) => (
                                    <th key={i} scope="col" className="px-4 py-3">
                                        <SkeletonLoader className="h-4 w-full" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                            {[...Array(rowCount)].map((_, i) => (
                                <tr key={i}>
                                    {[...Array(columnCount)].map((_, j) => (
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

export default TablePageSkeleton;
