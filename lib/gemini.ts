import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const MODEL_NAME = "gemini-2.0-flash-lite"

export const DEFAULT_PROMPT = `Analyze this screenshot and provide:
1. A brief description of what the image shows (1-2 sentences)
2. A suggested filename that describes the content (no extension, use underscores for spaces, lowercase, max 50 chars)
3. 3-7 relevant keywords/tags that describe the content (each keyword must be at least 3 characters)

Respond in this exact JSON format:
{
  "description": "your description here",
  "suggestedFilename": "suggested_filename_here",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`

export interface UsageMetadata {
  model: string
  promptTokens: number
  outputTokens: number
  totalTokens: number
}

export interface AnalysisResult {
  description: string
  suggestedFilename: string
  keywords: string[]
  usage: UsageMetadata
}

export async function analyzeImage(base64Image: string, customPrompt?: string): Promise<AnalysisResult> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME })

  const prompt = customPrompt || DEFAULT_PROMPT

  // Remove data URL prefix if present
  const imageData = base64Image.replace(/^data:image\/\w+;base64,/, "")

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: "image/png",
        data: imageData,
      },
    },
  ])

  const response = await result.response
  const text = response.text()

  // Extract usage metadata from response
  const usageMetadata = response.usageMetadata
  const usage: UsageMetadata = {
    model: MODEL_NAME,
    promptTokens: usageMetadata?.promptTokenCount ?? 0,
    outputTokens: usageMetadata?.candidatesTokenCount ?? 0,
    totalTokens: usageMetadata?.totalTokenCount ?? 0,
  }

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error("Failed to parse AI response")
  }

  const parsed = JSON.parse(jsonMatch[0])
  return {
    description: parsed.description,
    suggestedFilename: parsed.suggestedFilename
      .replace(/[^a-z0-9_]/gi, "_")
      .toLowerCase()
      .substring(0, 50),
    keywords: (parsed.keywords || []).filter((k: string) => k.length >= 3),
    usage,
  }
}
