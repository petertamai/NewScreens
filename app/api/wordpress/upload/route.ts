import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { WordPressClient } from "@/lib/wordpress"
import fs from "fs/promises"
import path from "path"

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

// Helper to get basename from path (handles both Windows and Unix paths cross-platform)
// On Linux, path.basename('C:\\Users\\...\\file.png') returns the entire string because
// Linux doesn't recognize backslash as a path separator. This function handles both.
function getBasename(filepath: string): string {
  const segments = filepath.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] || filepath
}

/**
 * Upload a screenshot to WordPress
 * This endpoint is called after the screenshot is saved locally
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { screenshotId } = await request.json()

    if (!screenshotId) {
      return NextResponse.json(
        { success: false, message: "Screenshot ID is required" },
        { status: 400 }
      )
    }

    // Get WordPress settings for this user
    const settings = await prisma.settings.findMany({
      where: {
        userId: user.id,
        key: {
          in: ["wordpress_site_url", "wordpress_api_key"],
        },
      },
    })

    const settingsMap: Record<string, string> = {}
    for (const s of settings) {
      settingsMap[s.key] = s.value
    }

    const siteUrl = settingsMap["wordpress_site_url"]
    const apiKey = settingsMap["wordpress_api_key"]

    if (!siteUrl || !apiKey) {
      return NextResponse.json(
        { success: false, message: "WordPress not configured" },
        { status: 400 }
      )
    }

    // Get screenshot from database (only if belongs to user)
    const screenshot = await prisma.screenshot.findFirst({
      where: { id: screenshotId, userId: user.id },
    })

    if (!screenshot) {
      return NextResponse.json(
        { success: false, message: "Screenshot not found" },
        { status: 404 }
      )
    }

    // Skip if already uploaded
    if (screenshot.wpImageUrl) {
      return NextResponse.json({
        success: true,
        message: "Already uploaded",
        wpImageUrl: screenshot.wpImageUrl,
        wpAttachmentId: screenshot.wpAttachmentId,
      })
    }

    // Read the image file
    const filePath = resolveFilePath(screenshot.filepath)
    const fileBuffer = await fs.readFile(filePath)
    const filename = getBasename(filePath)

    // Parse keywords if available
    let keywords: string[] = []
    if (screenshot.keywords) {
      try {
        keywords = JSON.parse(screenshot.keywords)
      } catch {
        // Ignore parse errors
      }
    }

    // Upload to WordPress
    const client = new WordPressClient(siteUrl, apiKey)
    const result = await client.uploadImage({
      file: fileBuffer,
      filename,
      externalId: screenshotId.toString(),
      title: screenshot.aiSuggestedName || screenshot.filename,
      caption: screenshot.description || undefined,
      altText: screenshot.description || undefined,
      description: screenshot.description || undefined,
      keywords,
    })

    // Update screenshot with WordPress URL
    await prisma.screenshot.update({
      where: { id: screenshotId },
      data: {
        wpImageUrl: result.url,
        wpAttachmentId: result.attachment_id,
      },
    })

    return NextResponse.json({
      success: true,
      wpImageUrl: result.url,
      wpAttachmentId: result.attachment_id,
    })
  } catch (error) {
    console.error("WordPress upload failed:", error)
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
