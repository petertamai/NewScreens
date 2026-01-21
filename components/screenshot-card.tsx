"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, ExternalLink, Calendar, FolderOpen, Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "@/hooks/use-toast"

interface Screenshot {
  id: number
  filename: string
  filepath: string
  description: string | null
  aiSuggestedName: string | null
  keywords?: string | null
  createdAt: string
  folderId?: number | null
  wpImageUrl?: string | null
}

interface ScreenshotCardProps {
  screenshot: Screenshot
  onDelete?: () => void
  selectionMode?: boolean
  isSelected?: boolean
  onSelectChange?: (id: number, selected: boolean) => void
}

// Get the proper image URL for display
// New format: relative paths starting with "/" (e.g., "/screenshots/folder/image.png")
// Legacy format: absolute Windows paths - still supported via /api/serve/
function getImageUrl(filepath: string): string {
  if (filepath.startsWith("/")) {
    // New relative format - serve directly from public/
    return filepath
  }
  // Legacy absolute path - serve via API (backwards compatibility)
  return `/api/serve/${encodeURIComponent(filepath)}`
}

export function ScreenshotCard({ screenshot, onDelete, selectionMode, isSelected, onSelectChange }: ScreenshotCardProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const imageUrl = getImageUrl(screenshot.filepath)

  // Parse keywords from JSON string
  const parsedKeywords: string[] = (() => {
    if (!screenshot.keywords) return []
    try {
      return JSON.parse(screenshot.keywords)
    } catch {
      return []
    }
  })()

  const formattedDate = new Date(screenshot.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/screenshots?id=${screenshot.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Delete failed")

      toast({
        title: "Deleted",
        description: "Screenshot has been deleted.",
      })

      onDelete?.()
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error("Delete error:", error)
      toast({
        title: "Delete Failed",
        description: "Could not delete the screenshot.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenFile = () => {
    window.open(imageUrl, "_blank")
  }

  const handleOpenFolder = async () => {
    try {
      const response = await fetch("/api/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filepath: screenshot.filepath }),
      })

      const data = await response.json()

      if (response.status === 501) {
        // Cloud mode - feature not available
        toast({
          title: "Not Available",
          description: "Opening folders is not available in cloud deployments.",
        })
        return
      }

      if (!response.ok) throw new Error(data.error || "Failed to open folder")

      toast({
        title: "Folder Opened",
        description: "File explorer opened to screenshot location.",
      })
    } catch (error) {
      console.error("Open folder error:", error)
      toast({
        title: "Error",
        description: "Could not open folder.",
        variant: "destructive",
      })
    }
  }

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(screenshot.filepath)
      toast({
        title: "Copied",
        description: "File path copied to clipboard.",
      })
    } catch (error) {
      console.error("Copy error:", error)
      toast({
        title: "Error",
        description: "Could not copy path.",
        variant: "destructive",
      })
    }
  }

  const handleCopyWpUrl = async () => {
    if (!screenshot.wpImageUrl) return
    try {
      await navigator.clipboard.writeText(screenshot.wpImageUrl)
      toast({
        title: "Copied",
        description: "WordPress URL copied to clipboard.",
      })
    } catch (error) {
      console.error("Copy error:", error)
      toast({
        title: "Error",
        description: "Could not copy URL.",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <Card className={`overflow-hidden group h-full flex flex-col ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        <div
          className="relative aspect-video cursor-pointer overflow-hidden flex-shrink-0"
          onClick={() => selectionMode ? onSelectChange?.(screenshot.id, !isSelected) : setShowPreview(true)}
        >
          <img
            src={imageUrl}
            alt={screenshot.description || screenshot.filename}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          {selectionMode && (
            <div className="absolute top-2 left-2 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelectChange?.(screenshot.id, !!checked)}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5 bg-white border-2 data-[state=checked]:bg-primary"
              />
            </div>
          )}
        </div>
        <CardContent className="p-3 flex-1 flex flex-col min-h-0">
          <h3 className="font-medium text-sm truncate flex-shrink-0" title={screenshot.filename}>
            {screenshot.filename}
          </h3>
          {screenshot.description && (
            <p
              className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-shrink-0"
              title={screenshot.description}
            >
              {screenshot.description}
            </p>
          )}
          {parsedKeywords.length > 0 && (
            <div
              className="mt-2 flex-shrink-0 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => {
                const el = e.currentTarget
                const startX = e.pageX - el.offsetLeft
                const scrollLeft = el.scrollLeft
                const onMouseMove = (e: MouseEvent) => {
                  const x = e.pageX - el.offsetLeft
                  el.scrollLeft = scrollLeft - (x - startX)
                }
                const onMouseUp = () => {
                  document.removeEventListener("mousemove", onMouseMove)
                  document.removeEventListener("mouseup", onMouseUp)
                }
                document.addEventListener("mousemove", onMouseMove)
                document.addEventListener("mouseup", onMouseUp)
              }}
            >
              <div className="flex gap-1 pb-1 w-max">
                {parsedKeywords.map((keyword, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 whitespace-nowrap select-none"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-1 mt-2 flex-shrink-0">
            <p
              className="text-xs text-muted-foreground truncate flex-1"
              title={screenshot.filepath}
            >
              {screenshot.filepath}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={handleCopyPath}
              title="Copy file path"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
          {screenshot.wpImageUrl && (
            <div className="flex items-center gap-1 mt-1 flex-shrink-0">
              <p
                className="text-xs text-blue-600 truncate flex-1"
                title={screenshot.wpImageUrl}
              >
                {screenshot.wpImageUrl}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={handleCopyWpUrl}
                title="Copy WordPress URL"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="p-3 pt-0 flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleOpenFolder}
              title="Open folder in Explorer"
            >
              <FolderOpen className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleOpenFile}
              title="Open image"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{screenshot.filename}</DialogTitle>
            {screenshot.description && (
              <DialogDescription>{screenshot.description}</DialogDescription>
            )}
          </DialogHeader>
          {parsedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 flex-shrink-0">
              {parsedKeywords.map((keyword, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-auto mt-4">
            <img
              src={imageUrl}
              alt={screenshot.description || screenshot.filename}
              className="w-full rounded-lg"
            />
          </div>
          <div className="flex justify-between items-center mt-4 flex-shrink-0">
            <span className="text-sm text-muted-foreground">{formattedDate}</span>
            <Button variant="outline" onClick={handleOpenFile}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Full Size
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Screenshot?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{screenshot.filename}&quot;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
