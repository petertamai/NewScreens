import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

// Check if a path is absolute (full path)
function isAbsolutePath(p: string): boolean {
  // Windows: starts with drive letter (C:\) or UNC path (\\)
  // Unix: starts with /
  return path.isAbsolute(p) || /^[a-zA-Z]:[\\/]/.test(p)
}

// POST validate folder path
export async function POST(request: NextRequest) {
  try {
    const { path: folderPath } = await request.json()

    if (!folderPath) {
      return NextResponse.json(
        { valid: false, error: "Path is required" },
        { status: 400 }
      )
    }

    let normalizedPath: string
    let willCreate = false

    // Check if it's an absolute path or just a folder name
    if (isAbsolutePath(folderPath)) {
      // Full path provided - must exist
      normalizedPath = path.normalize(folderPath)

      try {
        const stats = await fs.stat(normalizedPath)

        if (!stats.isDirectory()) {
          return NextResponse.json({
            valid: false,
            error: "Path exists but is not a directory",
          })
        }

        // Try to write a test file to check write permissions
        const testFile = path.join(normalizedPath, `.write-test-${Date.now()}`)
        try {
          await fs.writeFile(testFile, "test")
          await fs.unlink(testFile)
        } catch {
          return NextResponse.json({
            valid: false,
            error: "Directory is not writable",
          })
        }
      } catch {
        return NextResponse.json({
          valid: false,
          error: "Path does not exist",
        })
      }
    } else {
      // Just a folder name - will create as subfolder of public/screenshots
      const baseDir = path.join(process.cwd(), "public", "screenshots")
      normalizedPath = path.join(baseDir, folderPath)

      // Check if it already exists
      try {
        const stats = await fs.stat(normalizedPath)
        if (!stats.isDirectory()) {
          return NextResponse.json({
            valid: false,
            error: "A file with this name already exists",
          })
        }
      } catch {
        // Doesn't exist - will be created
        willCreate = true
      }
    }

    return NextResponse.json({
      valid: true,
      path: normalizedPath,
      name: path.basename(normalizedPath),
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
