import { cn } from "@/lib/utils";

const DOT_COUNT = 3;

function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "relative inline-flex h-4 w-3 shrink-0 items-center justify-center",
        className,
      )}
      {...props}
    >
      {Array.from({ length: DOT_COUNT }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="cmdspace-loading-dot absolute left-1/2 top-1/2 size-0.5 rounded-full bg-primary"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  );
}

export { Spinner };
