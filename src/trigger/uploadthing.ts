import { UTApi } from "uploadthing/server";

const utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN });

/**
 * Upload an image buffer to UploadThing and return the public URL.
 * @param imageBuffer Buffer containing image data (PNG recommended)
 * @param filename Name for the uploaded file
 * @returns URL to the uploaded image
 */
export async function uploadToUploadThing(imageBuffer: Buffer, filename: string): Promise<string> {
  if (!process.env.UPLOADTHING_TOKEN) throw new Error("UPLOADTHING_TOKEN is not set");

  let file: File;
  try {
    file = new File([imageBuffer], filename, { type: "image/png" });
  } catch (e) {
    throw e;
  }

  let response;
  try {
    response = await utapi.uploadFiles(file);
  } catch (err) {
    throw err;
  }

  const fileUrl = response?.data?.ufsUrl;
  if (!fileUrl) {
    throw new Error("UploadThing did not return a file URL");
  }
  return fileUrl;
}

