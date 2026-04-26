interface UpgradeRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UpgradeRoleModal = ({ isOpen, onClose }: UpgradeRoleModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="overlay-center" onClick={onClose}>
      <div
        className="overlay-panel overlay-panel--sm rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-2">Auto-fill is for managers</h2>
        <p className="text-gray-600 mb-6">
          Auto-filling a day is restricted to trip managers and owners. Ask your trip
          owner to upgrade your role to continue.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-full bg-primary text-white font-semibold hover:bg-primary-light transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

export default UpgradeRoleModal;
