import { NextRequest, NextResponse } from "next/server"
import { getFromR2 } from "@/lib/s3"

// GET serve image from R2
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

    // Reconstruct the R2 key from segments
    // The path comes URL-encoded, so we need to decode it
    const r2Key = decodeURIComponent(pathSegments.join("/"))

    // Security: ensure the path doesn't contain path traversal
    if (r2Key.includes("..")) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      )
    }

    // Fetch from R2
    let fileBuffer: Buffer
    try {
      fileBuffer = await getFromR2(r2Key)
    } catch (error) {
      console.error("R2 fetch error:", error)
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      )
    }

    // Determine content type based on extension
    const ext = r2Key.split(".").pop()?.toLowerCase() || ""
    const contentTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
    }

    const contentType = contentTypes[ext] || "application/octet-stream"

    return new NextResponse(new Uint8Array(fileBuffer), {
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
