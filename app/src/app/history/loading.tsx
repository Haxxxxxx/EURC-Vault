import { Skeleton } from '@/components/ui/Skeleton';

export default function HistoryLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton width="260px" height="36px" rounded="lg" />
        <Skeleton width="400px" height="20px" rounded="lg" className="mt-2" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="120px" rounded="lg" />
        ))}
      </div>
      <Skeleton height="300px" rounded="lg" />
      <Skeleton height="400px" rounded="lg" />
    </div>
  );
}
