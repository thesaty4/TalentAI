import { Button } from './Button';

export function Pagination({ page, pages, onChange }: {
  page: number; pages: number; onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-secure-gray">
      <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Prev
      </Button>
      <span>Page {page} of {pages}</span>
      <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next →
      </Button>
    </div>
  );
}
