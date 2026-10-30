// Server-only: re-encode an uploaded image so no EXIF/GPS/XMP metadata leaves our server (spec §18).
import sharp from 'sharp';

export const MAX_IMAGE_EDGE = 1080;
export const MAX_UPLOAD_IMAGE_BYTES = 3_000_000;
export const MIN_IMAGE_EDGE = 16;

export class InvalidImageError extends Error {}

/**
 * Decodes the bytes (rejecting anything sharp cannot read as JPEG/PNG/WebP),
 * applies the EXIF orientation, caps the long edge at 1080 px and re-encodes
 * as JPEG. sharp drops all metadata unless `withMetadata()` is requested.
 */
export async function sanitizeImage(input: Buffer): Promise<{ buffer: Buffer; mime: 'image/jpeg'; width: number; height: number }> {
  if (input.length === 0) throw new InvalidImageError('The uploaded image is empty.');
  if (input.length > MAX_UPLOAD_IMAGE_BYTES) {
    throw new InvalidImageError(`The uploaded image is too large (maximum ${MAX_UPLOAD_IMAGE_BYTES / 1_000_000} MB).`);
  }
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new InvalidImageError('The uploaded file is not a decodable image.');
  }
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
    throw new InvalidImageError(`Unsupported image format "${meta.format ?? 'unknown'}" (JPEG, PNG or WebP only).`);
  }
  if (!meta.width || !meta.height || meta.width < MIN_IMAGE_EDGE || meta.height < MIN_IMAGE_EDGE) {
    throw new InvalidImageError(`The uploaded image must be at least ${MIN_IMAGE_EDGE} by ${MIN_IMAGE_EDGE} pixels.`);
  }

  // Reject assets with no visible pixels and near-uniform colour blocks. They cannot
  // be meaningfully evaluated and are commonly produced by empty exports.
  const stats = await sharp(input).ensureAlpha().stats();
  const alpha = stats.channels[3];
  const colour = stats.channels.slice(0, 3);
  if ((alpha?.max ?? 255) === 0) throw new InvalidImageError('The uploaded image is fully transparent.');
  if (colour.every((channel) => channel.stdev < 0.5) && colour.every((channel) => channel.mean > 248 || channel.mean < 7)) {
    throw new InvalidImageError('The uploaded image appears blank or a single-colour placeholder.');
  }
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, mime: 'image/jpeg', width: info.width, height: info.height };
}
