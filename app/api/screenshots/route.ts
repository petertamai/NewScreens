import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
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

// GET all screenshots or search
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")

    const screenshots = await prisma.screenshot.findMany({
      where: {
        userId: user.id,
        ...(query && {
          OR: [
            { filename: { contains: query } },
            { description: { contains: query } },
            { aiSuggestedName: { contains: query } },
            { keywords: { contains: query } },
          ],
        }),
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(screenshots)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to fetch screenshots:", error)
    return NextResponse.json(
      { error: "Failed to fetch screenshots" },
      { status: 500 }
    )
  }
}

// POST create new screenshot record
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const { filename, filepath, description, aiSuggestedName, folderId, keywords } = await request.json()

    const screenshot = await prisma.screenshot.create({
      data: {
        filename,
        filepath,
        description,
        aiSuggestedName,
        keywords: keywords ? JSON.stringify(keywords) : null,
        folderId: folderId || null,
        userId: user.id,
      },
    })

    return NextResponse.json(screenshot)
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to create screenshot:", error)
    return NextResponse.json(
      { error: "Failed to create screenshot" },
      { status: 500 }
    )
  }
}

// PATCH update screenshot (for WordPress URL updates)
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "No id provided" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { wpImageUrl, wpAttachmentId } = body

    // Only update if screenshot belongs to user
    const screenshot = await prisma.screenshot.updateMany({
      where: { id: parseInt(id), userId: user.id },
      data: {
        ...(wpImageUrl !== undefined && { wpImageUrl }),
        ...(wpAttachmentId !== undefined && { wpAttachmentId }),
      },
    })

    if (screenshot.count === 0) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to update screenshot:", error)
    return NextResponse.json(
      { error: "Failed to update screenshot" },
      { status: 500 }
    )
  }
}

// DELETE screenshot
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "No id provided" },
        { status: 400 }
      )
    }

    // Only find if it belongs to user
    const screenshot = await prisma.screenshot.findFirst({
      where: { id: parseInt(id), userId: user.id },
    })

    if (!screenshot) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      )
    }

    // Delete file from disk
    const filePath = resolveFilePath(screenshot.filepath)
    try {
      await fs.unlink(filePath)
    } catch (e) {
      console.error("Failed to delete file:", e)
    }

    // Delete from database
    await prisma.screenshot.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to delete screenshot:", error)
    return NextResponse.json(
      { error: "Failed to delete screenshot" },
      { status: 500 }
    )
  }
}
