import { Skeleton } from '@/components/ui/Skeleton';

export default function DepositWithdrawLoading() {
  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center">
      <div className="w-full max-w-lg space-y-6">
        <Skeleton height="500px" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton height="100px" />
          <Skeleton height="100px" />
        </div>
      </div>
    </div>
  );
}
