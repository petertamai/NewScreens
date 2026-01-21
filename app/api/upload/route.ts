import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { embedImageMetadata } from "@/lib/metadata"

// Helper to check if a path is an absolute Windows/Unix path (legacy format)
function isAbsolutePath(p: string): boolean {
  return path.isAbsolute(p) || /^[a-zA-Z]:[\\/]/.test(p)
}

// Helper to get folder name from path (handles both legacy absolute and new relative formats)
function getFolderName(folderPath: string): string {
  if (isAbsolutePath(folderPath)) {
    // Legacy absolute path - extract folder name
    return path.basename(folderPath)
  }
  // New format - path is just the folder name
  return folderPath
}

export async function POST(request: NextRequest) {
  try {
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

    // Base directory for all screenshots
    const baseDir = path.join(process.cwd(), "public", "screenshots")

    let targetDir: string
    let relativeFilepath: string
    let folderId: number | null = null

    if (targetFolderId) {
      // Get the folder from database
      const folder = await prisma.libraryFolder.findUnique({
        where: { id: targetFolderId },
      })

      if (folder) {
        // Get folder name (handles both legacy absolute paths and new format)
        const folderName = getFolderName(folder.path)
        targetDir = path.join(baseDir, folderName)
        relativeFilepath = `/screenshots/${folderName}/${finalFilename}`
        folderId = folder.id
      } else {
        // Fallback to default screenshots directory
        targetDir = baseDir
        relativeFilepath = `/screenshots/${finalFilename}`
      }
    } else {
      // Check if there's a selected folder
      const selectedFolder = await prisma.libraryFolder.findFirst({
        where: { isSelected: true },
      })

      if (selectedFolder) {
        const folderName = getFolderName(selectedFolder.path)
        targetDir = path.join(baseDir, folderName)
        relativeFilepath = `/screenshots/${folderName}/${finalFilename}`
        folderId = selectedFolder.id
      } else {
        // Default to public/screenshots
        targetDir = baseDir
        relativeFilepath = `/screenshots/${finalFilename}`
      }
    }

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true })

    // Remove data URL prefix and save
    const imageData = image.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(imageData, "base64")

    // Write to filesystem using absolute path
    const absoluteFilepath = path.join(process.cwd(), "public", relativeFilepath)
    await fs.writeFile(absoluteFilepath, buffer)

    // Embed AI description into image EXIF metadata
    if (description) {
      await embedImageMetadata(absoluteFilepath, description)
    }

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
