import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    const { filepath } = await request.json()

    if (!filepath) {
      return NextResponse.json(
        { error: "No filepath provided" },
        { status: 400 }
      )
    }

    // Get the full path to the file
    // If filepath is already absolute, use it directly; otherwise join with public/
    const fullPath = path.isAbsolute(filepath)
      ? filepath
      : path.join(process.cwd(), "public", filepath)
    const folderPath = path.dirname(fullPath)

    console.log("[OPEN-FOLDER] Received filepath:", filepath)
    console.log("[OPEN-FOLDER] Is absolute:", path.isAbsolute(filepath))
    console.log("[OPEN-FOLDER] Full path:", fullPath)

    // Open Windows Explorer and select the file
    // Use spawn with shell:true for better Windows path handling
    spawn("explorer", ["/select,", fullPath], { shell: true })

    return NextResponse.json({ success: true, path: folderPath })
  } catch (error) {
    console.error("Open folder error:", error)
    return NextResponse.json(
      { error: "Failed to open folder" },
      { status: 500 }
    )
  }
}
