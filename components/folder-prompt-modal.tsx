"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DEFAULT_INSTRUCTION, JSON_OUTPUT_FORMAT } from "@/lib/gemini"

interface FolderPromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId: number | null  // null = Root folder (saves to Settings)
  folderName: string
  onSave?: () => void
}

export function FolderPromptModal({
  open,
  onOpenChange,
  folderId,
  folderName,
  onSave,
}: FolderPromptModalProps) {
  const [instruction, setInstruction] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false)
  const { toast } = useToast()

  // Fetch current prompt when modal opens
  useEffect(() => {
    if (!open) return

    const fetchPrompt = async () => {
      setIsLoading(true)
      try {
        if (folderId === null) {
          // Root folder - fetch from global settings
          const response = await fetch("/api/settings")
          if (response.ok) {
            const data = await response.json()
            // API returns customPrompt (or DEFAULT_INSTRUCTION if not set)
            setInstruction(data.customPrompt)
            setHasCustomPrompt(!data.isDefault)
          }
        } else {
          // Specific folder - fetch folder data
          const response = await fetch("/api/folders")
          if (response.ok) {
            const folders = await response.json()
            const folder = folders.find((f: { id: number }) => f.id === folderId)
            if (folder?.customPrompt) {
              setInstruction(folder.customPrompt)
              setHasCustomPrompt(true)
            } else {
              // No folder-specific prompt - fetch global default from settings
              const settingsResponse = await fetch("/api/settings")
              if (settingsResponse.ok) {
                const settingsData = await settingsResponse.json()
                setInstruction(settingsData.customPrompt)
                setHasCustomPrompt(false)
              } else {
                setInstruction(DEFAULT_INSTRUCTION)
                setHasCustomPrompt(false)
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch prompt:", error)
        setInstruction(DEFAULT_INSTRUCTION)
        setHasCustomPrompt(false)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPrompt()
  }, [open, folderId])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (folderId === null) {
        // Root folder - save to global settings
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customPrompt: instruction === DEFAULT_INSTRUCTION ? "" : instruction,
          }),
        })
        if (!response.ok) throw new Error("Failed to save")
      } else {
        // Specific folder - update folder's customPrompt
        const response = await fetch("/api/folders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: folderId,
            customPrompt: instruction === DEFAULT_INSTRUCTION ? "" : instruction,
          }),
        })
        if (!response.ok) throw new Error("Failed to save")
      }

      toast({
        title: "Prompt saved",
        description: `AI prompt for "${folderName}" has been updated.`,
      })
      setHasCustomPrompt(instruction !== DEFAULT_INSTRUCTION && instruction.trim() !== "")
      onSave?.()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to save prompt:", error)
      toast({
        title: "Error",
        description: "Failed to save prompt. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setInstruction(DEFAULT_INSTRUCTION)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Prompt for &quot;{folderName}&quot;</DialogTitle>
          <DialogDescription>
            Customize the AI analysis instructions for this folder.
            {folderId === null && " This is the global default prompt."}
            {hasCustomPrompt && " (customized)"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Analysis Instructions
                {instruction !== DEFAULT_INSTRUCTION && (
                  <span className="ml-2 text-xs text-muted-foreground">(modified)</span>
                )}
              </label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                className="w-full min-h-[200px] p-3 rounded-md border border-input bg-background text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="Enter your custom instructions..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                JSON Output Format (auto-appended, read-only)
              </label>
              <pre className="w-full p-3 rounded-md border border-input bg-muted/50 text-sm font-mono text-muted-foreground whitespace-pre-wrap">
                {JSON_OUTPUT_FORMAT.trim()}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isLoading || instruction === DEFAULT_INSTRUCTION}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
