import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import pricing from "@/lib/pricing.json"

type PricingData = { input: number; output: number }
const pricingMap = pricing as Record<string, PricingData>

export async function GET() {
  try {
    const usageRecords = await prisma.apiUsage.findMany({
      orderBy: { createdAt: "desc" },
    })

    const totalCalls = usageRecords.length
    const totalTokens = usageRecords.reduce((sum, r) => sum + r.totalTokens, 0)
    const totalCost = usageRecords.reduce((sum, r) => sum + r.totalCost, 0)

    // Group by model
    const byModel = usageRecords.reduce((acc, r) => {
      if (!acc[r.model]) {
        acc[r.model] = { calls: 0, tokens: 0, cost: 0 }
      }
      acc[r.model].calls++
      acc[r.model].tokens += r.totalTokens
      acc[r.model].cost += r.totalCost
      return acc
    }, {} as Record<string, { calls: number; tokens: number; cost: number }>)

    // Group by day (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentRecords = usageRecords.filter(r => r.createdAt >= sevenDaysAgo)
    const byDay = recentRecords.reduce((acc, r) => {
      const day = r.createdAt.toISOString().split("T")[0]
      if (!acc[day]) {
        acc[day] = { calls: 0, tokens: 0, cost: 0 }
      }
      acc[day].calls++
      acc[day].tokens += r.totalTokens
      acc[day].cost += r.totalCost
      return acc
    }, {} as Record<string, { calls: number; tokens: number; cost: number }>)

    return NextResponse.json({
      totalCalls,
      totalTokens,
      totalCost,
      byModel,
      byDay,
    })
  } catch (error) {
    console.error("Failed to fetch usage stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch usage stats" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { model, promptTokens, outputTokens, totalTokens, screenshotId } = await request.json()

    // Calculate costs based on pricing (per 1K tokens)
    const modelPricing = pricingMap[model] || { input: 0, output: 0 }
    const inputCost = (promptTokens / 1000) * modelPricing.input
    const outputCost = (outputTokens / 1000) * modelPricing.output
    const totalCost = inputCost + outputCost

    const usage = await prisma.apiUsage.create({
      data: {
        model,
        promptTokens,
        outputTokens,
        totalTokens,
        inputCost,
        outputCost,
        totalCost,
        screenshotId: screenshotId || null,
      },
    })

    return NextResponse.json(usage)
  } catch (error) {
    console.error("Failed to record usage:", error)
    return NextResponse.json(
      { error: "Failed to record usage" },
      { status: 500 }
    )
  }
}
