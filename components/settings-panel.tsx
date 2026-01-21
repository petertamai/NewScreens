"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { Loader2, RotateCcw, Save, Globe, Key, CheckCircle2, XCircle, Download } from "lucide-react"
import { DEFAULT_INSTRUCTION, JSON_OUTPUT_FORMAT } from "@/lib/gemini"

export function SettingsPanel() {
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDefault, setIsDefault] = useState(true)
  const { toast } = useToast()

  // WordPress settings
  const [wpSiteUrl, setWpSiteUrl] = useState("")
  const [wpApiKey, setWpApiKey] = useState("")
  const [isWpSaving, setIsWpSaving] = useState(false)
  const [isWpTesting, setIsWpTesting] = useState(false)
  const [wpConnectionStatus, setWpConnectionStatus] = useState<"untested" | "success" | "error">("untested")
  const [wpConnectionMessage, setWpConnectionMessage] = useState("")

  // Fetch current settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings")
        if (response.ok) {
          const data = await response.json()
          setPrompt(data.customPrompt)
          setIsDefault(data.isDefault)
          // Load WordPress settings
          if (data.wordpress_site_url) setWpSiteUrl(data.wordpress_site_url)
          if (data.wordpress_api_key) setWpApiKey(data.wordpress_api_key)
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error)
        setPrompt(DEFAULT_INSTRUCTION)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPrompt: prompt }),
      })

      if (response.ok) {
        const data = await response.json()
        setIsDefault(data.isDefault)
        toast({
          title: "Settings saved",
          description: "Your AI prompt has been updated successfully.",
        })
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      console.error("Failed to save settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setPrompt(DEFAULT_INSTRUCTION)
  }

  // WordPress handlers
  const handleWpSave = async () => {
    setIsWpSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wordpress_site_url: wpSiteUrl,
          wordpress_api_key: wpApiKey,
        }),
      })

      if (response.ok) {
        toast({
          title: "WordPress settings saved",
          description: "Your WordPress connection settings have been updated.",
        })
        setWpConnectionStatus("untested")
        setWpConnectionMessage("")
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      console.error("Failed to save WordPress settings:", error)
      toast({
        title: "Error",
        description: "Failed to save WordPress settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsWpSaving(false)
    }
  }

  const handleWpTest = async () => {
    if (!wpSiteUrl || !wpApiKey) {
      toast({
        title: "Missing settings",
        description: "Please enter both Site URL and API Key.",
        variant: "destructive",
      })
      return
    }

    setIsWpTesting(true)
    setWpConnectionStatus("untested")
    setWpConnectionMessage("")

    try {
      const response = await fetch("/api/wordpress/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteUrl: wpSiteUrl,
          apiKey: wpApiKey,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setWpConnectionStatus("success")
        setWpConnectionMessage(`Connected to ${data.site || wpSiteUrl}`)
        toast({
          title: "Connection successful",
          description: "WordPress connection verified.",
        })
      } else {
        setWpConnectionStatus("error")
        setWpConnectionMessage(data.message || "Connection failed")
        toast({
          title: "Connection failed",
          description: data.message || "Could not connect to WordPress.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("WordPress test failed:", error)
      setWpConnectionStatus("error")
      setWpConnectionMessage("Network error or invalid URL")
      toast({
        title: "Connection error",
        description: "Could not reach the WordPress site.",
        variant: "destructive",
      })
    } finally {
      setIsWpTesting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>AI Prompt Settings</CardTitle>
          <CardDescription>
            Customize the prompt used when analyzing screenshots. The AI will use this prompt to generate descriptions and filename suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-medium">
              Analysis Instructions (Global Default)
              {!isDefault && (
                <span className="ml-2 text-xs text-muted-foreground">(customized)</span>
              )}
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[180px] p-3 rounded-md border border-input bg-background text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              placeholder="Enter your custom instructions..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              JSON Output Format (auto-appended, read-only)
            </label>
            <pre className="w-full p-3 rounded-md border border-input bg-muted/50 text-xs font-mono text-muted-foreground whitespace-pre-wrap">
              {JSON_OUTPUT_FORMAT.trim()}
            </pre>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={prompt === DEFAULT_INSTRUCTION}
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            The JSON output format is automatically appended to your instructions. Individual folders can override this prompt via the Screenshots tab toolbar.
          </p>
        </CardContent>
      </Card>

      {/* WordPress Plugin Download */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            WordPress Plugin
          </CardTitle>
          <CardDescription>
            Download and install the NewScreens Media Uploader plugin on your WordPress site to enable direct uploads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">Installation Instructions:</p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Download the plugin zip file below</li>
              <li>Go to WordPress Admin → Plugins → Add New → Upload Plugin</li>
              <li>Upload the zip file and click "Install Now"</li>
              <li>Activate the plugin</li>
              <li>Go to Settings → NewScreens Uploader to get your API key</li>
            </ol>
          </div>
          <Button asChild>
            <a href="/downloads/newscreens-media-uploader.zip" download>
              <Download className="h-4 w-4" />
              Download Plugin (ZIP)
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* WordPress Integration Settings */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            WordPress Integration
          </CardTitle>
          <CardDescription>
            Connect to your WordPress site to automatically upload screenshots to the media library.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="wp-site-url" className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              WordPress Site URL
            </label>
            <Input
              id="wp-site-url"
              value={wpSiteUrl}
              onChange={(e) => setWpSiteUrl(e.target.value)}
              placeholder="https://your-wordpress-site.com"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The full URL of your WordPress site (e.g., https://example.com)
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="wp-api-key" className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key
            </label>
            <Input
              id="wp-api-key"
              type="password"
              value={wpApiKey}
              onChange={(e) => setWpApiKey(e.target.value)}
              placeholder="Your NewScreens API key from WordPress"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Find this in WordPress Admin → Settings → NewScreens Uploader
            </p>
          </div>

          {/* Connection Status */}
          {wpConnectionStatus !== "untested" && (
            <div className={`flex items-center gap-2 p-3 rounded-md ${
              wpConnectionStatus === "success"
                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}>
              {wpConnectionStatus === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <span className="text-sm">{wpConnectionMessage}</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleWpSave} disabled={isWpSaving}>
              {isWpSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Settings
            </Button>
            <Button
              variant="outline"
              onClick={handleWpTest}
              disabled={isWpTesting || !wpSiteUrl || !wpApiKey}
            >
              {isWpTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              Test Connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
