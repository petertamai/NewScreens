import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { requireAuth } from "@/lib/auth-utils"

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "API key is required" },
        { status: 400 }
      )
    }

    // Test the API key with a simple request
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" })
    await model.generateContent("Say 'OK'")

    return NextResponse.json({
      success: true,
      message: "API key is valid",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid API key"
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    )
  }
}
