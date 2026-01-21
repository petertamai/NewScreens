import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

// POST validate folder name
// In cloud-ready mode, all folders are created under public/screenshots/
export async function POST(request: NextRequest) {
  try {
    const { path: folderPath } = await request.json()

    if (!folderPath) {
      return NextResponse.json(
        { valid: false, error: "Folder name is required" },
        { status: 400 }
      )
    }

    // Sanitize folder name - remove any path separators to prevent directory traversal
    const sanitizedFolderName = folderPath
      .replace(/[/\\]/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 100)

    if (!sanitizedFolderName) {
      return NextResponse.json({
        valid: false,
        error: "Invalid folder name. Use only letters, numbers, underscores, and hyphens.",
      })
    }

    // Check if folder would be created under public/screenshots/
    const baseDir = path.join(process.cwd(), "public", "screenshots")
    const fullPath = path.join(baseDir, sanitizedFolderName)

    let willCreate = true

    // Check if it already exists
    try {
      const stats = await fs.stat(fullPath)
      if (!stats.isDirectory()) {
        return NextResponse.json({
          valid: false,
          error: "A file with this name already exists",
        })
      }
      willCreate = false
    } catch {
      // Doesn't exist - will be created
      willCreate = true
    }

    return NextResponse.json({
      valid: true,
      path: sanitizedFolderName,
      name: sanitizedFolderName,
      willCreate,
    })
  } catch (error) {
    console.error("Validation error:", error)
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 }
    )
  }
}
