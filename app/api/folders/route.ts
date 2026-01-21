import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import fs from "fs/promises"
import path from "path"

// GET all folders
export async function GET() {
  try {
    const folders = await prisma.libraryFolder.findMany({
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(folders)
  } catch (error) {
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
    const { name, path: folderPath } = await request.json()

    if (!folderPath) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      )
    }

    // Sanitize folder name - remove any path separators to prevent directory traversal
    const sanitizedFolderName = folderPath
      .replace(/[/\\]/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
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

    // Check if folder already exists in database (by name)
    const existing = await prisma.libraryFolder.findUnique({
      where: { path: sanitizedFolderName },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Folder already added" },
        { status: 400 }
      )
    }

    // Generate name from path if not provided
    const folderName = name || sanitizedFolderName

    // If this is the first folder, make it selected
    const folderCount = await prisma.libraryFolder.count()
    const isSelected = folderCount === 0

    const folder = await prisma.libraryFolder.create({
      data: {
        name: folderName,
        path: sanitizedFolderName, // Store only the folder name, not full path
        isSelected,
      },
    })

    return NextResponse.json(folder)
  } catch (error) {
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
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "No id provided" },
        { status: 400 }
      )
    }

    const folderId = parseInt(id)

    // Check if folder exists
    const folder = await prisma.libraryFolder.findUnique({
      where: { id: folderId },
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

    // If deleted folder was selected, select another folder if available
    if (folder.isSelected) {
      const anotherFolder = await prisma.libraryFolder.findFirst()
      if (anotherFolder) {
        await prisma.libraryFolder.update({
          where: { id: anotherFolder.id },
          data: { isSelected: true },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
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
    const { id, isSelected, deselectAll, customPrompt } = await request.json()

    // Deselect all folders (select Root)
    if (deselectAll) {
      await prisma.libraryFolder.updateMany({
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

    // Build update data object
    const updateData: { isSelected?: boolean; customPrompt?: string | null } = {}

    // If selecting this folder, deselect all others first
    if (isSelected !== undefined) {
      if (isSelected) {
        await prisma.libraryFolder.updateMany({
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
    console.error("Failed to update folder:", error)
    return NextResponse.json(
      { error: "Failed to update folder" },
      { status: 500 }
    )
  }
}
