import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminSubLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton width="200px" height="32px" rounded="lg" />
        <Skeleton width="300px" height="20px" rounded="lg" className="mt-2" />
      </div>
      <Skeleton height="400px" />
    </div>
  );
}
