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

    // Get all screenshots to delete (only user's screenshots)
    const screenshots = await prisma.screenshot.findMany({
      where: { id: { in: ids }, userId: user.id },
    })

    // Delete files from disk
    for (const screenshot of screenshots) {
      const filePath = resolveFilePath(screenshot.filepath)
      try {
        await fs.unlink(filePath)
      } catch (e) {
        console.error(`Failed to delete file: ${filePath}`, e)
      }
    }

    // Delete from database (only user's screenshots)
    const result = await prisma.screenshot.deleteMany({
      where: { id: { in: ids }, userId: user.id },
    })

    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Bulk delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete screenshots" },
      { status: 500 }
    )
  }
}
