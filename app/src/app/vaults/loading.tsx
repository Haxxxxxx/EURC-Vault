import { Skeleton } from '@/components/ui/Skeleton';

export default function VaultsLoading() {
  return (
    <div className="space-y-8">
      <Skeleton height="80px" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} height="160px" />
      ))}
    </div>
  );
}
