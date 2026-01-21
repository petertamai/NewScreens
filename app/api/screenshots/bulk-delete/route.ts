import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import fs from "fs/promises"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No ids provided" },
        { status: 400 }
      )
    }

    // Get all screenshots to delete
    const screenshots = await prisma.screenshot.findMany({
      where: { id: { in: ids } },
    })

    // Delete files from disk
    for (const screenshot of screenshots) {
      let filePath: string
      if (screenshot.filepath.startsWith("/")) {
        filePath = path.join(process.cwd(), "public", screenshot.filepath)
      } else {
        filePath = screenshot.filepath
      }

      try {
        await fs.unlink(filePath)
      } catch (e) {
        console.error(`Failed to delete file: ${filePath}`, e)
      }
    }

    // Delete from database
    const result = await prisma.screenshot.deleteMany({
      where: { id: { in: ids } },
    })

    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error("Bulk delete error:", error)
    return NextResponse.json(
      { error: "Failed to delete screenshots" },
      { status: 500 }
    )
  }
}
