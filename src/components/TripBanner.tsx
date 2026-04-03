import { useRef, useState } from 'react';
import { ImagePlusIcon, CalendarIcon, PencilIcon, CheckIcon, TrashIcon } from '../services/svgIcons';
import { uploadTripBanner } from '../services/storageService';
import TripShareBar from './TripShareBar';
import greenBg from '../images/green_bg.jpg';
import './TripBanner.css';

interface TripBannerProps {
  tripName: string;
  backgroundImage: string | null;
  dateRange: string;
  tripId: string;
  shared?: string[];
  isOwner?: boolean;
  onChangeName?: (url: string) => void;
  onChangeImage?: (url: string) => void;
  onChangeStartDate?: (date: Date) => void;
  onDelete?: () => void;
}

const TripBanner = ({ tripName, backgroundImage, dateRange, tripId, shared = [], isOwner = false, onChangeName, onChangeImage, onChangeStartDate, onDelete }: TripBannerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
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
      const url = await uploadTripBanner(file);
      onChangeImage(url);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value && onChangeStartDate) {
      onChangeStartDate(new Date(e.target.value + 'T00:00:00'));
    }
  };

  return (
    <div
      className="trip-banner"
      style={{ backgroundImage: `url(${backgroundImage ?? greenBg})` }}
    >
      <div className="trip-banner-overlay" />

      <TripShareBar shared={shared} tripId={tripId} isOwner={isOwner} />

      {onChangeImage && (
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
      {onDelete && (
        <button
          onClick={onDelete}
          aria-label="Delete trip"
          className="trip-banner-action-btn trip-banner-delete-btn"
        >
          <TrashIcon size={18} />
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
              {onChangeName && (
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
        <button
          onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
          className="trip-banner-date-btn"
          aria-label="Change start date"
        >
          <CalendarIcon size={14} />
          <span>{dateRange || 'None'}</span>
        </button>
        {onChangeStartDate && (
          <input
            ref={dateInputRef}
            type="date"
            className="trip-banner-date-input"
            onChange={handleDateChange}
          />
        )}
      </div>
    </div>
  );
};

export default TripBanner;
