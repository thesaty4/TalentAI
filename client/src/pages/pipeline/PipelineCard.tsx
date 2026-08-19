import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MessageSquare, MoreVertical } from 'lucide-react';
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

const RECOMMENDATIONS = ['Strong yes', 'Yes', 'Maybe'] as const;

interface Props {
  entry:           PipelineEntry;
  onAdvance:       (id: number, stage: string) => void;
  onRevert:        (id: number, stage: string, note?: string) => void;
  onNotFit:        (id: number, reason: string) => void;
  onAddFeedback:   (id: number, roundName: string, comments: string, rating?: string) => Promise<unknown>;
  onViewHistory:   (id: number) => void;
}

export function PipelineCard({ entry, onAdvance, onRevert, onNotFit, onAddFeedback, onViewHistory }: Props) {
  const navigate   = useNavigate();
  const menuRef    = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [revertModal, setRevertModal]   = useState(false);
  const [notFitModal, setNotFitModal]   = useState(false);
  const [revertNote,  setRevertNote]    = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const [busy, setBusy]                 = useState(false);
  // Stage-advance feedback state
  const [feedbackModal, setFeedbackModal]   = useState(false);
  const [feedbackText, setFeedbackText]     = useState('');
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackError, setFeedbackError]   = useState('');
  const [feedbackBusy, setFeedbackBusy]     = useState(false);

  // Reset busy when stage changes (optimistic update resolved)
  useEffect(() => { setBusy(false); }, [entry.stage, entry.id]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Rejected is a terminal state reached only via explicit rejection — not part of sequential advance
  const ADVANCE_STAGES = PIPELINE_STAGES.filter(s => s !== 'Rejected');
  const advanceIdx = ADVANCE_STAGES.indexOf(entry.stage as any);
  const nextStage = advanceIdx >= 0 && advanceIdx < ADVANCE_STAGES.length - 1 ? ADVANCE_STAGES[advanceIdx + 1] : null;
  const stageIdx  = PIPELINE_STAGES.indexOf(entry.stage as any);
  const prevStage = stageIdx > 0 ? PIPELINE_STAGES[stageIdx - 1] : null;

  // Open feedback capture modal instead of advancing immediately
  function handleAdvance() {
    setMenuOpen(false);
    if (nextStage && !busy) {
      setFeedbackText('');
      setFeedbackRating('');
      setFeedbackError('');
      setFeedbackModal(true);
    }
  }

  async function handleFeedbackSubmit() {
    if (!feedbackText.trim()) {
      setFeedbackError('Feedback is required before advancing.');
      return;
    }
    setFeedbackBusy(true);
    try {
      await onAddFeedback(entry.id, entry.stage, feedbackText.trim(), feedbackRating || undefined);
      setFeedbackModal(false);
      setBusy(true);
      onAdvance(entry.id, nextStage!);
    } catch {
      setFeedbackError('Failed to save feedback. Please try again.');
    } finally {
      setFeedbackBusy(false);
    }
  }
  function openRevert() {
    if (busy) return;
    setMenuOpen(false); setRevertNote(''); setRevertModal(true);
  }
  function openNotFit() {
    if (busy) return;
    setMenuOpen(false); setSelectedReason(''); setNotFitModal(true);
  }

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-white p-3 shadow-xs">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Avatar name={entry.employee.fullName} className="mt-0.5 h-7 w-7 shrink-0 text-[10px]" />
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <p className="truncate text-sm font-medium text-network-blue">{entry.employee.fullName}</p>
              {entry.matchPct != null && (
                <span className={`shrink-0 text-[10px] font-semibold ${
                  entry.matchPct >= 70 ? 'text-commerce-green' :
                  entry.matchPct >= 50 ? 'text-celestial-blue' : 'text-secure-gray'
                }`}>{entry.matchPct}%</span>
              )}
            </div>
            <p className="truncate text-xs text-[var(--fg-3)]">{entry.employee.roleTitle}</p>
          </div>
        </div>
        {/* Action menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button onClick={() => !busy && setMenuOpen(o => !o)} disabled={busy} className={cn('rounded p-1 text-secure-gray', busy ? 'opacity-40 cursor-not-allowed' : 'hover:bg-culture-gray')}>
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-44 rounded-lg border border-[var(--border-subtle)] bg-white py-1 shadow-md text-xs">
              <button onClick={() => { navigate(`/employees/${entry.employee.id}`); setMenuOpen(false); }}
                className="block w-full px-3 py-1.5 text-left hover:bg-culture-gray">View profile</button>
              {nextStage && (
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
              <button onClick={() => { setMenuOpen(false); onViewHistory(entry.id); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-culture-gray">
                <MessageSquare size={11} className="text-secure-gray" /> View feedback history
              </button>
              <button onClick={() => { setMenuOpen(false); }}
                className="block w-full px-3 py-1.5 text-left hover:bg-culture-gray">Schedule screening</button>
              {entry.stage !== 'Rejected' && (
                <>
                  <div className="my-1 border-t border-[var(--border-subtle)]" />
                  <button onClick={openNotFit}
                    className="block w-full px-3 py-1.5 text-left font-medium text-power-orange hover:bg-power-orange/5">Reject candidate</button>
                </>
              )}
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
          disabled={!nextStage || busy || entry.stage === 'Rejected'}
          onClick={handleAdvance}
          title={nextStage ? `Advance to ${nextStage}` : 'No next stage'}
          className={cn('flex h-6 w-6 items-center justify-center rounded text-secure-gray transition-colors',
            nextStage && !busy && entry.stage !== 'Rejected' ? 'hover:bg-culture-gray hover:text-commerce-green' : 'opacity-30'
          )}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Stage-advance feedback modal — mandatory before completing a forward move */}
      <Modal open={feedbackModal} onClose={() => setFeedbackModal(false)} title="Stage feedback">
        <p className="mb-1 text-sm text-secure-gray">
          <strong>{entry.employee.fullName}</strong> · {entry.irc.ircCode}
        </p>
        <p className="mb-4 text-xs text-[var(--fg-3)]">
          {entry.stage} &rarr; {nextStage}
        </p>
        {/* Optional recommendation */}
        <div className="mb-3 flex flex-wrap gap-2">
          {RECOMMENDATIONS.map(r => (
            <button key={r} type="button"
              onClick={() => setFeedbackRating(prev => prev === r ? '' : r)}
              className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors',
                feedbackRating === r
                  ? 'border-power-orange bg-power-orange/10 text-power-orange'
                  : 'border-[var(--border-default)] text-secure-gray')}>
              {r}
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          value={feedbackText}
          onChange={e => { setFeedbackText(e.target.value); if (e.target.value.trim()) setFeedbackError(''); }}
          placeholder="Feedback for this stage… (required)"
          className={cn(
            'mb-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none',
            feedbackError
              ? 'border-power-orange focus:border-power-orange'
              : 'border-[var(--border-default)] focus:border-power-orange',
          )}
        />
        {feedbackError && (
          <p className="mb-3 text-xs text-power-orange">{feedbackError}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setFeedbackModal(false)}>Cancel</Button>
          <Button size="sm" disabled={feedbackBusy} onClick={handleFeedbackSubmit}>
            {feedbackBusy ? 'Saving…' : `Advance → ${nextStage}`}
          </Button>
        </div>
      </Modal>

      {/* Revert modal — R13 */}
      <Modal open={revertModal} onClose={() => setRevertModal(false)}
        title={`Revert ${entry.employee.fullName.split(' ')[0]}?`}>
        <p className="mb-3 text-sm text-secure-gray">
          This will move <strong>{entry.employee.fullName}</strong> back to <strong>{prevStage}</strong>.
          This decision may already have been communicated. Continue?
        </p>
        <textarea value={revertNote} onChange={e => setRevertNote(e.target.value)} rows={2}
          placeholder="Optional note…"
          className="mb-4 w-full rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm focus:border-power-orange focus:outline-none" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRevertModal(false)}>Cancel</Button>
          <Button size="sm" variant="danger" onClick={() => { setRevertModal(false); if (prevStage) onRevert(entry.id, prevStage, revertNote || undefined); }}>
            Revert
          </Button>
        </div>
      </Modal>

      {/* Not-a-fit modal — R14 */}
      <Modal open={notFitModal} onClose={() => setNotFitModal(false)} title="Reject candidate">
        <p className="mb-3 text-sm text-secure-gray">Optionally select a reason:</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {NOT_FIT_REASONS.map(r => (
            <button key={r} onClick={() => setSelectedReason(prev => prev === r ? '' : r)}
              className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors',
                selectedReason === r ? 'border-power-orange bg-power-orange/10 text-power-orange' : 'border-[var(--border-default)] text-secure-gray')}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setNotFitModal(false)}>Cancel</Button>
          <Button size="sm" variant="danger"
            onClick={() => { setNotFitModal(false); onNotFit(entry.id, selectedReason || 'Rejected'); }}>
            Confirm reject
          </Button>
        </div>
      </Modal>
    </div>
  );
}
