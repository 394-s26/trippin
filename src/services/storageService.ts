import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "./firebase";

const storage = getStorage(app);

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
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const storageRef = ref(storage, `users/${uid}/profile.${extension}`);

  try {
    await uploadBytes(storageRef, file, { contentType: file.type || undefined });
    return await getDownloadURL(storageRef);
  } catch (error) {
    throw new Error("Failed to upload profile photo: " + (error instanceof Error ? error.message : String(error)));
  }
};
