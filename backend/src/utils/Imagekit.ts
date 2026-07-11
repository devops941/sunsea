import fs from "fs";
import { ApiError } from "./ApiError";

/**
 * Uploads a file to ImageKit and returns the resulting file URL.
 *
 * Reusable across modules — pass a different `folder` for each use case
 * (company logos, product images, user avatars, etc.).
 *
 * @param filePath  Absolute path to the file on disk (e.g. from multer's req.file.path)
 * @param fileName  Name to give the file in ImageKit (e.g. req.file.originalname or a generated name)
 * @param folder    ImageKit folder path, e.g. "/company-logos" or "/products"
 */
export async function uploadToImageKit(
    filePath: string,
    fileName: string,
    folder: string
): Promise<string> {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

    if (!privateKey) {
        throw new ApiError(500, "ImageKit private key is not configured in backend .env file");
    }

    const token = Buffer.from(`${privateKey}:`).toString("base64");

    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, fileName);
    formData.append("fileName", fileName);
    formData.append("folder", folder);

    try {
        const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
            method: "POST",
            headers: {
                Authorization: `Basic ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("ImageKit upload error response:", errText);
            throw new ApiError(500, `ImageKit upload failed: ${response.statusText}`);
        }

        const result = (await response.json()) as any;
        return result.url;
    } catch (err: any) {
        console.error("ImageKit upload error:", err);
        throw new ApiError(500, err?.message || "Failed to upload image to ImageKit");
    }
}