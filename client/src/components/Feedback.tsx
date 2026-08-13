import { cn } from '../lib/utils/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-level-gray border-t-celestial-blue" />
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-power-orange/30 bg-power-orange/10 p-4 text-power-orange">
      <p className="text-sm">{message ?? 'Something went wrong.'}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-sm underline">
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-secure-gray">
      <p className="text-base font-medium">{title}</p>
      {description && <p className="mt-1 text-sm text-[var(--fg-3)]">{description}</p>}
    </div>
  );
}
