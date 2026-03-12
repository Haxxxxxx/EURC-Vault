import { Skeleton } from '@/components/ui/Skeleton';

export default function LeaderboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton width="280px" height="36px" rounded="lg" />
        <Skeleton width="400px" height="20px" rounded="lg" className="mt-2" />
      </div>
      <Skeleton height="120px" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="200px" />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height="100px" />
        ))}
      </div>
      <Skeleton height="300px" />
    </div>
  );
}
