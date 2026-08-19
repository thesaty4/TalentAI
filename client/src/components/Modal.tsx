export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-md">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-network-blue">{title}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-sm text-secure-gray transition-colors hover:bg-culture-gray">✕</button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
