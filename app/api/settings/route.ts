import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-utils"
import { DEFAULT_INSTRUCTION, DEFAULT_MODEL } from "@/lib/gemini"

export async function GET() {
  try {
    const user = await requireAuth()
    // Fetch all settings for this user
    const settings = await prisma.settings.findMany({
      where: { userId: user.id }
    })

    const settingsMap: Record<string, string> = {}
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value
    }

    return NextResponse.json({
      customPrompt: settingsMap["customPrompt"] || DEFAULT_INSTRUCTION,
      isDefault: !settingsMap["customPrompt"],
      wordpress_site_url: settingsMap["wordpress_site_url"] || "",
      wordpress_api_key: settingsMap["wordpress_api_key"] || "",
      gemini_model: settingsMap["gemini_model"] || DEFAULT_MODEL,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to fetch settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { customPrompt, wordpress_site_url, wordpress_api_key, gemini_model } = body

    // Helper to upsert user-specific settings
    const upsertSetting = async (key: string, value: string) => {
      const existing = await prisma.settings.findFirst({
        where: { key, userId: user.id }
      })
      if (existing) {
        await prisma.settings.update({
          where: { id: existing.id },
          data: { value }
        })
      } else {
        await prisma.settings.create({
          data: { key, value, userId: user.id }
        })
      }
    }

    const deleteSetting = async (key: string) => {
      await prisma.settings.deleteMany({
        where: { key, userId: user.id }
      })
    }

    // Handle custom prompt setting
    if (customPrompt !== undefined) {
      if (typeof customPrompt !== "string") {
        return NextResponse.json(
          { error: "Invalid prompt value" },
          { status: 400 }
        )
      }

      if (customPrompt === DEFAULT_INSTRUCTION || customPrompt === "") {
        await deleteSetting("customPrompt")
      } else {
        await upsertSetting("customPrompt", customPrompt)
      }
    }

    // Handle WordPress settings
    if (wordpress_site_url !== undefined) {
      if (wordpress_site_url) {
        await upsertSetting("wordpress_site_url", wordpress_site_url)
      } else {
        await deleteSetting("wordpress_site_url")
      }
    }

    if (wordpress_api_key !== undefined) {
      if (wordpress_api_key) {
        await upsertSetting("wordpress_api_key", wordpress_api_key)
      } else {
        await deleteSetting("wordpress_api_key")
      }
    }

    // Handle Gemini model setting
    if (gemini_model !== undefined) {
      if (gemini_model && gemini_model !== DEFAULT_MODEL) {
        await upsertSetting("gemini_model", gemini_model)
      } else {
        await deleteSetting("gemini_model")
      }
    }

    // Check if prompt is default
    const promptSetting = await prisma.settings.findFirst({
      where: { key: "customPrompt", userId: user.id },
    })

    return NextResponse.json({ success: true, isDefault: !promptSetting })
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("Failed to save settings:", error)
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    )
  }
}
