"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sidebar } from "@/components/sidebar"
import { PasteZone } from "@/components/paste-zone"
import { ScreenshotCard } from "@/components/screenshot-card"
import { Input } from "@/components/ui/input"
import { Clipboard, History, Search, Loader2, Settings, ChevronDown, Trash2, Upload, RefreshCw, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { SettingsPanel } from "@/components/settings-panel"
import { LibraryFolder } from "@/components/library-folders"
import { FolderCombobox } from "@/components/folder-combobox"
import { Switch } from "@/components/ui/switch"

interface Screenshot {
  id: number
  filename: string
  filepath: string
  description: string | null
  aiSuggestedName: string | null
  createdAt: string
  folderId: number | null
  wpImageUrl: string | null
  wpAttachmentId: number | null
  keywords?: string | null
}

export default function Home() {
  const [autoMode, setAutoMode] = useState(false)
  const [lastSaved, setLastSaved] = useState<string>()
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [aiSearchQuery, setAiSearchQuery] = useState("")
  const [aiSearchResults, setAiSearchResults] = useState<{screenshot: Screenshot, confidence: number}[]>([])
  const [isAiSearching, setIsAiSearching] = useState(false)
  const [aiSearchReasoning, setAiSearchReasoning] = useState<string | null>(null)
  const [aiSearchError, setAiSearchError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [folders, setFolders] = useState<LibraryFolder[]>([])
  const [historyFolderFilter, setHistoryFolderFilter] = useState<string>("all")
  const [historySearchTerm, setHistorySearchTerm] = useState("")
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isQuickPasting, setIsQuickPasting] = useState(false)
  const [activeTab, setActiveTab] = useState("paste")
  const [wpUploadEnabled, setWpUploadEnabled] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isHistoryDragOver, setIsHistoryDragOver] = useState(false)
  const [dropProgress, setDropProgress] = useState<{current: number, total: number} | null>(null)

  // Filter screenshots based on selected folder and search term
  const filteredScreenshots = useMemo(() => {
    let result = screenshots

    // Filter by folder
    if (historyFolderFilter === "root") {
      result = result.filter(s => s.folderId === null)
    } else if (historyFolderFilter !== "all") {
      const folderId = parseInt(historyFolderFilter)
      result = result.filter(s => s.folderId === folderId)
    }

    // Filter by search term
    if (historySearchTerm.trim()) {
      const term = historySearchTerm.toLowerCase()
      result = result.filter(s =>
        s.filename.toLowerCase().includes(term) ||
        s.description?.toLowerCase().includes(term) ||
        s.aiSuggestedName?.toLowerCase().includes(term)
      )
    }

    return result
  }, [screenshots, historyFolderFilter, historySearchTerm])

  // Fetch library folders
  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch("/api/folders")
      if (response.ok) {
        const data = await response.json()
        setFolders(data)
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error)
    }
  }, [])

  // Load auto-mode and WP upload setting from localStorage, and fetch folders
  useEffect(() => {
    const savedAutoMode = localStorage.getItem("autoMode")
    if (savedAutoMode !== null) {
      setAutoMode(JSON.parse(savedAutoMode))
    }
    const savedWpUpload = localStorage.getItem("wpUploadEnabled")
    if (savedWpUpload !== null) {
      setWpUploadEnabled(JSON.parse(savedWpUpload))
    }
    fetchFolders()
  }, [fetchFolders])

  // Save auto-mode to localStorage
  const handleAutoModeChange = (value: boolean) => {
    setAutoMode(value)
    localStorage.setItem("autoMode", JSON.stringify(value))
  }

  // Save WP upload setting to localStorage
  const handleWpUploadChange = (value: boolean) => {
    setWpUploadEnabled(value)
    localStorage.setItem("wpUploadEnabled", JSON.stringify(value))
  }

  // Background WordPress upload (non-blocking)
  const uploadToWordPress = useCallback(async (screenshotId: number) => {
    try {
      const response = await fetch("/api/wordpress/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenshotId }),
      })
      const data = await response.json()
      if (data.success && data.wpImageUrl) {
        // Update local state to reflect the WordPress URL
        setScreenshots(prev => prev.map(s =>
          s.id === screenshotId
            ? { ...s, wpImageUrl: data.wpImageUrl, wpAttachmentId: data.wpAttachmentId }
            : s
        ))
      }
    } catch (error) {
      // Silent fail - don't interrupt user flow
      console.error("WordPress upload failed:", error)
    }
  }, [])

  // Fetch all screenshots
  const fetchScreenshots = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/screenshots")
      if (response.ok) {
        const data = await response.json()
        setScreenshots(data)
      }
    } catch (error) {
      console.error("Failed to fetch screenshots:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchScreenshots()
  }, [fetchScreenshots])

  // Handle save complete
  const handleSaveComplete = () => {
    setLastSaved(new Date().toLocaleTimeString())
    fetchScreenshots()
  }

  // Handle selection change
  const handleSelectChange = (id: number, selected: boolean) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(id)
      } else {
        newSet.delete(id)
      }
      return newSet
    })
  }

  // Handle select all (filtered)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredScreenshots.map(s => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  // Toggle selection mode
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectedIds(new Set())
    }
    setSelectionMode(!selectionMode)
  }

  // Bulk delete handler
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const response = await fetch("/api/screenshots/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })

      if (!response.ok) throw new Error("Bulk delete failed")

      const result = await response.json()
      toast({
        title: "Deleted",
        description: `${result.deleted} screenshot(s) deleted successfully.`,
      })

      setSelectedIds(new Set())
      setShowBulkDeleteConfirm(false)
      fetchScreenshots()
    } catch (error) {
      console.error("Bulk delete error:", error)
      toast({
        title: "Delete Failed",
        description: "Could not delete selected screenshots.",
        variant: "destructive",
      })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Handle paste in History tab for quick save
  const handleHistoryPaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) continue

        const reader = new FileReader()
        reader.onload = async (event) => {
          const imageData = event.target?.result as string
          setIsQuickPasting(true)

          try {
            // 1. Analyze image
            const analyzeRes = await fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image: imageData }),
            })
            if (!analyzeRes.ok) throw new Error("Analysis failed")
            const analysis = await analyzeRes.json()

            // 2. Determine target folder based on historyFolderFilter
            let targetFolderId: number | null | undefined = undefined
            if (historyFolderFilter === "root") {
              targetFolderId = null  // Explicitly save to root
            } else if (historyFolderFilter !== "all") {
              targetFolderId = parseInt(historyFolderFilter)
            } else {
              // If "all", use the selected folder from sidebar
              const selectedFolder = folders.find(f => f.isSelected)
              targetFolderId = selectedFolder ? selectedFolder.id : null
            }

            // 3. Upload image
            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: imageData,
                filename: analysis.suggestedFilename,
                description: analysis.description,
                targetFolderId,
              }),
            })
            if (!uploadRes.ok) throw new Error("Upload failed")
            const { filepath, filename, folderId } = await uploadRes.json()

            // 4. Save to database
            const dbRes = await fetch("/api/screenshots", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename,
                filepath,
                description: analysis.description,
                aiSuggestedName: analysis.suggestedFilename,
                folderId,
                keywords: analysis.keywords,
              }),
            })
            if (!dbRes.ok) throw new Error("Database save failed")
            const savedScreenshot = await dbRes.json()

            toast({
              title: "Screenshot Saved!",
              description: `Saved as ${filename}`,
            })

            fetchScreenshots()

            // 5. Background WordPress upload (non-blocking)
            if (wpUploadEnabled && savedScreenshot.id) {
              uploadToWordPress(savedScreenshot.id)
            }
          } catch (error) {
            console.error("Quick paste error:", error)
            toast({
              title: "Paste Failed",
              description: "Could not save the screenshot.",
              variant: "destructive",
            })
          } finally {
            setIsQuickPasting(false)
          }
        }
        reader.readAsDataURL(file)
        break
      }
    }
  }, [historyFolderFilter, folders, fetchScreenshots, wpUploadEnabled, uploadToWordPress])

  // Process a single dropped image through the full pipeline
  const processDroppedImage = useCallback(async (imageData: string) => {
    // 1. Analyze image
    const analyzeRes = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageData }),
    })
    if (!analyzeRes.ok) throw new Error("Analysis failed")
    const analysis = await analyzeRes.json()

    // 2. Determine target folder based on historyFolderFilter
    let targetFolderId: number | null | undefined = undefined
    if (historyFolderFilter === "root") {
      targetFolderId = null
    } else if (historyFolderFilter !== "all") {
      targetFolderId = parseInt(historyFolderFilter)
    } else {
      const selectedFolder = folders.find(f => f.isSelected)
      targetFolderId = selectedFolder ? selectedFolder.id : null
    }

    // 3. Upload image
    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imageData,
        filename: analysis.suggestedFilename,
        description: analysis.description,
        targetFolderId,
      }),
    })
    if (!uploadRes.ok) throw new Error("Upload failed")
    const { filepath, filename, folderId } = await uploadRes.json()

    // 4. Save to database
    const dbRes = await fetch("/api/screenshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        filepath,
        description: analysis.description,
        aiSuggestedName: analysis.suggestedFilename,
        folderId,
        keywords: analysis.keywords,
      }),
    })
    if (!dbRes.ok) throw new Error("Database save failed")
    const savedScreenshot = await dbRes.json()

    // 5. WordPress upload (if enabled)
    if (wpUploadEnabled && savedScreenshot.id) {
      uploadToWordPress(savedScreenshot.id)
    }

    fetchScreenshots()
  }, [historyFolderFilter, folders, fetchScreenshots, wpUploadEnabled, uploadToWordPress])

  // Handle drag-and-drop in History tab
  const handleHistoryDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsHistoryDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))
    if (files.length === 0) return

    setDropProgress({ current: 0, total: files.length })

    let successCount = 0
    for (let i = 0; i < files.length; i++) {
      setDropProgress({ current: i + 1, total: files.length })

      const file = files[i]
      const imageData = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (event) => resolve(event.target?.result as string)
        reader.readAsDataURL(file)
      })

      try {
        await processDroppedImage(imageData)
        successCount++
      } catch (error) {
        console.error("Failed to process dropped image:", error)
      }
    }

    setDropProgress(null)
    toast({
      title: "Upload Complete",
      description: `${successCount} image(s) processed successfully.`,
    })
  }, [processDroppedImage])

  // Sync all unsynced screenshots in current folder to WordPress
  const handleSyncToWordPress = useCallback(async () => {
    // Get screenshots to sync (from current folder filter, without wpImageUrl)
    const screenshotsToSync = filteredScreenshots.filter(s => !s.wpImageUrl)

    if (screenshotsToSync.length === 0) {
      toast({
        title: "Already Synced",
        description: "All screenshots in this folder are already uploaded to WordPress.",
      })
      return
    }

    setIsSyncing(true)
    toast({
      title: "Syncing to WordPress",
      description: `Uploading ${screenshotsToSync.length} screenshot(s)...`,
    })

    try {
      const response = await fetch("/api/wordpress/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: screenshotsToSync.map(s => s.id) }),
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Sync Complete",
          description: `Uploaded ${result.uploaded} of ${result.total} screenshot(s) to WordPress.`,
        })
        fetchScreenshots()
      } else {
        throw new Error(result.message || "Sync failed")
      }
    } catch (error) {
      console.error("WordPress sync error:", error)
      toast({
        title: "Sync Failed",
        description: "Could not sync screenshots to WordPress.",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }, [filteredScreenshots, fetchScreenshots])

  // Copy prompt data for current folder to clipboard
  const handleCopyPrompt = useCallback(async () => {
    const promptData = filteredScreenshots.map(s => {
      // Parse keywords from JSON string to comma-separated
      let keywordsStr = ""
      if (s.keywords) {
        try {
          const parsed = JSON.parse(s.keywords)
          keywordsStr = Array.isArray(parsed) ? parsed.join(", ") : ""
        } catch {
          keywordsStr = ""
        }
      }

      // Extract just filename from filepath
      const filename = s.filepath.split(/[/\\]/).pop() || s.filename

      return {
        filename,
        url: s.wpImageUrl || "",
        description: s.description || "",
        keywords: keywordsStr
      }
    })

    try {
      await navigator.clipboard.writeText(JSON.stringify(promptData, null, 2))
      toast({
        title: "Copied!",
        description: `${promptData.length} image(s) copied to clipboard as JSON.`,
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      })
    }
  }, [filteredScreenshots])

  // Attach paste listener when History tab is active
  useEffect(() => {
    if (activeTab === "history") {
      window.addEventListener("paste", handleHistoryPaste)
      return () => window.removeEventListener("paste", handleHistoryPaste)
    }
  }, [activeTab, handleHistoryPaste])

  // AI-powered semantic search handler
  const handleAiSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!aiSearchQuery.trim()) return

    setIsAiSearching(true)
    setAiSearchError(null)
    setAiSearchReasoning(null)
    setAiSearchResults([])

    try {
      const response = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiSearchQuery }),
      })

      if (!response.ok) {
        throw new Error("Search failed")
      }

      const data = await response.json()

      // Map AI results to full screenshot objects
      const resultsWithScreenshots = (data.results || [])
        .map((r: { id: number; confidence: number }) => ({
          screenshot: screenshots.find((s) => s.id === r.id),
          confidence: r.confidence,
        }))
        .filter((r: { screenshot: Screenshot | undefined; confidence: number }) => r.screenshot)

      setAiSearchResults(resultsWithScreenshots)
      setAiSearchReasoning(data.reasoning)
    } catch (error) {
      console.error("AI Search failed:", error)
      setAiSearchError("Failed to perform AI search. Please try again.")
    } finally {
      setIsAiSearching(false)
    }
  }

  // Helper function to get confidence badge color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "bg-green-500"
    if (confidence >= 70) return "bg-emerald-500"
    if (confidence >= 50) return "bg-yellow-500"
    return "bg-orange-500"
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        autoMode={autoMode}
        onAutoModeChange={handleAutoModeChange}
        lastSaved={lastSaved}
        folders={folders}
        onFoldersChange={fetchFolders}
      />

      <main className="flex-1 overflow-auto">
        <Tabs defaultValue="paste" value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b px-6 py-3">
            <TabsList>
              <TabsTrigger value="paste" className="gap-2">
                <Clipboard className="h-4 w-4" />
                Paste & Save
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-2">
                <Search className="h-4 w-4" />
                Search
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-6">
            {/* Paste Tab */}
            <TabsContent value="paste" className="mt-0">
              <PasteZone
                autoMode={autoMode}
                onSaveComplete={handleSaveComplete}
              />
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="mt-0">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsHistoryDragOver(true) }}
                onDragLeave={(e) => { e.preventDefault(); setIsHistoryDragOver(false) }}
                onDrop={handleHistoryDrop}
                className={`transition-all ${isHistoryDragOver ? 'ring-2 ring-primary ring-inset rounded-lg' : ''}`}
              >
              {/* Drop Progress Overlay */}
              {dropProgress && (
                <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg font-medium">
                      Processing {dropProgress.current}/{dropProgress.total}...
                    </p>
                  </div>
                </div>
              )}
              {/* Quick Paste Loading Overlay */}
              {isQuickPasting && (
                <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg font-medium">Analyzing and saving screenshot...</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-lg font-semibold">Screenshot History</h2>
                <div className="flex items-center gap-2">
                  <Switch
                    id="wp-upload-toggle"
                    checked={wpUploadEnabled}
                    onCheckedChange={handleWpUploadChange}
                  />
                  <label
                    htmlFor="wp-upload-toggle"
                    className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="h-3 w-3" />
                    Auto-upload to WordPress
                  </label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncToWordPress}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync to WordPress'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy Prompt
                </Button>
                {selectionMode && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={filteredScreenshots.length > 0 && selectedIds.size === filteredScreenshots.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.size} selected
                    </span>
                  </div>
                )}
                {selectionMode && selectedIds.size > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Actions
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setShowBulkDeleteConfirm(true)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Selected ({selectedIds.size})
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <div className="flex-1 flex justify-center">
                  <Input
                    placeholder="Search history..."
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <Button
                  variant={selectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleSelectionMode}
                >
                  {selectionMode ? "Done" : "Select"}
                </Button>
                <FolderCombobox
                  folders={folders}
                  value={historyFolderFilter}
                  onChange={setHistoryFolderFilter}
                />
              </div>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredScreenshots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No screenshots {historyFolderFilter !== "all" || historySearchTerm ? "matching filters" : "yet"}</p>
                  <p className="text-sm">
                    {historyFolderFilter !== "all" || historySearchTerm
                      ? "Try adjusting your search or folder filter"
                      : "Paste an image to get started"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredScreenshots.map((screenshot) => (
                    <ScreenshotCard
                      key={screenshot.id}
                      screenshot={screenshot}
                      onDelete={fetchScreenshots}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(screenshot.id)}
                      onSelectChange={handleSelectChange}
                    />
                  ))}
                </div>
              )}

              {/* Bulk Delete Confirmation Dialog */}
              <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete {selectedIds.size} Screenshot(s)?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete the selected screenshots. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleBulkDelete}
                      disabled={isBulkDeleting}
                    >
                      {isBulkDeleting ? "Deleting..." : `Delete ${selectedIds.size} Screenshot(s)`}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
            </TabsContent>

            {/* Search Tab - AI-Powered Semantic Search */}
            <TabsContent value="search" className="mt-0">
              <div className="mb-6">
                <form onSubmit={handleAiSearch} className="flex gap-2 max-w-xl">
                  <Input
                    placeholder="Search with AI (e.g., 'code with errors', 'login screens')..."
                    value={aiSearchQuery}
                    onChange={(e) => setAiSearchQuery(e.target.value)}
                    className="flex-1"
                    disabled={isAiSearching}
                  />
                  <Button type="submit" disabled={isAiSearching || !aiSearchQuery.trim()}>
                    {isAiSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Search</span>
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground mt-2">
                  AI-powered semantic search understands context and meaning, not just keywords.
                </p>
              </div>

              {/* AI Reasoning Display */}
              {aiSearchReasoning && (
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">AI Analysis:</p>
                  <p className="text-sm text-muted-foreground">{aiSearchReasoning}</p>
                </div>
              )}

              {/* Error Display */}
              {aiSearchError && (
                <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-lg">
                  <p className="text-sm">{aiSearchError}</p>
                </div>
              )}

              {isAiSearching ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">AI is analyzing your query...</p>
                </div>
              ) : aiSearchResults.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Found {aiSearchResults.length} result{aiSearchResults.length !== 1 ? "s" : ""}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {aiSearchResults.map(({ screenshot, confidence }) => (
                      <div key={screenshot.id} className="relative">
                        <ScreenshotCard
                          screenshot={screenshot}
                          onDelete={() => {
                            fetchScreenshots()
                            // Re-run search after delete
                            if (aiSearchQuery.trim()) {
                              handleAiSearch({ preventDefault: () => {} } as React.FormEvent)
                            }
                          }}
                        />
                        <div
                          className={`absolute top-2 right-2 ${getConfidenceColor(confidence)} text-white text-xs font-bold px-2 py-1 rounded-full shadow-md`}
                        >
                          {confidence}%
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : aiSearchQuery && !isAiSearching && !aiSearchError ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No results found for &quot;{aiSearchQuery}&quot;</p>
                  <p className="text-sm mt-2">Try different search terms or check your library has screenshots</p>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Enter a search query and press Enter or click Search</p>
                  <p className="text-sm mt-2">The AI will understand semantic meaning and find relevant screenshots</p>
                </div>
              )}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="mt-0">
              <SettingsPanel />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  )
}
