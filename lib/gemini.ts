import { GoogleGenerativeAI } from "@google/generative-ai"

export function createGeminiClient(apiKey: string) {
  return new GoogleGenerativeAI(apiKey)
}

export const DEFAULT_MODEL = "gemini-2.0-flash-lite"

export const AVAILABLE_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.5-pro",
  "gemini-3-pro-preview",
] as const

export type GeminiModel = (typeof AVAILABLE_MODELS)[number]

// Protected JSON format - auto-appended, never editable by users
export const JSON_OUTPUT_FORMAT = `

OUTPUT FORMAT (strict JSON):
{
  "description": "[Comprehensive description with ALL data points extracted]",
  "suggestedFilename": "[descriptive_filename_with_entities_and_metrics]",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"]
}`

// Default instruction (the editable part)
export const DEFAULT_INSTRUCTION = `Analyze this screenshot and provide:
1. A brief description of what the image shows (1-2 sentences)
2. A suggested filename that describes the content (no extension, use underscores for spaces, lowercase, max 50 chars)
3. 3-7 relevant keywords/tags that describe the content (each keyword must be at least 3 characters)`

// Legacy export for backwards compatibility
export const DEFAULT_PROMPT = DEFAULT_INSTRUCTION + JSON_OUTPUT_FORMAT

// Helper to build full prompt from instruction
export function buildPrompt(instruction: string): string {
  return instruction.trim() + JSON_OUTPUT_FORMAT
}

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

export async function analyzeImage(
  base64Image: string,
  customInstruction?: string,
  modelName?: string,
  apiKey?: string
): Promise<AnalysisResult> {
  if (!apiKey) {
    throw new Error("Gemini API key is required")
  }
  const genAI = createGeminiClient(apiKey)
  const selectedModel = modelName || DEFAULT_MODEL
  const model = genAI.getGenerativeModel({ model: selectedModel })

  // Build full prompt: instruction + protected JSON format
  const prompt = buildPrompt(customInstruction || DEFAULT_INSTRUCTION)

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
    model: selectedModel,
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
