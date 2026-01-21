"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderOpen, Plus, X } from "lucide-react"
import { AddFolderDialog } from "./add-folder-dialog"
import { toast } from "@/hooks/use-toast"

export interface LibraryFolder {
  id: number
  name: string
  path: string
  isSelected: boolean
  createdAt: string
}

interface LibraryFoldersProps {
  folders: LibraryFolder[]
  onFoldersChange: () => void
}

export function LibraryFolders({ folders, onFoldersChange }: LibraryFoldersProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  // Check if any folder is selected - if not, Root is selected
  const isRootSelected = folders.length === 0 || !folders.some(f => f.isSelected)

  const handleSelectRoot = async () => {
    if (isRootSelected) return

    // Deselect all folders
    try {
      const response = await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: null, deselectAll: true }),
      })

      if (!response.ok) throw new Error("Failed to select root")

      onFoldersChange()
    } catch (error) {
      console.error("Select root error:", error)
      toast({
        title: "Error",
        description: "Failed to select root folder",
        variant: "destructive",
      })
    }
  }

  const handleSelectFolder = async (folderId: number) => {
    try {
      const response = await fetch("/api/folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folderId, isSelected: true }),
      })

      if (!response.ok) throw new Error("Failed to select folder")

      onFoldersChange()
    } catch (error) {
      console.error("Select folder error:", error)
      toast({
        title: "Error",
        description: "Failed to select folder",
        variant: "destructive",
      })
    }
  }

  const handleDeleteFolder = async (folderId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDeleting(folderId)

    try {
      const response = await fetch(`/api/folders?id=${folderId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete folder")

      toast({
        title: "Folder removed",
        description: "Folder has been removed from the list",
      })

      onFoldersChange()
    } catch (error) {
      console.error("Delete folder error:", error)
      toast({
        title: "Error",
        description: "Failed to remove folder",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleFolderAdded = () => {
    setIsDialogOpen(false)
    onFoldersChange()
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Library Folders
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 max-h-48 overflow-y-auto">
          {/* Root folder - always shown */}
          <div
            className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
              isRootSelected ? "bg-muted" : ""
            }`}
            onClick={handleSelectRoot}
          >
            <div
              className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                isRootSelected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground"
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">Root</p>
            </div>
          </div>

          {/* Custom folders */}
          {folders.map((folder) => (
            <div
              key={folder.id}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-muted/50 group ${
                folder.isSelected ? "bg-muted" : ""
              }`}
              onClick={() => handleSelectFolder(folder.id)}
            >
              <div
                className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                  folder.isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{folder.name}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => handleDeleteFolder(folder.id, e)}
                disabled={isDeleting === folder.id}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AddFolderDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onFolderAdded={handleFolderAdded}
      />
    </>
  )
}
