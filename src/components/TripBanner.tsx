import { useRef, useState } from 'react';
import { ImagePlusIcon, CalendarIcon, PencilIcon, CheckIcon, TrashIcon } from '../services/svgIcons';
import { uploadTripBanner } from '../services/storageService';
import TripShareBar from './TripShareBar';
import greenBg from '../images/green_bg.jpg';
import { Role } from '../config/permissions';
import './TripBanner.css';

interface TripBannerProps {
  tripName: string;
  backgroundImage: string | null;
  dateRange: string;
  startDate?: Date;
  endDate?: Date;
  tripId: string;
  ownerId?: string;
  shared?: string[];
  permissions?: Record<string, Role>;
  canChangeName?: boolean;
  canChangeBanner?: boolean;
  canChangeDates?: boolean;
  canDelete?: boolean;
  canManageMembers?: boolean;
  canRemoveMembers?: boolean;
  canChangeRole?: boolean;
  onChangeName?: (name: string) => void;
  onChangeImage?: (url: string) => void;
  onOpenDatePicker?: () => void;
  onDelete?: () => void;
}

const TripBanner = ({
  tripName, backgroundImage, dateRange, tripId, ownerId, shared = [],
  permissions = {},
  canChangeName = false, canChangeBanner = false, canChangeDates = false,
  canDelete = false, canManageMembers = false, canRemoveMembers = false, canChangeRole = false,
  onChangeName, onChangeImage, onOpenDatePicker, onDelete,
}: TripBannerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(tripName);

  const commitNameEdit = () => {
    const trimmed = editNameValue.trim();
    if (trimmed && trimmed !== tripName) onChangeName?.(trimmed);
    setIsEditingName(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onChangeImage) {
      const url = await uploadTripBanner(file, tripId);
      onChangeImage(url);
    }
  };

  return (
    <div
      className="trip-banner"
      style={{ backgroundImage: `url(${backgroundImage ?? greenBg})` }}
    >
      <div className="trip-banner-overlay" />

      <TripShareBar
        shared={shared}
        tripId={tripId}
        tripName={tripName}
        ownerId={ownerId}
        permissions={permissions}
        canInvite={canManageMembers}
        canRemove={canRemoveMembers}
        canChangeRole={canChangeRole}
      />

      {canChangeBanner && onChangeImage && (
        <>
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Change banner image"
            className="trip-banner-action-btn trip-banner-change-btn"
          >
            <ImagePlusIcon />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </>
      )}
      {canDelete && onDelete && (
        <button
          onClick={onDelete}
          aria-label="Delete trip"
          className="trip-banner-action-btn trip-banner-delete-btn"
        >
          <TrashIcon size={16} />
          <span>Delete</span>
        </button>
      )}

      <div className="trip-banner-content">
        <div className="trip-banner-title-row">
          {isEditingName ? (
            <>
              <input
                className="trip-banner-title-input"
                value={editNameValue}
                onChange={e => setEditNameValue(e.target.value)}
                onBlur={commitNameEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitNameEdit();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                autoFocus
              />
              <button onClick={commitNameEdit} className="trip-banner-name-edit-btn trip-banner-name-confirm-btn" aria-label="Confirm name">
                <CheckIcon size={18} />
              </button>
            </>
          ) : (
            <>
              <h1 className="trip-banner-title">{tripName}</h1>
              {canChangeName && onChangeName && (
                <button
                  onClick={() => { setEditNameValue(tripName); setIsEditingName(true); }}
                  className="trip-banner-name-edit-btn"
                  aria-label="Edit trip name"
                >
                  <PencilIcon size={20} />
                </button>
              )}
            </>
          )}
        </div>
        {canChangeDates ? (
          <button
            onClick={onOpenDatePicker}
            className="trip-banner-date-btn"
            aria-label="Change trip dates"
            type="button"
          >
            <CalendarIcon size={14} />
            <span>{dateRange || 'None'}</span>
          </button>
        ) : (
          <div className="trip-banner-date-btn">
            <CalendarIcon size={14} />
            <span>{dateRange || 'None'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripBanner;
