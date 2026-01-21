import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import fs from "fs/promises"
import path from "path"

// GET all screenshots or search
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")

    const screenshots = await prisma.screenshot.findMany({
      where: query
        ? {
            OR: [
              { filename: { contains: query } },
              { description: { contains: query } },
              { aiSuggestedName: { contains: query } },
              { keywords: { contains: query } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(screenshots)
  } catch (error) {
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
    const { filename, filepath, description, aiSuggestedName, folderId, keywords } = await request.json()

    const screenshot = await prisma.screenshot.create({
      data: {
        filename,
        filepath,
        description,
        aiSuggestedName,
        keywords: keywords ? JSON.stringify(keywords) : null,
        folderId: folderId || null,
      },
    })

    return NextResponse.json(screenshot)
  } catch (error) {
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

    const screenshot = await prisma.screenshot.update({
      where: { id: parseInt(id) },
      data: {
        ...(wpImageUrl !== undefined && { wpImageUrl }),
        ...(wpAttachmentId !== undefined && { wpAttachmentId }),
      },
    })

    return NextResponse.json(screenshot)
  } catch (error) {
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
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "No id provided" },
        { status: 400 }
      )
    }

    const screenshot = await prisma.screenshot.findUnique({
      where: { id: parseInt(id) },
    })

    if (!screenshot) {
      return NextResponse.json(
        { error: "Screenshot not found" },
        { status: 404 }
      )
    }

    // Delete file from disk
    // If filepath starts with /, it's relative to public/
    // Otherwise it's an absolute path to a custom folder
    let filePath: string
    if (screenshot.filepath.startsWith("/")) {
      filePath = path.join(process.cwd(), "public", screenshot.filepath)
    } else {
      filePath = screenshot.filepath
    }

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
    console.error("Failed to delete screenshot:", error)
    return NextResponse.json(
      { error: "Failed to delete screenshot" },
      { status: 500 }
    )
  }
}
