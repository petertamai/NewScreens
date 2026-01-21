import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

// GET serve image from custom folder path
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        { error: "No path provided" },
        { status: 400 }
      )
    }

    // Reconstruct the full path from segments
    // The path comes URL-encoded, so we need to decode it
    const fullPath = decodeURIComponent(pathSegments.join("/"))

    // Security: ensure the path is absolute and doesn't contain path traversal
    const normalizedPath = path.normalize(fullPath)
    if (normalizedPath.includes("..")) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      )
    }

    // Check if file exists
    try {
      await fs.access(normalizedPath)
    } catch {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    // Read the file
    const fileBuffer = await fs.readFile(normalizedPath)

    // Determine content type based on extension
    const ext = path.extname(normalizedPath).toLowerCase()
    const contentTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".bmp": "image/bmp",
    }

    const contentType = contentTypes[ext] || "application/octet-stream"

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Serve error:", error)
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    )
  }
}
