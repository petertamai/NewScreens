import { NextRequest, NextResponse } from "next/server"
import { WordPressClient } from "@/lib/wordpress"

export async function POST(request: NextRequest) {
  try {
    const { siteUrl, apiKey } = await request.json()

    if (!siteUrl || !apiKey) {
      return NextResponse.json(
        { success: false, message: "Site URL and API key are required" },
        { status: 400 }
      )
    }

    const client = new WordPressClient(siteUrl, apiKey)
    const result = await client.testConnection()

    return NextResponse.json({
      success: true,
      message: result.message,
      site: result.site,
      url: result.url,
      version: result.version,
    })
  } catch (error) {
    console.error("WordPress test connection failed:", error)
    const message = error instanceof Error ? error.message : "Connection failed"
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
