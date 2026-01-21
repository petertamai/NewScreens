"use client"

import { useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Clock, FolderOpen, DollarSign } from "lucide-react"
import { LibraryFolders, LibraryFolder } from "@/components/library-folders"

interface UsageStats {
  totalCalls: number
  totalTokens: number
  totalCost: number
  byModel: Record<string, { calls: number; tokens: number; cost: number }>
}

interface SidebarProps {
  autoMode: boolean
  onAutoModeChange: (value: boolean) => void
  lastSaved?: string
  folders: LibraryFolder[]
  onFoldersChange: () => void
}

export function Sidebar({ autoMode, onAutoModeChange, lastSaved, folders, onFoldersChange }: SidebarProps) {
  const [screenshotCount, setScreenshotCount] = useState<number | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [screenshotsRes, usageRes] = await Promise.all([
          fetch("/api/screenshots"),
          fetch("/api/usage"),
        ])

        if (screenshotsRes.ok) {
          const data = await screenshotsRes.json()
          setScreenshotCount(data.length)
        }

        if (usageRes.ok) {
          const data = await usageRes.json()
          setUsageStats(data)
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      }
    }

    fetchData()
    // Refresh data periodically
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [lastSaved])

  return (
    <div className="w-64 border-r bg-muted/30 p-4 space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Screenshot Manager</h1>
        <p className="text-sm text-muted-foreground">Paste, analyze & save</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Auto Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {autoMode ? "Enabled" : "Disabled"}
            </span>
            <Switch
              checked={autoMode}
              onCheckedChange={onAutoModeChange}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {autoMode
              ? "Images will be analyzed and saved automatically on paste"
              : "Manual analysis and save controls"}
          </p>
        </CardContent>
      </Card>

      <LibraryFolders folders={folders} onFoldersChange={onFoldersChange} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Library
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {screenshotCount !== null ? screenshotCount : "..."}
          </p>
          <p className="text-xs text-muted-foreground">
            screenshots saved
          </p>
        </CardContent>
      </Card>

      {lastSaved && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm truncate" title={lastSaved}>
              {lastSaved}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            API Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">API Calls</span>
            <span className="font-medium">
              {usageStats?.totalCalls ?? 0}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Tokens</span>
            <span className="font-medium">
              {usageStats?.totalTokens?.toLocaleString() ?? 0}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Cost</span>
            <span className="font-medium text-green-600">
              ${usageStats?.totalCost?.toFixed(6) ?? "0.000000"}
            </span>
          </div>
          {usageStats?.byModel && Object.keys(usageStats.byModel).length > 0 && (
            <div className="pt-2 border-t mt-2">
              <p className="text-xs text-muted-foreground mb-1">By Model</p>
              {Object.entries(usageStats.byModel).map(([model, stats]) => (
                <div key={model} className="text-xs flex justify-between">
                  <span className="text-muted-foreground truncate max-w-[120px]" title={model}>
                    {model}
                  </span>
                  <span>${stats.cost.toFixed(6)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
