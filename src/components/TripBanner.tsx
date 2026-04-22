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
  canChangeStartDate?: boolean;
  canDelete?: boolean;
  canManageMembers?: boolean;
  canRemoveMembers?: boolean;
  canChangeRole?: boolean;
  onChangeName?: (url: string) => void;
  onChangeImage?: (url: string) => void;
  onChangeStartDate?: (date: Date) => void;
  onChangeEndDate?: (date: Date) => void;
  onDelete?: () => void;
}

const TripBanner = ({
  tripName, backgroundImage, dateRange, startDate, endDate, tripId, ownerId, shared = [],
  permissions = {},
  canChangeName = false, canChangeBanner = false, canChangeStartDate = false,
  canDelete = false, canManageMembers = false, canRemoveMembers = false, canChangeRole = false,
  onChangeName, onChangeImage, onChangeStartDate, onChangeEndDate, onDelete,
}: TripBannerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value && onChangeStartDate) {
      const nextStart = new Date(e.target.value + 'T00:00:00');
      if (endDate && nextStart > endDate) return;
      onChangeStartDate(nextStart);
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value && onChangeEndDate) {
      onChangeEndDate(new Date(e.target.value + 'T00:00:00'));
    }
  };

  const toInputDate = (d?: Date) => {
    if (!d) return '';
    const normalized = new Date(d);
    normalized.setHours(0, 0, 0, 0);
    return normalized.toISOString().slice(0, 10);
  };

  const formatShortDate = (d?: Date) => {
    if (!d) return 'None';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
                onKeyDown={e => { if (e.key === 'Enter') commitNameEdit(); if (e.key === 'Escape') setIsEditingName(false); }}
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
                  style={{marginRight: '12px'}}
                >
                  <PencilIcon size={20} />
                </button>
              )}
            </>
          )}
        </div>
        {canChangeStartDate ? (
          <>
            <div className="trip-banner-date-row">
              <button
                onClick={() => startDateInputRef.current?.showPicker?.() ?? startDateInputRef.current?.click()}
                className="trip-banner-date-btn"
                aria-label="Change start date"
                type="button"
              >
                <CalendarIcon size={14} />
                <span>{formatShortDate(startDate)}</span>
              </button>
              <span className="trip-banner-date-separator" aria-hidden="true">-</span>
              <button
                onClick={() => endDateInputRef.current?.showPicker?.() ?? endDateInputRef.current?.click()}
                className="trip-banner-date-btn"
                aria-label="Change end date"
                type="button"
              >
                <CalendarIcon size={14} />
                <span>{formatShortDate(endDate)}</span>
              </button>
            </div>
            <input
              ref={startDateInputRef}
              type="date"
              className="trip-banner-date-input"
              value={toInputDate(startDate)}
              max={toInputDate(endDate)}
              onChange={handleDateChange}
            />
            <input
              ref={endDateInputRef}
              type="date"
              className="trip-banner-date-input"
              value={toInputDate(endDate)}
              min={toInputDate(startDate)}
              onChange={handleEndDateChange}
            />
          </>
        ) : (
          <div className="trip-banner-date-btn trip-banner-date-btn--readonly">
            <CalendarIcon size={14} />
            <span>{dateRange || 'None'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripBanner;
