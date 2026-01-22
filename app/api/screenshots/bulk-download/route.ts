import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import archiver from "archiver"
import { PassThrough } from "stream"
import { getFromR2, filepathToR2Key } from "@/lib/s3"

// Helper to get basename from path (handles both Windows and Unix paths cross-platform)
// On Linux, path.basename('C:\\Users\\...\\file.png') returns the entire string because
// Linux doesn't recognize backslash as a path separator. This function handles both.
function getBasename(filepath: string): string {
  const segments = filepath.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] || filepath
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No ids provided" },
        { status: 400 }
      )
    }

    // Get all screenshots to download (only user's screenshots)
    const screenshots = await prisma.screenshot.findMany({
      where: { id: { in: ids }, userId: user.id },
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

    // Add each file to archive from R2
    for (const screenshot of screenshots) {
      const r2Key = filepathToR2Key(screenshot.filepath)

      try {
        const fileBuffer = await getFromR2(r2Key)
        const filename = screenshot.filename || getBasename(screenshot.filepath)
        archive.append(fileBuffer, { name: filename })
      } catch (e) {
        console.warn(`File not found in R2: ${r2Key}`, e)
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
