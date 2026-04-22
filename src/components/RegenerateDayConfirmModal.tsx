interface RegenerateDayConfirmModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  submitting?: boolean;
}

const RegenerateDayConfirmModal = ({
  isOpen,
  onCancel,
  onConfirm,
  submitting,
}: RegenerateDayConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="overlay-center" onClick={onCancel}>
      <div
        className="overlay-panel overlay-panel--sm rounded-2xl p-6 shadow-xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-3">
          Auto-generate and replace existing day plan
        </h2>
        <p className="text-gray-600 mb-6">
          This will regenerate an itinerary for you. It will remove any existing
          places. Do you want to continue?
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="w-full py-3 rounded-full bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Working…' : 'Yes, continue'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full text-gray-500 font-semibold hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default RegenerateDayConfirmModal;
