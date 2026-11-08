import imagekit from "./imageKit";

const uploadToImagekit = async (fileBuffer: Buffer, fileName: string) => {
  try {
    const response = await imagekit.upload({
      file: fileBuffer, // Node Buffer
      fileName: fileName,
    });

    return response;
  } catch (error: any) {
    throw new Error(`ImageKit error: ${error?.message || "Upload failed"}`);
  }
};
export default uploadToImagekit;