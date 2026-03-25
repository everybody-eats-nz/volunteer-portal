"use client";

import { useCallback, useRef, useState } from "react";
import {
  MessageSquare,
  Plus,
  Trash2,
  Pencil,
  FileText,
  Check,
  X,
  Info,
  Send,
  RotateCcw,
  Bot,
  User,
  Globe,
  RefreshCw,
  Link,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatResource = {
  id: string;
  title: string;
  type: string;
  category: string;
  chatContent: string | null;
  includeInChat: boolean;
  description?: string | null;
  fileName?: string | null;
  url?: string | null;
  uploader?: { id: string; firstName: string | null; lastName: string | null; name: string | null };
};

type ResourceOption = {
  id: string;
  title: string;
  type: string;
  category: string;
  includeInChat: boolean;
  chatContent: string | null;
};

type SuggestedQuestion = {
  emoji: string;
  label: string;
};

interface ChatGuidesContentProps {
  initialChatResources: ChatResource[];
  allResources: ResourceOption[];
  estimatedTokens: number;
  initialSystemPrompt: string;
  initialSuggestedQuestions: string; // JSON string
}

const CATEGORY_LABELS: Record<string, string> = {
  TRAINING: "Training",
  POLICIES: "Policies",
  FORMS: "Forms",
  GUIDES: "Guides",
  RECIPES: "Recipes",
  SAFETY: "Safety",
  GENERAL: "General",
};

const CATEGORY_COLORS: Record<string, string> = {
  TRAINING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  POLICIES: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  FORMS: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  GUIDES: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  RECIPES: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  SAFETY: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  GENERAL: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const DEFAULT_SYSTEM_PROMPT = `You are a friendly and helpful volunteer assistant for Everybody Eats, a charitable restaurant in Aotearoa New Zealand that serves free meals to the community. Your name is EE Assistant.

Key guidelines:
- Be warm, encouraging, and supportive — volunteers are giving their time for free
- Weave in te reo Māori naturally: "Kia ora", "ka pai" (well done), "whānau" (family/community), "mahi" (work), "ngā mihi" (thanks)
- Answer questions based ONLY on the knowledge base provided below
- If you don't know something or it's not in the knowledge base, say so honestly and suggest they contact the team directly
- Keep answers concise but thorough — volunteers are often on mobile
- Use emojis sparingly for warmth 🌿`;

const DEFAULT_QUESTIONS: SuggestedQuestion[] = [
  { emoji: "🍽️", label: "What happens on a typical shift?" },
  { emoji: "🔪", label: "Kitchen safety tips" },
  { emoji: "👥", label: "What are the volunteer grades?" },
  { emoji: "📍", label: "Where are the kitchens?" },
];

export function ChatGuidesContent({
  initialChatResources,
  allResources,
  estimatedTokens: initialTokens,
  initialSystemPrompt,
  initialSuggestedQuestions,
}: ChatGuidesContentProps) {
  const { toast } = useToast();
  const [chatResources, setChatResources] = useState(initialChatResources);
  const [estimatedTokens, setEstimatedTokens] = useState(initialTokens);

  // Prompt settings
  const [systemPrompt, setSystemPrompt] = useState(
    initialSystemPrompt || DEFAULT_SYSTEM_PROMPT,
  );
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>(() => {
    try {
      const parsed = JSON.parse(initialSuggestedQuestions);
      return parsed.length > 0 ? parsed : DEFAULT_QUESTIONS;
    } catch {
      return DEFAULT_QUESTIONS;
    }
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Add resource dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [chatContent, setChatContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);

  // Import from URL dialog
  const [importUrlDialogOpen, setImportUrlDialogOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importTitle, setImportTitle] = useState("");
  const [importCategory, setImportCategory] = useState("GENERAL");
  const [importContent, setImportContent] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isExtractingImportUrl, setIsExtractingImportUrl] = useState(false);

  // Refresh URL content
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ChatResource | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Remove dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removingResource, setRemovingResource] = useState<ChatResource | null>(null);

  // Create new guide dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("GUIDES");
  const [newContent, setNewContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Chat preview
  type PreviewMessage = { id: string; role: "user" | "assistant"; content: string };
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([]);
  const [previewInput, setPreviewInput] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewEndRef = useRef<HTMLDivElement>(null);

  const availableResources = allResources.filter(
    (r) => !r.includeInChat,
  );

  const recalcTokens = (resources: ChatResource[]) => {
    const chars = resources.reduce(
      (sum, r) => sum + (r.chatContent?.length ?? 0),
      0,
    );
    setEstimatedTokens(Math.round(chars / 4));
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const response = await fetch("/api/admin/chat-guides/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          suggestedQuestions,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save settings");
      }

      toast({ title: "Settings saved" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResourceSelected = async (resourceId: string) => {
    setSelectedResourceId(resourceId);
    setChatContent("");

    const resource = availableResources.find((r) => r.id === resourceId);

    // Auto-extract text if it's a PDF
    if (resource?.type === "PDF") {
      setIsExtractingPdf(true);
      try {
        const response = await fetch("/api/admin/chat-guides/extract-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to extract PDF text");
        }

        const { text, pages } = await response.json();
        setChatContent(text);
        toast({
          title: "PDF text extracted",
          description: `Extracted text from ${pages} page${pages !== 1 ? "s" : ""}. Review and edit below.`,
        });
      } catch (error) {
        toast({
          title: "PDF extraction failed",
          description: error instanceof Error ? error.message : "Could not extract text. You can paste content manually.",
          variant: "destructive",
        });
      } finally {
        setIsExtractingPdf(false);
      }
    }

    // Auto-extract text if it's a LINK
    if (resource?.type === "LINK") {
      setIsExtractingUrl(true);
      try {
        const response = await fetch("/api/admin/chat-guides/extract-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Failed to extract page content");
        }

        const { text } = await response.json();
        setChatContent(text);
        toast({
          title: "Page content extracted",
          description: "Review and edit the extracted content below.",
        });
      } catch (error) {
        toast({
          title: "URL extraction failed",
          description: error instanceof Error ? error.message : "Could not extract content. You can paste content manually.",
          variant: "destructive",
        });
      } finally {
        setIsExtractingUrl(false);
      }
    }
  };

  const handleAddQuestion = () => {
    setSuggestedQuestions((prev) => [...prev, { emoji: "💬", label: "" }]);
  };

  const handleRemoveQuestion = (index: number) => {
    setSuggestedQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQuestion = (
    index: number,
    field: "emoji" | "label",
    value: string,
  ) => {
    setSuggestedQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    );
  };

  const isValidEEUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname.endsWith("everybodyeats.nz");
    } catch {
      return false;
    }
  };

  const handleExtractImportUrl = async () => {
    if (!importUrl.trim()) return;
    if (!isValidEEUrl(importUrl.trim())) {
      toast({
        title: "Invalid URL",
        description: "Only URLs from everybodyeats.nz are allowed.",
        variant: "destructive",
      });
      return;
    }
    setIsExtractingImportUrl(true);
    try {
      const response = await fetch("/api/admin/chat-guides/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to extract page content");
      }

      const { text, title } = await response.json();
      setImportContent(text);
      if (!importTitle.trim()) {
        setImportTitle(title);
      }
      toast({
        title: "Page content extracted",
        description: "Review and edit the extracted content below.",
      });
    } catch (error) {
      toast({
        title: "URL extraction failed",
        description: error instanceof Error ? error.message : "Could not extract content from this URL.",
        variant: "destructive",
      });
    } finally {
      setIsExtractingImportUrl(false);
    }
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim() || !importContent.trim() || !importTitle.trim()) return;
    setIsImporting(true);

    try {
      const response = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: importTitle.trim(),
          type: "LINK",
          category: importCategory,
          url: importUrl.trim(),
          isPublished: true,
          includeInChat: true,
          chatContent: importContent.trim(),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to import URL");
      }

      const created = await response.json();
      setChatResources((prev) => [...prev, created]);
      recalcTokens([...chatResources, created]);

      toast({ title: "Website page imported", description: created.title });
      setImportUrlDialogOpen(false);
      setImportUrl("");
      setImportTitle("");
      setImportCategory("GENERAL");
      setImportContent("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import URL",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleRefreshUrlContent = async (resource: ChatResource) => {
    if (!resource.url) {
      toast({
        title: "No URL stored",
        description: "This resource has no URL to refresh from. Edit it to add one.",
        variant: "destructive",
      });
      return;
    }

    setRefreshingId(resource.id);
    try {
      // Pass the URL directly to avoid server-side type check
      const response = await fetch("/api/admin/chat-guides/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: resource.url }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to extract content" }));
        throw new Error(err.error || "Failed to refresh content");
      }

      const { text } = await response.json();

      // Save the refreshed content
      const saveResponse = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatContent: text }),
      });

      if (!saveResponse.ok) {
        const err = await saveResponse.json().catch(() => ({ error: "Failed to save refreshed content" }));
        throw new Error(err.error || "Failed to save refreshed content");
      }

      const updated = await saveResponse.json();
      setChatResources((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      recalcTokens(
        chatResources.map((r) =>
          r.id === resource.id ? { ...r, chatContent: text } : r,
        ),
      );

      toast({ title: "Content refreshed", description: resource.title });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: error instanceof Error ? error.message : "Could not refresh content",
        variant: "destructive",
      });
    } finally {
      setRefreshingId(null);
    }
  };

  const handleCreateGuide = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setIsCreating(true);

    try {
      const response = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: "DOCUMENT",
          category: newCategory,
          isPublished: true,
          includeInChat: true,
          chatContent: newContent.trim(),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create guide");
      }

      const created = await response.json();
      setChatResources((prev) => [...prev, created]);
      recalcTokens([...chatResources, created]);

      toast({ title: "Guide created", description: created.title });
      setCreateDialogOpen(false);
      setNewTitle("");
      setNewCategory("GUIDES");
      setNewContent("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create guide",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePreviewSend = useCallback(async (text?: string) => {
    const content = (text ?? previewInput).trim();
    if (!content || previewLoading) return;

    const userMsg: PreviewMessage = { id: Date.now().toString(), role: "user", content };
    const assistantId = (Date.now() + 1).toString();
    const allMsgs = [...previewMessages, userMsg];

    setPreviewMessages(allMsgs);
    setPreviewInput("");
    setPreviewLoading(true);

    try {
      const response = await fetch("/api/admin/chat-guides/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let assistantContent = "";

      setPreviewMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        const captured = assistantContent;
        setPreviewMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: captured } : m)),
        );
      }

      if (!assistantContent.trim()) {
        throw new Error("Empty response from AI — check OPENROUTER_API_KEY and model config in Vercel env vars");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to get a response. Check that OPENROUTER_API_KEY is set.";
      setPreviewMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: `Error: ${errorMsg}` },
      ]);
    } finally {
      setPreviewLoading(false);
      setTimeout(() => previewEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [previewInput, previewLoading, previewMessages]);

  const resetPreview = () => {
    setPreviewMessages([]);
    setPreviewInput("");
  };

  const handleAddResource = async () => {
    if (!selectedResourceId || !chatContent.trim()) return;
    setIsAdding(true);

    try {
      const response = await fetch(`/api/admin/resources/${selectedResourceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          includeInChat: true,
          chatContent: chatContent.trim(),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update resource");
      }

      const updated = await response.json();
      setChatResources((prev) => [...prev, updated]);
      recalcTokens([...chatResources, updated]);

      toast({ title: "Resource added to chat context", description: updated.title });
      setAddDialogOpen(false);
      setSelectedResourceId("");
      setChatContent("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add resource",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditContent = async () => {
    if (!editingResource || !editContent.trim()) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/resources/${editingResource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatContent: editContent.trim() }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update content");
      }

      const updated = await response.json();
      setChatResources((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
      recalcTokens(
        chatResources.map((r) =>
          r.id === editingResource.id ? { ...r, chatContent: editContent.trim() } : r,
        ),
      );

      toast({ title: "Chat content updated" });
      setEditDialogOpen(false);
      setEditingResource(null);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFromChat = async () => {
    if (!removingResource) return;

    try {
      const response = await fetch(`/api/admin/resources/${removingResource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeInChat: false }),
      });

      if (!response.ok) throw new Error("Failed to remove");

      const newList = chatResources.filter((r) => r.id !== removingResource.id);
      setChatResources(newList);
      recalcTokens(newList);

      toast({ title: "Removed from chat context", description: removingResource.title });
      setRemoveDialogOpen(false);
      setRemovingResource(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove resource from chat",
        variant: "destructive",
      });
    }
  };

  const tokenPercentage = Math.min((estimatedTokens / 100000) * 100, 100);
  const tokenColor =
    tokenPercentage > 80
      ? "text-red-600 dark:text-red-400"
      : tokenPercentage > 50
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-green-600 dark:text-green-400";

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resources in Chat</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{chatResources.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated Tokens</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${tokenColor}`}>
              {estimatedTokens.toLocaleString()}
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  tokenPercentage > 80
                    ? "bg-red-500"
                    : tokenPercentage > 50
                      ? "bg-yellow-500"
                      : "bg-green-500"
                }`}
                style={{ width: `${tokenPercentage}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">of ~100k context budget</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Available to Add</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{availableResources.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">How this works</p>
          <p className="mt-1">
            Resources added here will be included as context when volunteers chat with the
            AI assistant in the mobile app. The assistant uses this content to answer
            questions about volunteering, safety, shifts, and more. Keep the total token
            count under ~100k for best results.
          </p>
        </div>
      </div>

      {/* System Prompt & Suggested Questions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Prompt</CardTitle>
            <CardDescription>
              Instructions that tell the AI how to behave. The knowledge base resources
              are appended automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={10}
              className="max-h-[40vh] resize-none font-mono text-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Suggested Questions</CardTitle>
                <CardDescription>
                  Shown on the mobile chat welcome screen. Max 4 recommended.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddQuestion}
                disabled={suggestedQuestions.length >= 6}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suggestedQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={q.emoji}
                    onChange={(e) => handleUpdateQuestion(i, "emoji", e.target.value)}
                    className="w-16 text-center text-lg"
                    maxLength={4}
                  />
                  <Input
                    value={q.label}
                    onChange={(e) => handleUpdateQuestion(i, "label", e.target.value)}
                    placeholder="Question text..."
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveQuestion(i)}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {suggestedQuestions.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No suggested questions. Default ones will be shown.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} disabled={isSavingSettings}>
          {isSavingSettings ? "Saving..." : "Save Prompt Settings"}
        </Button>
      </div>

      {/* Resource list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Chat Context Resources</h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(true)} disabled={availableResources.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Add Existing Resource
            </Button>
            <Button variant="outline" onClick={() => setImportUrlDialogOpen(true)}>
              <Globe className="mr-2 h-4 w-4" />
              Import from URL
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Create Guide
            </Button>
          </div>
        </div>

        {chatResources.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium">No resources in chat context</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add resources from the Resource Hub to give the AI assistant knowledge
              </p>
              <Button className="mt-4" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Resource
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {chatResources.map((resource) => (
              <Card key={resource.id}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {resource.type === "LINK" ? (
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{resource.title}</h4>
                      <Badge variant="outline" className={CATEGORY_COLORS[resource.category]}>
                        {CATEGORY_LABELS[resource.category] ?? resource.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {resource.type}
                      </Badge>
                    </div>
                    {resource.chatContent && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {resource.chatContent.slice(0, 200)}
                        {resource.chatContent.length > 200 ? "..." : ""}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      ~{Math.round((resource.chatContent?.length ?? 0) / 4).toLocaleString()} tokens
                      {resource.type === "LINK" && (
                        <span className="ml-2 text-muted-foreground/70">
                          · Auto-refreshes daily ~4–5pm NZT
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {resource.type === "LINK" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRefreshUrlContent(resource)}
                        disabled={refreshingId === resource.id}
                        title="Re-scrape content from URL"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshingId === resource.id ? "animate-spin" : ""}`} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingResource(resource);
                        setEditContent(resource.chatContent ?? "");
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setRemovingResource(resource);
                        setRemoveDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Chat Preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-5 w-5" />
                Chat Preview
              </CardTitle>
              <CardDescription>
                Test the AI assistant with the current resources and prompt settings.
              </CardDescription>
            </div>
            {previewMessages.length > 0 && (
              <Button variant="outline" size="sm" onClick={resetPreview}>
                <RotateCcw className="mr-1 h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col rounded-lg border bg-muted/30">
            {/* Messages area */}
            <div className="h-[400px] overflow-y-auto p-4">
              {previewMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 opacity-40" />
                  <p className="text-sm">Send a message to test the assistant</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["What happens on a typical shift?", "Where are the kitchens?", "Kitchen safety tips"].map((q) => (
                      <button
                        key={q}
                        onClick={() => handlePreviewSend(q)}
                        className="rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-muted"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {previewMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <Bot className="h-4 w-4 text-green-700 dark:text-green-400" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "border bg-background"
                        }`}
                      >
                        {msg.role === "assistant" && msg.content ? (
                          <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
                              ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
                              li: ({ children }) => <li className="text-sm">{children}</li>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{children}</a>,
                              h1: ({ children }) => <h1 className="text-base font-semibold mb-1 mt-2 first:mt-0">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-sm font-medium mb-1 mt-1">{children}</h3>,
                            }}
                          >
                            {msg.content}
                          </Markdown>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content || (previewLoading ? "..." : "")}</p>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={previewEndRef} />
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className="flex gap-2 border-t p-3">
              <input
                type="text"
                value={previewInput}
                onChange={(e) => setPreviewInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePreviewSend();
                  }
                }}
                placeholder="Ask the assistant something..."
                disabled={previewLoading}
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                size="icon"
                onClick={() => handlePreviewSend()}
                disabled={!previewInput.trim() || previewLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Resource Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Resource to Chat Context</DialogTitle>
            <DialogDescription>
              Select a resource from the Resource Hub and provide the text content the AI
              assistant should use. For PDFs, paste the relevant text content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resource</Label>
              <Select value={selectedResourceId} onValueChange={handleResourceSelected}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a resource..." />
                </SelectTrigger>
                <SelectContent>
                  {availableResources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        {r.title}
                        <span className="text-xs text-muted-foreground">
                          ({r.type} / {CATEGORY_LABELS[r.category] ?? r.category})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chat Content</Label>
              <Textarea
                value={chatContent}
                onChange={(e) => setChatContent(e.target.value)}
                placeholder={
                  isExtractingPdf
                    ? "Extracting text from PDF..."
                    : isExtractingUrl
                      ? "Extracting content from URL..."
                      : "Paste or type the text content the AI should use as context..."
                }
                rows={12}
                disabled={isExtractingPdf || isExtractingUrl}
                className="max-h-[40vh] resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {isExtractingPdf
                  ? "Extracting text from PDF..."
                  : isExtractingUrl
                    ? "Extracting content from web page..."
                    : `~${Math.round(chatContent.length / 4).toLocaleString()} tokens`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddResource}
              disabled={!selectedResourceId || !chatContent.trim() || isAdding || isExtractingPdf || isExtractingUrl}
            >
              {isAdding ? "Adding..." : "Add to Chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Content Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Chat Content</DialogTitle>
            <DialogDescription>
              Update the text content for &ldquo;{editingResource?.title}&rdquo; that the
              AI assistant uses as context.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={16}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              ~{Math.round(editContent.length / 4).toLocaleString()} tokens
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditContent}
              disabled={!editContent.trim() || isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from chat context?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &ldquo;{removingResource?.title}&rdquo; from the AI
              assistant&apos;s context. The resource itself won&apos;t be deleted from the
              Resource Hub.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveFromChat}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import from URL Dialog */}
      <Dialog open={importUrlDialogOpen} onOpenChange={setImportUrlDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import from Website</DialogTitle>
            <DialogDescription>
              Enter a URL to scrape its content for the AI assistant. The page
              content will be extracted and stored as a chat resource.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://everybodyeats.nz/..."
                    className="pl-9"
                  />
                </div>
                <Button
                  onClick={handleExtractImportUrl}
                  disabled={!importUrl.trim() || isExtractingImportUrl || !isValidEEUrl(importUrl.trim())}
                  variant="secondary"
                >
                  {isExtractingImportUrl ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="mr-2 h-4 w-4" />
                  )}
                  {isExtractingImportUrl ? "Extracting..." : "Fetch"}
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  placeholder="Page title (auto-filled on fetch)"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={importCategory} onValueChange={setImportCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Extracted Content</Label>
              <Textarea
                value={importContent}
                onChange={(e) => setImportContent(e.target.value)}
                placeholder={
                  isExtractingImportUrl
                    ? "Extracting content from page..."
                    : "Click Fetch to extract content, or paste manually..."
                }
                rows={14}
                disabled={isExtractingImportUrl}
                className="max-h-[40vh] resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {isExtractingImportUrl
                  ? "Extracting content from page..."
                  : `~${Math.round(importContent.length / 4).toLocaleString()} tokens`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportUrlDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImportUrl}
              disabled={!importUrl.trim() || !importTitle.trim() || !importContent.trim() || isImporting || isExtractingImportUrl}
            >
              {isImporting ? "Importing..." : "Import to Chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Guide Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Chat Guide</DialogTitle>
            <DialogDescription>
              Create a new text resource directly for the AI assistant&apos;s context.
              No file upload required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Kitchen Safety Procedures"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Type or paste the content the AI assistant should know about..."
                rows={14}
                className="max-h-[40vh] resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                ~{Math.round(newContent.length / 4).toLocaleString()} tokens
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateGuide}
              disabled={!newTitle.trim() || !newContent.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create Guide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
