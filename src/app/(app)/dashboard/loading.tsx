import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-7 w-40" />
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-20 w-52" />
        <Skeleton className="h-20 w-52" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
