import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";
import { storage } from "./firebase";

export const uploadTripBanner = async (file: File, tripId: string): Promise<string> => {
  const storageRef = ref(storage, `tripBanners/${tripId}/${file.name}`);
  
  try {
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    throw new Error("Failed to upload trip banner: " + (error instanceof Error ? error.message : String(error)));
  }
};

export const uploadUserAvatar = async (uid: string, file: File): Promise<string> => {
  const lastDot = file.name.lastIndexOf('.');
  const rawExt = lastDot >= 0 ? file.name.slice(lastDot + 1) : '';
  const normalizedExt = rawExt.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const extension = normalizedExt || 'jpg';
  const storageRef = ref(storage, `users/${uid}/profile.${extension}`);

  try {
    await uploadBytes(storageRef, file, { contentType: file.type || undefined });
    return await getDownloadURL(storageRef);
  } catch (error) {
    throw new Error("Failed to upload profile photo: " + (error instanceof Error ? error.message : String(error)));
  }
};

export const deleteTripBanners = async (tripId: string): Promise<void> => {
  try {
    const folderRef = ref(storage, `tripBanners/${tripId}`);
    const { items } = await listAll(folderRef);
    await Promise.allSettled(items.map((item) => deleteObject(item)));
  } catch {
    // Ignore if folder doesn't exist or rules deny listing.
  }
};

export const deleteUserAvatars = async (uid: string): Promise<void> => {
  // Avoid Storage `listAll` (requires broader rules / extra queries). Avatars are uploaded as `profile.<ext>`.
  const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
  await Promise.allSettled(
    extensions.map(async (ext) => {
      try {
        await deleteObject(ref(storage, `users/${uid}/profile.${ext}`));
      } catch {
        // Ignore missing-file errors.
      }
    })
  );
};
