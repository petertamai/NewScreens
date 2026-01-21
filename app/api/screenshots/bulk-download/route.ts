import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import archiver from "archiver"
import fs from "fs"
import path from "path"
import { PassThrough } from "stream"

// Helper to resolve filepath to absolute filesystem path
// Handles both legacy absolute paths and new relative paths
function resolveFilePath(filepath: string): string {
  if (filepath.startsWith("/")) {
    // New relative format - prepend public directory
    return path.join(process.cwd(), "public", filepath)
  }
  // Legacy absolute path - use as-is
  return filepath
}

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No ids provided" },
        { status: 400 }
      )
    }

    // Get all screenshots to download
    const screenshots = await prisma.screenshot.findMany({
      where: { id: { in: ids } },
    })

    if (screenshots.length === 0) {
      return NextResponse.json(
        { error: "No screenshots found" },
        { status: 404 }
      )
    }

    // Create archive
    const archive = archiver("zip", {
      zlib: { level: 5 }, // Balanced compression
    })

    // Create a passthrough stream to convert Node stream to Web stream
    const passthrough = new PassThrough()

    // Pipe archive to passthrough
    archive.pipe(passthrough)

    // Add each file to archive
    for (const screenshot of screenshots) {
      const filePath = resolveFilePath(screenshot.filepath)

      // Check if file exists
      if (fs.existsSync(filePath)) {
        const filename = screenshot.filename || path.basename(filePath)
        archive.file(filePath, { name: filename })
      } else {
        console.warn(`File not found: ${filePath}`)
      }
    }

    // Finalize archive (must be called after adding files)
    archive.finalize()

    // Convert Node.js PassThrough stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        passthrough.on("data", (chunk) => {
          controller.enqueue(chunk)
        })
        passthrough.on("end", () => {
          controller.close()
        })
        passthrough.on("error", (err) => {
          controller.error(err)
        })
      },
    })

    // Return as response with proper headers
    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="screenshots-${Date.now()}.zip"`,
      },
    })
  } catch (error) {
    console.error("Bulk download error:", error)
    return NextResponse.json(
      { error: "Failed to create download" },
      { status: 500 }
    )
  }
}
