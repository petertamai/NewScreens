"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface AddFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFolderAdded: () => void
}

export function AddFolderDialog({
  open,
  onOpenChange,
  onFolderAdded,
}: AddFolderDialogProps) {
  const [folderPath, setFolderPath] = useState("")
  const [folderName, setFolderName] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    error?: string
    name?: string
    path?: string
    willCreate?: boolean
  } | null>(null)

  const handlePathChange = (value: string) => {
    setFolderPath(value)
    setValidationResult(null)
  }

  const handleValidate = async () => {
    if (!folderPath.trim()) return

    setIsValidating(true)
    setValidationResult(null)

    try {
      const response = await fetch("/api/folders/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath }),
      })

      const result = await response.json()
      setValidationResult(result)

      if (result.valid && result.name && !folderName) {
        setFolderName(result.name)
      }
    } catch (error) {
      console.error("Validation error:", error)
      setValidationResult({ valid: false, error: "Validation failed" })
    } finally {
      setIsValidating(false)
    }
  }

  const handleAdd = async () => {
    if (!validationResult?.valid) {
      await handleValidate()
      return
    }

    setIsAdding(true)

    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: folderPath,
          name: folderName || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add folder")
      }

      toast({
        title: "Folder added",
        description: `${folderName || folderPath} has been added to your library`,
      })

      // Reset and close
      setFolderPath("")
      setFolderName("")
      setValidationResult(null)
      onFolderAdded()
    } catch (error) {
      console.error("Add folder error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add folder",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handleClose = () => {
    setFolderPath("")
    setFolderName("")
    setValidationResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Library Folder</DialogTitle>
          <DialogDescription>
            Enter a folder name to create a subfolder in the screenshots directory,
            or paste a full path (e.g., D:\Screenshots) to use an existing folder.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Folder Path</label>
            <div className="flex gap-2">
              <Input
                placeholder="MyFolder or D:\Screenshots"
                value={folderPath}
                onChange={(e) => handlePathChange(e.target.value)}
                onBlur={handleValidate}
              />
              <Button
                variant="outline"
                onClick={handleValidate}
                disabled={isValidating || !folderPath.trim()}
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Validate"
                )}
              </Button>
            </div>
            {validationResult && (
              <div
                className={`flex items-start gap-2 text-sm ${
                  validationResult.valid
                    ? "text-green-600"
                    : "text-destructive"
                }`}
              >
                {validationResult.valid ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                )}
                <span className="break-all">
                  {validationResult.valid
                    ? validationResult.willCreate
                      ? `Folder will be created at: ${validationResult.path}`
                      : "Path is valid and writable"
                    : validationResult.error}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Display Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              placeholder="Auto-generated from path"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={isAdding || !folderPath.trim()}
          >
            {isAdding ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Folder"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
