"use client"

import { useEffect, useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clipboard, Loader2, Save, Sparkles, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface PasteZoneProps {
  autoMode: boolean
  onSaveComplete?: () => void
  selectedFolderId?: number | null
}

export function PasteZone({ autoMode, onSaveComplete, selectedFolderId }: PasteZoneProps) {
  const [image, setImage] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [description, setDescription] = useState("")
  const [suggestedFilename, setSuggestedFilename] = useState("")
  const [editedFilename, setEditedFilename] = useState("")
  const [keywords, setKeywords] = useState<string[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const clearImage = useCallback(() => {
    setImage(null)
    setDescription("")
    setSuggestedFilename("")
    setEditedFilename("")
    setKeywords([])
    setIsAnalyzing(false)
    setIsSaving(false)
  }, [])

  const analyzeImage = useCallback(async (imageData: string) => {
    setIsAnalyzing(true)
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, folderId: selectedFolderId }),
      })

      if (!response.ok) throw new Error("Analysis failed")

      const result = await response.json()
      setDescription(result.description)
      setSuggestedFilename(result.suggestedFilename)
      setEditedFilename(result.suggestedFilename)
      setKeywords(result.keywords || [])

      return result
    } catch (error) {
      console.error("Analysis error:", error)
      toast({
        title: "Analysis Failed",
        description: "Could not analyze the image. Please try again.",
        variant: "destructive",
      })
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }, [selectedFolderId])

  const saveImage = useCallback(async (imageData: string, filename: string, desc: string, aiName: string, tags: string[] = []) => {
    setIsSaving(true)
    try {
      // Upload image (API will use selected folder automatically)
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, filename, description: desc }),
      })

      if (!uploadResponse.ok) throw new Error("Upload failed")

      const { filepath, filename: savedFilename, folderId } = await uploadResponse.json()

      // Save to database
      const dbResponse = await fetch("/api/screenshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: savedFilename,
          filepath,
          description: desc,
          aiSuggestedName: aiName,
          folderId,
          keywords: tags,
        }),
      })

      if (!dbResponse.ok) throw new Error("Database save failed")

      toast({
        title: "Saved!",
        description: `Screenshot saved as ${savedFilename}`,
      })

      clearImage()
      onSaveComplete?.()
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "Save Failed",
        description: "Could not save the screenshot. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }, [clearImage, onSaveComplete])

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()
        if (!file) continue

        const reader = new FileReader()
        reader.onload = async (event) => {
          const imageData = event.target?.result as string
          setImage(imageData)

          if (autoMode) {
            // Auto mode: analyze and save automatically
            const result = await analyzeImage(imageData)
            if (result) {
              await saveImage(imageData, result.suggestedFilename, result.description, result.suggestedFilename, result.keywords || [])
            }
          }
        }
        reader.readAsDataURL(file)
        break
      }
    }
  }, [autoMode, analyzeImage, saveImage])

  // Helper function for auto-mode that returns a Promise
  const analyzeAndSave = useCallback(async (imageData: string) => {
    const result = await analyzeImage(imageData)
    if (result) {
      await saveImage(imageData, result.suggestedFilename, result.description, result.suggestedFilename, result.keywords || [])
    }
  }, [analyzeImage, saveImage])

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))
    if (files.length === 0) return

    // Process each image sequentially
    for (const file of files) {
      const imageData = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (event) => resolve(event.target?.result as string)
        reader.readAsDataURL(file)
      })

      setImage(imageData)
      if (autoMode) {
        await analyzeAndSave(imageData) // Wait for completion before next
      } else {
        // In manual mode, just show the last dropped image for preview
        break
      }
    }
  }, [autoMode, analyzeAndSave])

  useEffect(() => {
    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [handlePaste])

  const handleManualAnalyze = () => {
    if (image) {
      analyzeImage(image)
    }
  }

  const handleManualSave = () => {
    if (image && editedFilename) {
      saveImage(image, editedFilename, description, suggestedFilename, keywords)
    }
  }

  if (!image) {
    return (
      <Card
        className={`border-dashed border-2 min-h-[400px] flex items-center justify-center transition-colors ${
          isDragOver ? 'border-primary bg-primary/5' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardContent className="text-center py-16">
          <Clipboard className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Paste or Drop an Image</h3>
          <p className="text-muted-foreground mb-4">
            Copy a screenshot and press <kbd className="px-2 py-1 bg-muted rounded text-sm">Ctrl+V</kbd> or drag & drop images here
          </p>
          {autoMode && (
            <p className="text-sm text-green-600 font-medium">
              Auto-mode is ON - images will be analyzed and saved automatically
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={`min-h-[400px] transition-colors ${
        isDragOver ? 'ring-2 ring-primary ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="p-6">
        <div className="flex justify-end mb-4">
          <Button variant="ghost" size="icon" onClick={clearImage}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image Preview */}
          <div className="space-y-4">
            <img
              src={image}
              alt="Pasted screenshot"
              className="w-full rounded-lg border shadow-sm"
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing image...</span>
              </div>
            )}

            {isSaving && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}

            {!autoMode && !isAnalyzing && !isSaving && (
              <>
                {!description && (
                  <Button onClick={handleManualAnalyze} className="w-full">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze with AI
                  </Button>
                )}

                {description && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        AI Description
                      </label>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        {description}
                      </p>
                    </div>

                    {keywords.length > 0 && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Keywords
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {keywords.map((keyword, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Filename
                      </label>
                      <Input
                        value={editedFilename}
                        onChange={(e) => setEditedFilename(e.target.value)}
                        placeholder="Enter filename"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        AI suggested: {suggestedFilename}
                      </p>
                    </div>

                    <Button
                      onClick={handleManualSave}
                      className="w-full"
                      disabled={!editedFilename}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Screenshot
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
