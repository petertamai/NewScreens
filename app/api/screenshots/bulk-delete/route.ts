import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { deleteFromR2, filepathToR2Key } from "@/lib/s3"

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

    // Delete files from R2
    for (const screenshot of screenshots) {
      const r2Key = filepathToR2Key(screenshot.filepath)
      try {
        await deleteFromR2(r2Key)
      } catch (e) {
        console.error(`Failed to delete file from R2: ${r2Key}`, e)
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
