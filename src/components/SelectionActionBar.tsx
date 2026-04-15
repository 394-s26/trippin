import { useEffect, useState } from 'react';
import { PencilIcon, TrashIcon, XIcon } from '../services/svgIcons';
import './SelectionActionBar.css';

interface SelectionActionBarProps {
  selectedCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onDeselectAll: () => void;
  canEdit: boolean;
  canDelete: boolean;
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

const SelectionActionBar = ({ selectedCount, onEdit, onDelete, onDeselectAll, canEdit, canDelete }: SelectionActionBarProps) => {
  const overlayOpen = useOverlayPresent();

  // When an overlay opens while we have a selection, clear it so the bar
  // doesn't pop back after the overlay closes.
  useEffect(() => {
    if (overlayOpen && selectedCount > 0) onDeselectAll();
  }, [overlayOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (selectedCount === 0 || overlayOpen) return null;

  const editDisabled = !canEdit || selectedCount !== 1;
  const editTitle = !canEdit
    ? 'You do not have permission to edit events'
    : selectedCount !== 1
      ? 'Select a single event to edit'
      : undefined;

  return (
    <div className="selection-bar-wrapper">
      <div className="selection-bar overlay-panel overlay-panel--md rounded-t-2xl animate-slide-up">
        <button
          onClick={onEdit}
          disabled={editDisabled}
          title={editTitle}
          className="selection-bar-btn selection-bar-btn--edit"
          aria-label="Edit event"
        >
          <PencilIcon size={16} />
          Edit
        </button>

        <button
          onClick={onDelete}
          disabled={!canDelete}
          className="selection-bar-btn selection-bar-btn--delete"
          aria-label="Delete selected events"
        >
          <TrashIcon size={16} />
          Delete
        </button>

        <button
          onClick={onDeselectAll}
          className="selection-bar-btn selection-bar-btn--deselect"
          aria-label="Deselect all"
        >
          <XIcon size={16} />
          Deselect All
        </button>
      </div>
    </div>
  );
};

export { SelectionActionBar };
