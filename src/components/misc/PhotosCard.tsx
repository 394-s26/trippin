import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppUser } from '../../types/auth';
import { TripPhoto, deleteTripPhoto, uploadTripPhoto } from '../../services/firestoreMiscService';
import { ImagePlusIcon, TrashIcon, XIcon } from '../../services/svgIcons';
import './PhotosCard.css';

interface PhotosCardProps {
  tripId: string;
  currentUid: string | null;
  photos: TripPhoto[];
  tripUsers: AppUser[];
}

const PhotosCard = ({ tripId, currentUid, photos, tripUsers }: PhotosCardProps) => {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerPhoto, setViewerPhoto] = useState<TripPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewPhotos = photos.slice(0, 3);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentUid) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadTripPhoto(tripId, currentUid, files[i]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photo: TripPhoto) => {
    if (!currentUid) return;
    setError(null);
    try {
      await deleteTripPhoto(photo, currentUid);
      if (viewerPhoto?.id === photo.id) setViewerPhoto(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const uploaderName = (uid: string): string => {
    const u = tripUsers.find((x) => x.uid === uid);
    if (!u) return 'Unknown';
    return `${u.firstName} ${u.lastName}`.trim() || u.username || 'Unknown';
  };

  return (
    <>
      <button
        type="button"
        className="misc-card misc-card--photos"
        onClick={() => setOpen(true)}
        aria-label="Open trip photos"
      >
        <div className="misc-card-header">
          <span className="misc-card-title">PHOTOS</span>
          <span className="misc-card-count">{photos.length}</span>
        </div>
        <div className="misc-card-preview">
          {previewPhotos.length === 0 ? (
            <div className="misc-card-preview-empty">
              <ImagePlusIcon size={24} />
            </div>
          ) : (
            previewPhotos.map((p) => (
              <img
                key={p.id}
                src={p.url}
                alt=""
                className="misc-card-preview-img"
                loading="lazy"
              />
            ))
          )}
        </div>
      </button>

      {open && createPortal(
        <div className="overlay-bottom">
          <div className="overlay-scrim" onClick={() => setOpen(false)} />
          <div className="overlay-panel overlay-panel--md rounded-t-2xl p-5 pb-8 flex flex-col gap-4 animate-slide-up misc-modal">
            <div className="misc-modal-header">
              <h2 className="misc-modal-title">Trip Photos</h2>
              <button
                type="button"
                className="misc-modal-close"
                onClick={() => setOpen(false)}
                aria-label="Close photos"
              >
                <XIcon size={20} />
              </button>
            </div>

            <div className="misc-photos-toolbar">
              <button
                type="button"
                className="misc-photos-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !currentUid}
              >
                <ImagePlusIcon size={16} />
                <span>{uploading ? 'Uploading…' : 'Upload'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUpload}
              />
            </div>

            {error && <div className="misc-photos-error">{error}</div>}

            {photos.length === 0 ? (
              <div className="misc-photos-empty">No photos yet. Upload the first one!</div>
            ) : (
              <div className="misc-photos-grid">
                {photos.map((p) => (
                  <div key={p.id} className="misc-photos-grid-item">
                    <button
                      type="button"
                      className="misc-photos-grid-btn"
                      onClick={() => setViewerPhoto(p)}
                      aria-label={`Photo by ${uploaderName(p.uploaderUid)}`}
                    >
                      <img src={p.url} alt="" loading="lazy" />
                    </button>
                    <div className="misc-photos-grid-meta">
                      <span className="misc-photos-grid-uploader">
                        {uploaderName(p.uploaderUid)}
                      </span>
                      {p.uploaderUid === currentUid && (
                        <button
                          type="button"
                          className="misc-photos-delete-btn"
                          onClick={() => handleDelete(p)}
                          aria-label="Delete photo"
                        >
                          <TrashIcon size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {viewerPhoto && createPortal(
        <div className="overlay-center misc-photo-viewer">
          <div className="overlay-scrim" onClick={() => setViewerPhoto(null)} />
          <div className="misc-photo-viewer-panel">
            <button
              type="button"
              className="misc-photo-viewer-close"
              onClick={() => setViewerPhoto(null)}
              aria-label="Close photo"
            >
              <XIcon size={22} />
            </button>
            <img src={viewerPhoto.url} alt="" className="misc-photo-viewer-img" />
            <div className="misc-photo-viewer-caption">
              Uploaded by {uploaderName(viewerPhoto.uploaderUid)}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default PhotosCard;
