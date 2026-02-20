import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton for a stats card (dashboard grid items) */
export function SkeletonStatCard() {
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
      <Skeleton className="h-7 w-16 mb-1" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** Skeleton for a list item (deposits, payments, clients) */
export function SkeletonListItem() {
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="text-right space-y-2">
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-4 w-14 ml-auto rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for a client list item (wider, with stats row) */
export function SkeletonClientItem() {
  return (
    <div className="bg-card rounded-xl p-4 border border-border">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="text-right space-y-1">
          <Skeleton className="h-4 w-20 ml-auto" />
          <Skeleton className="h-3 w-10 ml-auto" />
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

/** Skeleton for the dashboard screen */
export function SkeletonDashboard() {
  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      {/* Smart Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </div>

      {/* KPI Card */}
      <div className="bg-card rounded-2xl p-5 border border-border space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-36" />
        <div className="flex items-center gap-4 pt-3 border-t border-border/50">
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>

      {/* Priority Block */}
      <div className="flex gap-3">
        <Skeleton className="flex-1 h-16 rounded-xl" />
        <Skeleton className="flex-1 h-16 rounded-xl" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 py-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>

      {/* Rate card */}
      <Skeleton className="h-16 w-full rounded-xl" />

      {/* Recent activity */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <SkeletonListItem />
        <SkeletonListItem />
        <SkeletonListItem />
      </div>
    </div>
  );
}

/** Skeleton for a detail screen (Revolut-style hero layout) */
export function SkeletonDetail() {
  return (
    <div className="space-y-4">
      {/* Hero zone - centered */}
      <div className="flex flex-col items-center pt-2 pb-6 px-4">
        <Skeleton className="w-16 h-16 rounded-2xl mb-4" />
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-5 w-20 rounded-full mb-4" />
        <Skeleton className="h-10 w-48 mb-1" />
        <Skeleton className="h-5 w-10 mt-1" />
        <Skeleton className="h-4 w-36 mt-3" />
      </div>

      <div className="px-4 space-y-4">
        {/* Transaction ID strip */}
        <Skeleton className="h-14 w-full rounded-xl" />

        {/* Details card */}
        <div className="card-glass overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="divide-y divide-border/30">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>

        {/* Timeline card */}
        <div className="card-glass overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30">
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton for a client detail screen */
export function SkeletonClientDetail() {
  return (
    <div className="px-4 py-4 space-y-4">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
      </div>

      {/* Balance card */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <Skeleton className="h-4 w-16 mb-2" />
        <Skeleton className="h-8 w-32" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="bg-card rounded-xl p-4 border border-border space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>

      {/* Info section */}
      <div className="bg-card rounded-xl p-4 border border-border space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for a deposits/payments list screen */
export function SkeletonListScreen({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}
