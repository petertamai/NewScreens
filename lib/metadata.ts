import sharp from "sharp"
import fs from "fs/promises"

export async function embedImageMetadata(
  filePath: string,
  description: string
): Promise<void> {
  if (!description) return

  const startTime = Date.now()
  console.log(`[EXIF] Starting metadata embed for: ${filePath}`)

  try {
    // Read the file
    const inputBuffer = await fs.readFile(filePath)
    console.log(`[EXIF] Read file (${inputBuffer.length} bytes) in ${Date.now() - startTime}ms`)

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

    console.log(`[EXIF] Processed image in ${Date.now() - startTime}ms`)

    // Write back to file
    await fs.writeFile(filePath, outputBuffer)
    console.log(`[EXIF] ✓ Metadata embedded successfully in ${Date.now() - startTime}ms total`)
  } catch (error) {
    console.error(`[EXIF] ✗ Failed to embed metadata:`, error)
    // Non-fatal - file is still saved
  }
}
