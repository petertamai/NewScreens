import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
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
 * Bulk upload screenshots to WordPress
 * Accepts an array of screenshot IDs and uploads each one
 */
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, message: "Screenshot IDs are required" },
        { status: 400 }
      )
    }

    // Get WordPress settings
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: ["wordpress_site_url", "wordpress_api_key"],
        },
      },
    })

    console.log("Bulk upload - Found settings:", settings.map(s => s.key))

    const settingsMap: Record<string, string> = {}
    for (const s of settings) {
      settingsMap[s.key] = s.value
    }

    const siteUrl = settingsMap["wordpress_site_url"]
    const apiKey = settingsMap["wordpress_api_key"]

    console.log("Bulk upload - siteUrl exists:", !!siteUrl, "apiKey exists:", !!apiKey)

    if (!siteUrl || !apiKey) {
      return NextResponse.json(
        { success: false, message: `WordPress not configured. Found keys: ${settings.map(s => s.key).join(", ") || "none"}` },
        { status: 400 }
      )
    }

    // Get screenshots from database
    const screenshots = await prisma.screenshot.findMany({
      where: { id: { in: ids } },
    })

    if (screenshots.length === 0) {
      return NextResponse.json(
        { success: false, message: "No screenshots found" },
        { status: 404 }
      )
    }

    const client = new WordPressClient(siteUrl, apiKey)
    const results: { id: number; success: boolean; wpImageUrl?: string; error?: string }[] = []

    // Upload each screenshot
    for (const screenshot of screenshots) {
      // Skip if already uploaded
      if (screenshot.wpImageUrl) {
        results.push({
          id: screenshot.id,
          success: true,
          wpImageUrl: screenshot.wpImageUrl,
        })
        continue
      }

      try {
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
        const result = await client.uploadImage({
          file: fileBuffer,
          filename,
          externalId: screenshot.id.toString(),
          title: screenshot.aiSuggestedName || screenshot.filename,
          caption: screenshot.description || undefined,
          altText: screenshot.description || undefined,
          description: screenshot.description || undefined,
          keywords,
        })

        // Update screenshot with WordPress URL
        await prisma.screenshot.update({
          where: { id: screenshot.id },
          data: {
            wpImageUrl: result.url,
            wpAttachmentId: result.attachment_id,
          },
        })

        results.push({
          id: screenshot.id,
          success: true,
          wpImageUrl: result.url,
        })
      } catch (error) {
        console.error(`Failed to upload screenshot ${screenshot.id}:`, error)
        results.push({
          id: screenshot.id,
          success: false,
          error: error instanceof Error ? error.message : "Upload failed",
        })
      }
    }

    const uploaded = results.filter(r => r.success).length

    return NextResponse.json({
      success: true,
      total: screenshots.length,
      uploaded,
      failed: screenshots.length - uploaded,
      results,
    })
  } catch (error) {
    console.error("Bulk WordPress upload failed:", error)
    const message = error instanceof Error ? error.message : "Bulk upload failed"
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
