import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "./firebase"; // Ensure firebase is initialized in this file

const storage = getStorage(app);

export const uploadTripBanner = async (file: File): Promise<string> => {
  const storageRef = ref(storage, `tripBanners/${file.name}`);
  
  try {
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    throw new Error("Failed to upload trip banner: " + (error instanceof Error ? error.message : String(error)));
  }
};