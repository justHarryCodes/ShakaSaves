import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadResult {
  url: string;
  publicId: string;
}

export async function uploadImage(
  buffer: Buffer,
  folder: string,
  publicId?: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const opts: Record<string, unknown> = {
      folder,
      resource_type: "image",
      ...(publicId ? { public_id: publicId } : {}),
    };

    cloudinary.uploader
      .upload_stream(opts, (error, result) => {
        if (error || !result) return reject(error ?? new Error("Upload failed"));
        resolve({ url: result.secure_url, publicId: result.public_id });
      })
      .end(buffer);
  });
}

export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

export function getSignedDownloadUrl(publicId: string): string {
  return cloudinary.url(publicId, {
    resource_type: "image",
    type: "upload",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    flags: "attachment",
    sign_url: true,
  });
}

export async function uploadPdf(buffer: Buffer, folder: string): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder, resource_type: "raw", format: "pdf" },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("PDF upload failed"));
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      )
      .end(buffer);
  });
}
