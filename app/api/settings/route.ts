import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { DEFAULT_INSTRUCTION } from "@/lib/gemini"

export async function GET() {
  try {
    // Fetch all settings at once
    const settings = await prisma.settings.findMany()

    const settingsMap: Record<string, string> = {}
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value
    }

    return NextResponse.json({
      customPrompt: settingsMap["customPrompt"] || DEFAULT_INSTRUCTION,
      isDefault: !settingsMap["customPrompt"],
      wordpress_site_url: settingsMap["wordpress_site_url"] || "",
      wordpress_api_key: settingsMap["wordpress_api_key"] || "",
    })
  } catch (error) {
    console.error("Failed to fetch settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customPrompt, wordpress_site_url, wordpress_api_key } = body

    // Handle custom prompt setting
    if (customPrompt !== undefined) {
      if (typeof customPrompt !== "string") {
        return NextResponse.json(
          { error: "Invalid prompt value" },
          { status: 400 }
        )
      }

      // If the prompt is the same as default or empty, delete the setting
      if (customPrompt === DEFAULT_INSTRUCTION || customPrompt === "") {
        await prisma.settings.deleteMany({
          where: { key: "customPrompt" },
        })
      } else {
        // Upsert the custom prompt
        await prisma.settings.upsert({
          where: { key: "customPrompt" },
          update: { value: customPrompt },
          create: { key: "customPrompt", value: customPrompt },
        })
      }
    }

    // Handle WordPress settings
    if (wordpress_site_url !== undefined) {
      if (wordpress_site_url) {
        await prisma.settings.upsert({
          where: { key: "wordpress_site_url" },
          update: { value: wordpress_site_url },
          create: { key: "wordpress_site_url", value: wordpress_site_url },
        })
      } else {
        await prisma.settings.deleteMany({
          where: { key: "wordpress_site_url" },
        })
      }
    }

    if (wordpress_api_key !== undefined) {
      if (wordpress_api_key) {
        await prisma.settings.upsert({
          where: { key: "wordpress_api_key" },
          update: { value: wordpress_api_key },
          create: { key: "wordpress_api_key", value: wordpress_api_key },
        })
      } else {
        await prisma.settings.deleteMany({
          where: { key: "wordpress_api_key" },
        })
      }
    }

    // Check if prompt is default
    const promptSetting = await prisma.settings.findUnique({
      where: { key: "customPrompt" },
    })

    return NextResponse.json({ success: true, isDefault: !promptSetting })
  } catch (error) {
    console.error("Failed to save settings:", error)
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    )
  }
}
