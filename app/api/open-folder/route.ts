import { NextRequest, NextResponse } from "next/server"

// POST open folder - disabled in cloud mode
// This feature requires Windows Explorer and is not available in cloud deployments
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: "This feature is not available in cloud mode",
      message: "Opening folders in file explorer is only supported in local Windows deployments."
    },
    { status: 501 }
  )
}
