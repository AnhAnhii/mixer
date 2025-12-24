import React from 'react';

const SkeletonLoader: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`bg-muted animate-pulse rounded-md ${className}`} />
);

export default SkeletonLoader;
