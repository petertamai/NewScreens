import { NextRequest, NextResponse } from "next/server"
import { analyzeImage } from "@/lib/gemini"
import { prisma } from "@/lib/prisma"
import pricing from "@/lib/pricing.json"

type PricingData = { input: number; output: number }
const pricingMap = pricing as Record<string, PricingData>

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      )
    }

    // Fetch custom prompt from settings
    const setting = await prisma.settings.findUnique({
      where: { key: "customPrompt" },
    })
    const customPrompt = setting?.value
    console.log("[Analyze] Setting from DB:", setting)
    console.log("[Analyze] Custom prompt:", customPrompt ? `FOUND (${customPrompt.substring(0, 50)}...)` : "NOT FOUND - using default")

    const result = await analyzeImage(image, customPrompt)

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
