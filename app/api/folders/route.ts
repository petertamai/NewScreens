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

// Check if a path is absolute (full path)
function isAbsolutePath(p: string): boolean {
  return path.isAbsolute(p) || /^[a-zA-Z]:[\\/]/.test(p)
}

// POST create new folder
export async function POST(request: NextRequest) {
  try {
    const { name, path: folderPath } = await request.json()

    if (!folderPath) {
      return NextResponse.json(
        { error: "Path is required" },
        { status: 400 }
      )
    }

    let normalizedPath: string

    // Check if it's an absolute path or just a folder name
    if (isAbsolutePath(folderPath)) {
      // Full path provided - must exist
      normalizedPath = path.normalize(folderPath)

      try {
        const stats = await fs.stat(normalizedPath)
        if (!stats.isDirectory()) {
          return NextResponse.json(
            { error: "Path is not a directory" },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: "Path does not exist" },
          { status: 400 }
        )
      }
    } else {
      // Just a folder name - create as subfolder of public/screenshots
      const baseDir = path.join(process.cwd(), "public", "screenshots")
      normalizedPath = path.join(baseDir, folderPath)

      // Create the folder if it doesn't exist
      await fs.mkdir(normalizedPath, { recursive: true })
    }

    // Check if folder already exists in database
    const existing = await prisma.libraryFolder.findUnique({
      where: { path: normalizedPath },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Folder already added" },
        { status: 400 }
      )
    }

    // Generate name from path if not provided
    const folderName = name || path.basename(normalizedPath)

    // If this is the first folder, make it selected
    const folderCount = await prisma.libraryFolder.count()
    const isSelected = folderCount === 0

    const folder = await prisma.libraryFolder.create({
      data: {
        name: folderName,
        path: normalizedPath,
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

// PATCH select/deselect folder
export async function PATCH(request: NextRequest) {
  try {
    const { id, isSelected, deselectAll } = await request.json()

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

    // If selecting this folder, deselect all others first
    if (isSelected) {
      await prisma.libraryFolder.updateMany({
        data: { isSelected: false },
      })
    }

    const folder = await prisma.libraryFolder.update({
      where: { id: parseInt(id) },
      data: { isSelected },
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
