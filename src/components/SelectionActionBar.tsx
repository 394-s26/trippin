import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PencilIcon, TrashIcon, XIcon } from '../services/svgIcons';
import './SelectionActionBar.css';

interface SelectionActionBarProps {
  selectedCount: number;
  onEdit: () => void;
  selectedEventIds: string[];
  onDelete: () => void;
  onDeselectAll: () => void;
  canEdit: boolean;
  canDelete: boolean;
  canSuggestDelete?: boolean;
  scrollContainer: HTMLElement | null;
}

// Watches the DOM for any open overlay (modal / bottom sheet) so the selection
// bar can yield the screen while a modal is open.
const useOverlayPresent = (): boolean => {
  const [present, setPresent] = useState(false);
  useEffect(() => {
    const selector = '.overlay-bottom, .overlay-center';
    const check = () => {
      setPresent(document.querySelectorAll(selector).length > 0);
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return present;
};

const EDGE_MARGIN = 80;

function getAverageCenterY(ids: string[]): number | null {
  let sum = 0;
  let count = 0;
  for (const id of ids) {
    const el = document.querySelector(`[data-event-id="${id}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    sum += rect.top + rect.height / 2;
    count++;
  }
  return count > 0 ? sum / count : null;
}

const SelectionActionBar = ({
  selectedCount,
  onEdit,
  selectedEventIds,
  onDelete,
  onDeselectAll,
  canEdit,
  canDelete,
  canSuggestDelete = false,
  scrollContainer,
}: SelectionActionBarProps) => {
  const overlayOpen = useOverlayPresent();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const barHeightRef = useRef(0);

  // When an overlay opens while we have a selection, clear it so the bar
  // doesn't pop back after the overlay closes.
  useEffect(() => {
    if (overlayOpen && selectedCount > 0) onDeselectAll();
  }, [overlayOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const measureHeight = useCallback(() => {
    if (wrapperRef.current) {
      barHeightRef.current = wrapperRef.current.offsetHeight;
    }
  }, []);

  const updatePosition = useCallback(() => {
    const el = wrapperRef.current;
    if (!scrollContainer || !el || selectedEventIds.length === 0) return;

    const avgY = getAverageCenterY(selectedEventIds);
    if (avgY === null) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const barHeight = barHeightRef.current || el.offsetHeight;

    const visibleTop = Math.max(containerRect.top, 0);
    const visibleBottom = Math.min(containerRect.bottom, window.innerHeight);

    el.style.left = `${containerRect.left}px`;
    el.style.width = `${containerRect.width}px`;

    const desiredTop = avgY - barHeight / 2;

    let top: number;
    if (desiredTop < visibleTop + EDGE_MARGIN) {
      top = visibleTop + EDGE_MARGIN;
    } else if (desiredTop + barHeight > visibleBottom - EDGE_MARGIN) {
      top = visibleBottom - barHeight - EDGE_MARGIN;
    } else {
      top = desiredTop;
    }

    el.style.top = `${top}px`;
  }, [selectedEventIds, scrollContainer]);

  useEffect(() => {
    if (selectedEventIds.length === 0 || !scrollContainer) return;

    measureHeight();
    updatePosition();

    const onScroll = () => updatePosition();
    const onResize = () => {
      measureHeight();
      updatePosition();
    };
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [selectedEventIds, scrollContainer, updatePosition, measureHeight]);

  if (selectedEventIds.length === 0 || overlayOpen) return null;

  const editDisabled = !canEdit || selectedCount !== 1;
  const editTitle = !canEdit
    ? 'You do not have permission to edit events'
    : selectedCount !== 1
      ? 'Select a single event to edit'
      : undefined;

  const canDeleteSelection = canDelete || canSuggestDelete;
  const deleteLabel = canSuggestDelete && !canDelete ? 'Suggest Delete' : 'Delete';

  return createPortal(
    <div
      ref={wrapperRef}
      className="selection-bar-wrapper"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="selection-bar">
        <button
          onClick={onDeselectAll}
          className="selection-bar-btn selection-bar-btn--deselect"
          aria-label="Deselect all"
        >
          <span className="selection-bar-btn-label">Deselect All</span>
          <span className="selection-bar-btn-icon"><XIcon size={16} /></span>
        </button>

        <button
          onClick={onEdit}
          disabled={editDisabled}
          title={editTitle}
          className="selection-bar-btn selection-bar-btn--edit"
          aria-label="Edit event"
        >
          <span className="selection-bar-btn-label">Edit</span>
          <span className="selection-bar-btn-icon"><PencilIcon size={16} /></span>
        </button>

        <button
          onClick={onDelete}
          disabled={!canDeleteSelection}
          className="selection-bar-btn selection-bar-btn--delete"
          aria-label={deleteLabel}
        >
          <span className="selection-bar-btn-label">{deleteLabel}</span>
          <span className="selection-bar-btn-icon"><TrashIcon size={16} /></span>
        </button>
      </div>
    </div>,
    document.body
  );
};

export { SelectionActionBar };
