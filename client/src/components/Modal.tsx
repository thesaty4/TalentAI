export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-network-blue">{title}</h2>
          <button onClick={onClose} className="text-[var(--fg-3)] hover:text-network-blue">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
