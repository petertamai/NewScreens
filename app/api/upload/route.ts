import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { prisma } from "@/lib/prisma"
import { embedImageMetadata } from "@/lib/metadata"

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

    let targetDir: string
    let filepath: string
    let folderId: number | null = null

    if (targetFolderId) {
      // Get the folder from database
      const folder = await prisma.libraryFolder.findUnique({
        where: { id: targetFolderId },
      })

      if (folder) {
        targetDir = folder.path
        // Store the absolute path and serve via API
        filepath = path.join(folder.path, finalFilename)
        folderId = folder.id
      } else {
        // Fallback to default screenshots directory
        targetDir = path.join(process.cwd(), "public", "screenshots")
        filepath = path.join(targetDir, finalFilename)
      }
    } else {
      // Check if there's a selected folder
      const selectedFolder = await prisma.libraryFolder.findFirst({
        where: { isSelected: true },
      })

      if (selectedFolder) {
        targetDir = selectedFolder.path
        filepath = path.join(selectedFolder.path, finalFilename)
        folderId = selectedFolder.id
      } else {
        // Default to public/screenshots
        targetDir = path.join(process.cwd(), "public", "screenshots")
        filepath = path.join(targetDir, finalFilename)
      }
    }

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true })

    // Remove data URL prefix and save
    const imageData = image.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(imageData, "base64")

    // filepath is now always the absolute path
    await fs.writeFile(filepath, buffer)

    // Embed AI description into image EXIF metadata
    if (description) {
      await embedImageMetadata(filepath, description)
    }

    console.log("[UPLOAD] Returning filepath:", filepath)
    console.log("[UPLOAD] folderId:", folderId)

    return NextResponse.json({
      filepath,
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
