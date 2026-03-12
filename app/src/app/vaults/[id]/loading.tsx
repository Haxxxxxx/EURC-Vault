import { Skeleton } from '@/components/ui/Skeleton';

export default function VaultDetailLoading() {
  return (
    <div className="space-y-8">
      <Skeleton height="40px" className="w-32" />
      <Skeleton height="300px" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton height="320px" />
        <Skeleton height="320px" />
      </div>
    </div>
  );
}
