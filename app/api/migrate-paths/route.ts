import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Helper to extract folder name from path (handles both Windows and Unix paths cross-platform)
function extractFolderName(inputPath: string): string {
  const segments = inputPath.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] || inputPath
}

// Helper to check if a path is an absolute Windows or Unix path (legacy format)
function isAbsolutePath(p: string): boolean {
  return p.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(p)
}

/**
 * Migration endpoint to fix legacy Windows paths in the database.
 * Converts absolute paths like 'C:\Users\...\SE Ranking' to just 'SE Ranking'
 *
 * GET /api/migrate-paths - Run migration (safe to run multiple times)
 */
export async function GET() {
  try {
    // Get all folders
    const folders = await prisma.libraryFolder.findMany()

    const results: {
      id: number
      oldPath: string
      newPath: string
      migrated: boolean
    }[] = []

    for (const folder of folders) {
      // Check if this is a legacy absolute path
      if (isAbsolutePath(folder.path)) {
        const folderName = extractFolderName(folder.path)

        // Update the path to just the folder name
        await prisma.libraryFolder.update({
          where: { id: folder.id },
          data: { path: folderName },
        })

        results.push({
          id: folder.id,
          oldPath: folder.path,
          newPath: folderName,
          migrated: true,
        })
      } else {
        results.push({
          id: folder.id,
          oldPath: folder.path,
          newPath: folder.path,
          migrated: false,
        })
      }
    }

    const migratedCount = results.filter(r => r.migrated).length

    return NextResponse.json({
      success: true,
      message: `Migration complete. ${migratedCount} of ${folders.length} folders updated.`,
      results,
    })
  } catch (error) {
    console.error("Migration failed:", error)
    return NextResponse.json(
      { success: false, error: "Migration failed" },
      { status: 500 }
    )
  }
}
