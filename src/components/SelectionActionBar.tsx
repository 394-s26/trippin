import { PencilIcon, TrashIcon, XIcon } from '../services/svgIcons';
import './SelectionActionBar.css';

interface SelectionActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onDeselectAll: () => void;
  canDelete: boolean;
}

const SelectionActionBar = ({ selectedCount, onDelete, onDeselectAll, canDelete }: SelectionActionBarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div className="selection-bar-wrapper">
      <div className="selection-bar overlay-panel overlay-panel--md rounded-t-2xl animate-slide-up">
        <button
          disabled
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
