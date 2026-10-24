// Server-only: re-encode an uploaded image so no EXIF/GPS/XMP metadata leaves our server (spec §18).
import sharp from 'sharp';

export const MAX_IMAGE_EDGE = 1080;

export class InvalidImageError extends Error {}

/**
 * Decodes the bytes (rejecting anything sharp cannot read as JPEG/PNG/WebP),
 * applies the EXIF orientation, caps the long edge at 1080 px and re-encodes
 * as JPEG. sharp drops all metadata unless `withMetadata()` is requested.
 */
export async function sanitizeImage(input: Buffer): Promise<{ buffer: Buffer; mime: 'image/jpeg'; width: number; height: number }> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new InvalidImageError('The uploaded file is not a decodable image.');
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
    throw new InvalidImageError(`Unsupported image format "${meta.format ?? 'unknown'}" (JPEG, PNG or WebP only).`);
  }
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, mime: 'image/jpeg', width: info.width, height: info.height };
}
