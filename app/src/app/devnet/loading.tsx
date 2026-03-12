import { Skeleton } from '@/components/ui/Skeleton';

export default function DevnetLoading() {
  return (
    <div className="space-y-6">
      <Skeleton height="60px" />
      <Skeleton height="60px" />
      <Skeleton height="80px" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="180px" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} height="140px" />
        ))}
      </div>
    </div>
  );
}
