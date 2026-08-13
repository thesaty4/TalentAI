import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { Avatar } from '../../components/Card';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { cn } from '../../lib/utils/cn';
import { PIPELINE_STAGES } from '../../lib/constants/pipeline.constants';
import type { PipelineEntry } from '../../lib/api/pipeline.api';

const NOT_FIT_REASONS = [
  'Not enough domain exposure', 'Wrong location',
  "Availability doesn't work", 'Level mismatch', 'Already staffed elsewhere',
] as const;

interface Props {
  entry:     PipelineEntry;
  onAdvance: (id: number, stage: string) => void;
  onRevert:  (id: number, stage: string, note?: string) => void;
  onNotFit:  (id: number, reason: string) => void;
}

export function PipelineCard({ entry, onAdvance, onRevert, onNotFit }: Props) {
  const navigate   = useNavigate();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [revertModal, setRevertModal] = useState(false);
  const [notFitModal, setNotFitModal] = useState(false);
  const [revertNote,  setRevertNote]  = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [busy, setBusy] = useState(false);

  const stageIdx  = PIPELINE_STAGES.indexOf(entry.stage as any);
  const nextStage = stageIdx < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[stageIdx + 1] : null;
  const prevStage = stageIdx > 0 ? PIPELINE_STAGES[stageIdx - 1] : null;

  function handleAdvance() {
    setMenuOpen(false);
    if (nextStage && !busy) { setBusy(true); onAdvance(entry.id, nextStage); }
  }
  function openRevert() { setMenuOpen(false); setRevertNote(''); setRevertModal(true); }
  function openNotFit()    { setMenuOpen(false); setSelectedReason(''); setNotFitModal(true); }

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-white p-3 shadow-xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Avatar name={entry.employee.fullName} className="mt-0.5 h-7 w-7 shrink-0 text-[10px]" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <p className="truncate text-sm font-medium text-network-blue">{entry.employee.fullName}</p>
              {entry.matchPct != null && (
                <span className="shrink-0 text-[10px] font-semibold text-celestial-blue">{entry.matchPct}%</span>
              )}
            </div>
            <p className="truncate text-xs text-[var(--fg-3)]">{entry.employee.roleTitle}</p>
          </div>
        </div>
        {/* Action menu */}
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen(o => !o)} className="rounded p-1 hover:bg-culture-gray text-secure-gray">
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-[var(--border-subtle)] bg-white py-1 shadow-md text-xs">
              <button onClick={() => { navigate(`/employees/${entry.employee.id}`); setMenuOpen(false); }}
                className="block w-full px-3 py-1.5 text-left hover:bg-culture-gray">View profile</button>
              {nextStage && entry.stage !== 'Allocated' && (
                <button onClick={handleAdvance}
                  className="block w-full px-3 py-1.5 text-left text-commerce-green hover:bg-culture-gray">
                  Advance → {nextStage}
                </button>
              )}
              {prevStage && (
                <button onClick={openRevert}
                  className="block w-full px-3 py-1.5 text-left hover:bg-culture-gray">
                  Revert ← {prevStage}
                </button>
              )}
              <button onClick={() => { setMenuOpen(false); }}
                className="block w-full px-3 py-1.5 text-left hover:bg-culture-gray">Schedule screening</button>
              <button onClick={openNotFit}
                className="block w-full px-3 py-1.5 text-left text-power-orange hover:bg-culture-gray">Not a fit</button>
            </div>
          )}
        </div>
      </div>

      {/* ← IRC → full-width stage navigation */}
      <div className="mt-2 flex w-full items-center justify-between">
        {/* ← Previous stage */}
        <button
          disabled={!prevStage || busy || entry.stage === 'Rejected'}
          onClick={openRevert}
          title={prevStage ? `Revert to ${prevStage}` : 'No previous stage'}
          className={cn('flex h-6 w-6 items-center justify-center rounded text-secure-gray transition-colors',
            prevStage && !busy && entry.stage !== 'Rejected' ? 'hover:bg-culture-gray hover:text-network-blue' : 'opacity-30'
          )}>
          <ChevronLeft size={14} />
        </button>

        {/* IRC code — centred */}
        <span className="rounded border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-medium text-secure-gray">
          {entry.irc.ircCode}
        </span>

        {/* → Next stage */}
        <button
          disabled={!nextStage || busy || entry.stage === 'Allocated' || entry.stage === 'Rejected'}
          onClick={handleAdvance}
          title={nextStage ? `Advance to ${nextStage}` : 'No next stage'}
          className={cn('flex h-6 w-6 items-center justify-center rounded text-secure-gray transition-colors',
            nextStage && !busy && entry.stage !== 'Allocated' && entry.stage !== 'Rejected' ? 'hover:bg-culture-gray hover:text-commerce-green' : 'opacity-30'
          )}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Revert modal — R13 */}
      <Modal open={revertModal} onClose={() => setRevertModal(false)}
        title={`Revert ${entry.employee.fullName.split(' ')[0]}?`}>
        <p className="mb-3 text-sm text-secure-gray">
          This will move <strong>{entry.employee.fullName}</strong> back to <strong>{prevStage}</strong>.
          This decision may already have been communicated. Continue?
        </p>
        <textarea value={revertNote} onChange={e => setRevertNote(e.target.value)} rows={2}
          placeholder="Optional note…"
          className="mb-4 w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-celestial-blue focus:outline-none" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRevertModal(false)}>Cancel</Button>
          <Button size="sm" variant="danger" onClick={() => { setRevertModal(false); if (prevStage) onRevert(entry.id, prevStage, revertNote || undefined); }}>
            Revert
          </Button>
        </div>
      </Modal>

      {/* Not-a-fit modal — R14 */}
      <Modal open={notFitModal} onClose={() => setNotFitModal(false)} title="Mark as not a fit">
        <p className="mb-3 text-sm text-secure-gray">Select a reason:</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {NOT_FIT_REASONS.map(r => (
            <button key={r} onClick={() => setSelectedReason(r)}
              className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors',
                selectedReason === r ? 'border-power-orange bg-power-orange/10 text-power-orange' : 'border-[var(--border-default)] text-secure-gray')}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setNotFitModal(false)}>Cancel</Button>
          <Button size="sm" variant="danger" disabled={!selectedReason}
            onClick={() => { setNotFitModal(false); if (selectedReason) onNotFit(entry.id, selectedReason); }}>
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}
