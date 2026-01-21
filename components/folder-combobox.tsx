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
          className="min-w-[300px] justify-between"
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
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search folders..." />
          <CommandList>
            <CommandEmpty>No folder found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
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
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
