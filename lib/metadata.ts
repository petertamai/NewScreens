import sharp from "sharp"

// Embed metadata into a buffer and return the new buffer
export async function embedImageMetadataToBuffer(
  inputBuffer: Buffer,
  description: string
): Promise<Buffer> {
  if (!description) return inputBuffer

  const startTime = Date.now()
  console.log(`[EXIF] Starting metadata embed (${inputBuffer.length} bytes)`)

  try {
    // Process with Sharp - embed EXIF metadata
    const outputBuffer = await sharp(inputBuffer)
      .withMetadata({
        exif: {
          IFD0: {
            ImageDescription: description,
          },
        },
      })
      .png()
      .toBuffer()

    console.log(`[EXIF] ✓ Metadata embedded successfully in ${Date.now() - startTime}ms`)
    return outputBuffer
  } catch (error) {
    console.error(`[EXIF] ✗ Failed to embed metadata:`, error)
    // Non-fatal - return original buffer
    return inputBuffer
  }
}
