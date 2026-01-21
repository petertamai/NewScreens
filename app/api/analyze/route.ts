import { NextRequest, NextResponse } from "next/server"
import { analyzeImage, DEFAULT_MODEL } from "@/lib/gemini"
import { prisma } from "@/lib/prisma"
import pricing from "@/lib/pricing.json"

type PricingData = { input: number; output: number }
const pricingMap = pricing as Record<string, PricingData>

export async function POST(request: NextRequest) {
  try {
    const { image, folderId } = await request.json()

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      )
    }

    let customInstruction: string | undefined
    let geminiModel: string = DEFAULT_MODEL

    // Fetch global settings (model and prompt)
    const globalSettings = await prisma.settings.findMany({
      where: {
        key: { in: ["customPrompt", "gemini_model"] }
      }
    })

    for (const setting of globalSettings) {
      if (setting.key === "gemini_model") {
        geminiModel = setting.value
      }
    }

    // 1. Check folder's custom prompt first
    if (folderId) {
      const folder = await prisma.libraryFolder.findUnique({
        where: { id: folderId },
        select: { customPrompt: true },
      })
      if (folder?.customPrompt) {
        customInstruction = folder.customPrompt
        console.log("[Analyze] Using folder custom prompt:", customInstruction.substring(0, 50) + "...")
      }
    }

    // 2. Fall back to global Settings prompt
    if (!customInstruction) {
      const promptSetting = globalSettings.find(s => s.key === "customPrompt")
      if (promptSetting?.value) {
        customInstruction = promptSetting.value
        console.log("[Analyze] Using global settings prompt:", customInstruction.substring(0, 50) + "...")
      }
    }

    // 3. analyzeImage uses DEFAULT_INSTRUCTION if undefined
    console.log("[Analyze] Final instruction:", customInstruction ? "CUSTOM" : "DEFAULT")
    console.log("[Analyze] Using model:", geminiModel)

    const result = await analyzeImage(image, customInstruction, geminiModel)

    // Calculate and save usage
    const { usage } = result
    const modelPricing = pricingMap[usage.model] || { input: 0, output: 0 }
    const inputCost = (usage.promptTokens / 1000) * modelPricing.input
    const outputCost = (usage.outputTokens / 1000) * modelPricing.output
    const totalCost = inputCost + outputCost

    await prisma.apiUsage.create({
      data: {
        model: usage.model,
        promptTokens: usage.promptTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        inputCost,
        outputCost,
        totalCost,
      },
    })

    return NextResponse.json({
      description: result.description,
      suggestedFilename: result.suggestedFilename,
      keywords: result.keywords,
      usage: {
        ...usage,
        inputCost,
        outputCost,
        totalCost,
      },
    })
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json(
      { error: "Failed to analyze image" },
      { status: 500 }
    )
  }
}
