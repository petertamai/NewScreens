import { NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { prisma } from "@/lib/prisma"
import { DEFAULT_MODEL } from "@/lib/gemini"
import pricing from "@/lib/pricing.json"

type PricingData = { input: number; output: number }
const pricingMap = pricing as Record<string, PricingData>

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const SYSTEM_PROMPT = `You are a semantic search engine for a screenshot library.
Given a catalog of screenshots and a user query, find matching screenshots.
Match based on: keywords, semantic similarity, conceptual relationships.
Return JSON: { "results": [{ "id": X, "confidence": 0-100 }], "reasoning": "..." }
Confidence levels:
- 90-100: Excellent match (direct keyword match or very strong semantic match)
- 70-89: Good match (related concept or partial keyword match)
- 50-69: Moderate match (loosely related)
- 30-49: Weak match (tangentially related)
Return maximum 20 results, only include results with confidence >= 30.
Sort results by confidence descending.`

interface SearchResult {
  id: number
  confidence: number
}

interface AIResponse {
  results: SearchResult[]
  reasoning: string
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      )
    }

    // Fetch gemini_model from settings
    const modelSetting = await prisma.settings.findUnique({
      where: { key: "gemini_model" }
    })
    const selectedModel = modelSetting?.value || DEFAULT_MODEL

    // Fetch screenshots (limit to 200 most recent for token management)
    const screenshots = await prisma.screenshot.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        filename: true,
        aiSuggestedName: true,
        keywords: true,
        description: true,
      },
    })

    if (screenshots.length === 0) {
      return NextResponse.json({
        results: [],
        reasoning: "No screenshots in the library to search.",
        usage: {
          model: selectedModel,
          promptTokens: 0,
          outputTokens: 0,
          totalCost: 0,
        },
      })
    }

    // Build context string for the AI
    const catalogLines = screenshots.map((s) => {
      const keywords = s.keywords ? JSON.parse(s.keywords).join(", ") : ""
      return `[ID:${s.id}] "${s.filename}" | ${s.aiSuggestedName || "no suggestion"} | Keywords: ${keywords || "none"} | Description: ${s.description || "none"}`
    })
    const catalog = catalogLines.join("\n")

    // Build the prompt
    const userPrompt = `Screenshot Catalog:
${catalog}

User Search Query: "${query.trim()}"

Find matching screenshots and return the results as JSON.`

    // Call Gemini API with dynamic model
    console.log("[AI Search] Using model:", selectedModel)
    const model = genAI.getGenerativeModel({ model: selectedModel })
    const result = await model.generateContent([
      SYSTEM_PROMPT,
      userPrompt,
    ])

    const response = await result.response
    const text = response.text()

    // Extract usage metadata
    const usageMetadata = response.usageMetadata
    const promptTokens = usageMetadata?.promptTokenCount ?? 0
    const outputTokens = usageMetadata?.candidatesTokenCount ?? 0

    // Calculate costs
    const modelPricing = pricingMap[selectedModel] || { input: 0, output: 0 }
    const inputCost = (promptTokens / 1000) * modelPricing.input
    const outputCost = (outputTokens / 1000) * modelPricing.output
    const totalCost = inputCost + outputCost

    // Save API usage to database
    await prisma.apiUsage.create({
      data: {
        model: selectedModel,
        promptTokens,
        outputTokens,
        totalTokens: promptTokens + outputTokens,
        inputCost,
        outputCost,
        totalCost,
      },
    })

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error("Failed to parse AI response:", text)
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      )
    }

    let parsed: AIResponse
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error("JSON parse error:", e, "Text:", jsonMatch[0])
      return NextResponse.json(
        { error: "Failed to parse AI response JSON" },
        { status: 500 }
      )
    }

    // Validate that all returned IDs exist in our database
    const validIds = new Set(screenshots.map((s) => s.id))
    const validatedResults = (parsed.results || [])
      .filter((r) => validIds.has(r.id) && r.confidence >= 30)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20)

    return NextResponse.json({
      results: validatedResults,
      reasoning: parsed.reasoning || "",
      usage: {
        model: selectedModel,
        promptTokens,
        outputTokens,
        totalCost,
      },
      totalScreenshots: screenshots.length,
    })
  } catch (error) {
    console.error("AI Search error:", error)
    return NextResponse.json(
      { error: "Failed to perform AI search" },
      { status: 500 }
    )
  }
}
