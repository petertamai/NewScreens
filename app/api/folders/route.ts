import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import fs from "fs/promises"
import path from "path"

// Helper to extract folder name from path (handles both Windows and Unix paths cross-platform)
// On Linux, path.basename('C:\\Users\\...\\Folder') returns the entire string because
// Linux doesn't recognize backslash as a path separator. This function handles both.
function extractFolderName(inputPath: string): string {
  const segments = inputPath.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] || inputPath
}

// GET all folders
export async function GET() {
  try {
    const user = await requireAuth()
    const folders = await prisma.libraryFolder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(folders)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to fetch folders:", error)
    return NextResponse.json(
      { error: "Failed to fetch folders" },
      { status: 500 }
    )
  }
}

// POST create new folder
// In cloud-ready mode, all folders are created under public/screenshots/
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { name, path: folderPath } = await request.json()

    if (!folderPath) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      )
    }

    // Extract just the folder name from potential Windows/Unix path
    const extractedName = extractFolderName(folderPath)

    // Sanitize folder name - remove any invalid characters to prevent directory traversal
    const sanitizedFolderName = extractedName
      .replace(/[^a-zA-Z0-9_\- ]/g, "_")
      .substring(0, 100)

    if (!sanitizedFolderName) {
      return NextResponse.json(
        { error: "Invalid folder name" },
        { status: 400 }
      )
    }

    // Create folder under public/screenshots/
    const baseDir = path.join(process.cwd(), "public", "screenshots")
    const fullPath = path.join(baseDir, sanitizedFolderName)

    // Create the folder if it doesn't exist
    await fs.mkdir(fullPath, { recursive: true })

    // Check if folder already exists in database for this user
    const existing = await prisma.libraryFolder.findFirst({
      where: { path: sanitizedFolderName, userId: user.id },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Folder already added" },
        { status: 400 }
      )
    }

    // Generate name from path if not provided
    const folderName = name || sanitizedFolderName

    // If this is the first folder for user, make it selected
    const folderCount = await prisma.libraryFolder.count({
      where: { userId: user.id }
    })
    const isSelected = folderCount === 0

    const folder = await prisma.libraryFolder.create({
      data: {
        name: folderName,
        path: sanitizedFolderName,
        isSelected,
        userId: user.id,
      },
    })

    return NextResponse.json(folder)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to create folder:", error)
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    )
  }
}

// DELETE folder
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "No id provided" },
        { status: 400 }
      )
    }

    const folderId = parseInt(id)

    // Check if folder exists and belongs to user
    const folder = await prisma.libraryFolder.findFirst({
      where: { id: folderId, userId: user.id },
    })

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      )
    }

    // Delete the folder from database (screenshots remain but folderId becomes null)
    await prisma.libraryFolder.delete({
      where: { id: folderId },
    })

    // If deleted folder was selected, select another folder for this user if available
    if (folder.isSelected) {
      const anotherFolder = await prisma.libraryFolder.findFirst({
        where: { userId: user.id }
      })
      if (anotherFolder) {
        await prisma.libraryFolder.update({
          where: { id: anotherFolder.id },
          data: { isSelected: true },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to delete folder:", error)
    return NextResponse.json(
      { error: "Failed to delete folder" },
      { status: 500 }
    )
  }
}

// PATCH select/deselect folder or update customPrompt
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { id, isSelected, deselectAll, customPrompt } = await request.json()

    // Deselect all folders for this user (select Root)
    if (deselectAll) {
      await prisma.libraryFolder.updateMany({
        where: { userId: user.id },
        data: { isSelected: false },
      })
      return NextResponse.json({ success: true })
    }

    if (!id) {
      return NextResponse.json(
        { error: "No id provided" },
        { status: 400 }
      )
    }

    // Verify folder belongs to user
    const existingFolder = await prisma.libraryFolder.findFirst({
      where: { id: parseInt(id), userId: user.id }
    })
    if (!existingFolder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }

    // Build update data object
    const updateData: { isSelected?: boolean; customPrompt?: string | null } = {}

    // If selecting this folder, deselect all others for this user first
    if (isSelected !== undefined) {
      if (isSelected) {
        await prisma.libraryFolder.updateMany({
          where: { userId: user.id },
          data: { isSelected: false },
        })
      }
      updateData.isSelected = isSelected
    }

    // If customPrompt provided in request, update it
    if (customPrompt !== undefined) {
      updateData.customPrompt = customPrompt || null  // empty string = clear
    }

    const folder = await prisma.libraryFolder.update({
      where: { id: parseInt(id) },
      data: updateData,
    })

    return NextResponse.json(folder)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to update folder:", error)
    return NextResponse.json(
      { error: "Failed to update folder" },
      { status: 500 }
    )
  }
}
