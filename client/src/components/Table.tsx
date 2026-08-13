export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}
