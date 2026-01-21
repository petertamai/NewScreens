"use client"

import * as React from "react"
import { Check, ChevronsUpDown, FolderOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { LibraryFolder } from "@/components/library-folders"

interface FolderComboboxProps {
  folders: LibraryFolder[]
  value: string
  onChange: (value: string) => void
}

export function FolderCombobox({ folders, value, onChange }: FolderComboboxProps) {
  const [open, setOpen] = React.useState(false)

  // Build options list
  const options = React.useMemo(() => {
    const items = [
      { value: "all", label: "All Folders", path: "" },
      { value: "root", label: "Root", path: "public/screenshots" },
      ...folders.map((f) => ({
        value: f.id.toString(),
        label: f.name,
        path: f.path,
      })),
    ]
    return items
  }, [folders])

  const selectedOption = options.find((opt) => opt.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-56 justify-between"
        >
          <span className="flex items-center gap-2 truncate">
            <FolderOpen className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {selectedOption?.label || "Select folder..."}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          <CommandInput placeholder="Search folders..." />
          <CommandList>
            <CommandEmpty>No folder found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.path}`}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{option.label}</p>
                    {option.path && (
                      <p className="text-xs text-muted-foreground truncate">
                        {option.path}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
