import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton width="220px" height="32px" rounded="lg" />
        <Skeleton width="300px" height="20px" rounded="lg" className="mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height="80px" />
        ))}
      </div>
      <Skeleton height="300px" />
    </div>
  );
}
