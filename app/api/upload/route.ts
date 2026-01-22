import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { embedImageMetadataToBuffer } from "@/lib/metadata"
import { uploadToR2 } from "@/lib/s3"

// Helper to get folder name from path (handles both Windows and Unix paths cross-platform)
// On Linux, path.basename('C:\\Users\\...\\Folder') returns the entire string because
// Linux doesn't recognize backslash as a path separator. This function handles both.
function getFolderName(folderPath: string): string {
  // Split by both Windows and Unix separators, take the last non-empty segment
  const segments = folderPath.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] || folderPath
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { image, filename, targetFolderId, description } = await request.json()

    if (!image || !filename) {
      return NextResponse.json(
        { error: "Missing image or filename" },
        { status: 400 }
      )
    }

    // Clean filename
    const cleanFilename = filename
      .replace(/[^a-z0-9_-]/gi, "_")
      .toLowerCase()
      .substring(0, 100)

    // Create unique filename with timestamp
    const timestamp = Date.now()
    const finalFilename = `${cleanFilename}_${timestamp}.png`

    let folderName: string | null = null
    let relativeFilepath: string
    let folderId: number | null = null

    if (targetFolderId) {
      // Get the folder from database (must belong to user)
      const folder = await prisma.libraryFolder.findFirst({
        where: { id: targetFolderId, userId: user.id },
      })

      if (folder) {
        // Get folder name (handles both legacy absolute paths and new format)
        folderName = getFolderName(folder.path)
        relativeFilepath = `/screenshots/${folderName}/${finalFilename}`
        folderId = folder.id
      } else {
        // Fallback to default screenshots directory
        relativeFilepath = `/screenshots/${finalFilename}`
      }
    } else {
      // Check if there's a selected folder for this user
      const selectedFolder = await prisma.libraryFolder.findFirst({
        where: { isSelected: true, userId: user.id },
      })

      if (selectedFolder) {
        folderName = getFolderName(selectedFolder.path)
        relativeFilepath = `/screenshots/${folderName}/${finalFilename}`
        folderId = selectedFolder.id
      } else {
        // Default to screenshots root
        relativeFilepath = `/screenshots/${finalFilename}`
      }
    }

    // Remove data URL prefix and create buffer
    const imageData = image.replace(/^data:image\/\w+;base64,/, "")
    let buffer: Buffer = Buffer.from(imageData, "base64")

    // Embed AI description into image EXIF metadata
    if (description) {
      buffer = await embedImageMetadataToBuffer(buffer, description) as Buffer
    }

    // Upload to R2
    // R2 key is the filepath without the leading slash
    const r2Key = relativeFilepath.replace(/^\//, "")
    await uploadToR2(r2Key, buffer, "image/png")

    console.log("[UPLOAD] Uploaded to R2:", r2Key)
    console.log("[UPLOAD] Returning filepath:", relativeFilepath)
    console.log("[UPLOAD] folderId:", folderId)

    // Return relative filepath for database storage
    return NextResponse.json({
      filepath: relativeFilepath,
      filename: finalFilename,
      folderId,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    )
  }
}
