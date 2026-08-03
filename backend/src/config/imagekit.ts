import ImageKit from 'imagekit';

const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY  || '',
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',
});

/**
 * Upload a file buffer (from multer memoryStorage) to ImageKit.
 * Returns the permanent URL of the uploaded image.
 *
 * @param buffer   - File buffer from multer
 * @param fileName - Desired file name (with extension)
 * @param folder   - ImageKit folder path, e.g. "/employees"
 */
export async function uploadToImageKit(
  buffer: Buffer,
  fileName: string,
  folder: string = '/sunsea-erp',
): Promise<string> {
  const base64 = buffer.toString('base64');

  const result = await imagekit.upload({
    file:              base64,
    fileName,
    folder,
    useUniqueFileName: true,
    transformation: {
      pre: 'w-400,h-400,c-maintain_ratio',
    },
  });

  return result.url;
}

export default imagekit;
