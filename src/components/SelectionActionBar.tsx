import { PencilIcon, TrashIcon, XIcon } from '../services/svgIcons';
import './SelectionActionBar.css';

interface SelectionActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onDeselectAll: () => void;
  canDelete: boolean;
  canSuggestDelete?: boolean;
}

const SelectionActionBar = ({ selectedCount, onDelete, onDeselectAll, canDelete, canSuggestDelete = false }: SelectionActionBarProps) => {
  if (selectedCount === 0) return null;
  const canDeleteSelection = canDelete || canSuggestDelete;
  const deleteLabel = canDelete ? 'Delete' : 'Suggest Delete';

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
          disabled={!canDeleteSelection}
          className="selection-bar-btn selection-bar-btn--delete"
          aria-label={deleteLabel}
        >
          <TrashIcon size={16} />
          {deleteLabel}
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
