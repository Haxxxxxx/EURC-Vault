import { Skeleton } from '@/components/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton width="200px" height="36px" rounded="lg" />
        <Skeleton width="350px" height="20px" rounded="lg" className="mt-2" />
      </div>
      <div className="max-w-4xl space-y-6">
        <Skeleton height="180px" rounded="lg" />
        <Skeleton height="320px" rounded="lg" />
        <Skeleton height="200px" rounded="lg" />
        <Skeleton height="180px" rounded="lg" />
      </div>
    </div>
  );
}
