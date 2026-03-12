import { Skeleton } from '@/components/ui/Skeleton';

export default function HomeLoading() {
  return (
    <div className="space-y-8">
      <Skeleton height="280px" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="120px" />
        ))}
      </div>
      <Skeleton height="340px" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Skeleton height="400px" />
        </div>
        <Skeleton height="400px" />
      </div>
    </div>
  );
}
