"use client";

import { useState, useCallback, useEffect } from "react";
import { format, parseISO } from "date-fns";
import {
  Plus, Trash2, Save, UtensilsCrossed, Clock, ChefHat,
  Wine, Salad, Coffee, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Items are plain strings — e.g. "Pulled jackfruit bao buns w/ sesame seeds"
interface MenuDraft {
  chefName: string;
  announcement: string;
  starter: string[];
  mains: string[];
  drink: string[];
  dessert: string[];
}

interface RecentMenu {
  id: string;
  date: Date | string;
  location: string;
  chefName: string | null;
  updatedAt: Date | string;
}

interface MenusContentProps {
  locations: { id: string; name: string }[];
  initialRecentMenus: RecentMenu[];
}

const emptyDraft = (): MenuDraft => ({
  chefName: "",
  announcement: "",
  starter: [""],
  mains: [""],
  drink: [],
  dessert: [""],
});

function todayNZ(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}

// ─── Course Item Editor ───────────────────────────────────────────────────────

interface CourseEditorProps {
  label: string;
  icon: React.ReactNode;
  items: string[];
  onChange: (items: string[]) => void;
  optional?: boolean;
  placeholder?: string;
}

function CourseEditor({ label, icon, items, onChange, optional, placeholder }: CourseEditorProps) {
  const addItem = () => onChange([...items, ""]);
  const updateItem = (i: number, value: string) =>
    onChange(items.map((item, idx) => (idx === i ? value : item)));
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h4 className="text-sm font-semibold">{label}</h4>
          {optional && <Badge variant="secondary" className="text-xs">optional</Badge>}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={addItem} className="h-7 text-xs gap-1">
          <Plus className="w-3 h-3" />
          Add item
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic pl-1">
          No items — click "Add item" to add one.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                placeholder={placeholder ?? "e.g. Pulled jackfruit bao buns w/ sesame seeds"}
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                className="h-8 text-sm"
              />
              <Button
                type="button" variant="ghost" size="icon"
                onClick={() => removeItem(i)}
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Menu Preview ─────────────────────────────────────────────────────────────
// Renders the exact same HTML structure as the Webflow embed script.
// Scoped CSS approximates the Webflow site's visual styles.

const PREVIEW_STYLES = `
  .ee-preview { font-family: inherit; }
  .ee-preview h2 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.75rem; }
  .ee-preview .div-block-88 { display: flex; gap: 0.35rem; font-size: 0.8rem; color: #888; margin-bottom: 0.4rem; }
  .ee-preview .paragraph { font-size: 0.875rem; font-style: italic; color: #999; margin-bottom: 0.75rem; }
  .ee-preview .div-block-87 { display: flex; align-items: baseline; gap: 0.2rem; margin-bottom: 0.75rem; }
  .ee-preview .div-block-87 h4 { font-size: 0.875rem; color: #888; font-weight: 400; margin: 0; }
  .ee-preview .heading-18 { font-size: 0.875rem; font-weight: 600; margin: 0; }
  .ee-preview .row { display: flex; gap: 1.5rem; flex-wrap: wrap; padding-top: 0.75rem; border-top: 1px solid #e5e7eb; }
  .ee-preview .col { flex: 1; min-width: 8rem; }
  .ee-preview .caps-sm { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: #888; margin: 0 0 0.6rem; }
  .ee-preview .menu-item__name p { font-size: 0.9rem; line-height: 1.45; margin: 0 0 0.15rem; }
  .ee-preview .paragraph-9 { font-size: 0.75rem; font-style: italic; color: #aaa; margin: 0.2rem 0; }
  @media (prefers-color-scheme: dark) {
    .ee-preview .div-block-88, .ee-preview .paragraph, .ee-preview .div-block-87 h4,
    .ee-preview .caps-sm, .ee-preview .paragraph-9 { color: #888; }
    .ee-preview .row { border-top-color: #374151; }
  }
`;

interface MenuPreviewProps {
  draft: MenuDraft;
  location: string;
  date: string;
}

function MenuPreview({ draft, location, date }: MenuPreviewProps) {
  const formattedDate = date
    ? format(parseISO(date), "d MMMM yyyy")
    : format(new Date(), "d MMMM yyyy");

  const hasDrink = draft.drink.some((i) => i.trim() !== "");

  const renderCourse = (label: string, items: string[]) => {
    const filled = items.filter((i) => i.trim() !== "");
    if (filled.length === 0) return null;
    return (
      <div className="col" key={label}>
        <p className="caps-sm">{label}</p>
        <div>
          <div className="menu-item__name">
            {filled.map((item, i) => (
              <span key={i}>
                {i > 0 && <p className="paragraph-9">or</p>}
                <p>{item}</p>
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm"
      data-testid="menu-preview"
    >
      {/* Location badge outside the Webflow-classed area */}
      {location && (
        <div className="px-5 pt-3 pb-0 flex justify-end">
          <Badge variant="secondary" className="text-xs">{location}</Badge>
        </div>
      )}

      {/* Webflow-structured content */}
      <div className="ee-preview px-5 py-4">
        <style dangerouslySetInnerHTML={{ __html: PREVIEW_STYLES }} />

        <h2>Today&apos;s menu</h2>

        <div>
          <div className="div-block-88">
            <div>Last updated:</div>
            <div>{formattedDate}</div>
          </div>
          {draft.announcement.trim() && (
            <div className="paragraph">
              <em>{draft.announcement}</em>
            </div>
          )}
        </div>

        {draft.chefName.trim() && (
          <div className="div-block-87">
            <h4>Chef: </h4>
            <h4 className="heading-18">{draft.chefName}</h4>
          </div>
        )}

        <div className="row">
          {renderCourse("kai tīmata / Starter", draft.starter)}
          {renderCourse("kai matua / main", draft.mains)}
          {hasDrink && renderCourse("inu / Drink", draft.drink)}
          {renderCourse("kai reka / dessert", draft.dessert)}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MenusContent({ locations, initialRecentMenus }: MenusContentProps) {
  const [selectedDate, setSelectedDate] = useState(todayNZ());
  const [selectedLocation, setSelectedLocation] = useState<string>(
    locations.length === 1 ? locations[0].name : ""
  );
  const [draft, setDraft] = useState<MenuDraft>(emptyDraft());
  const [existingId, setExistingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [recentMenus, setRecentMenus] = useState<RecentMenu[]>(initialRecentMenus);

  const loadMenu = useCallback(async (date: string, location: string) => {
    if (!date || !location) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/admin/menus?date=${date}&location=${encodeURIComponent(location)}`
      );
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();

      const toStrings = (raw: unknown): string[] => {
        if (!Array.isArray(raw)) return [""];
        if (raw.length === 0) return [""];
        // Support both legacy {name} objects and plain strings
        return raw.map((i) =>
          typeof i === "string" ? i : (i as { name?: string }).name ?? ""
        );
      };

      if (data) {
        setExistingId(data.id);
        setDraft({
          chefName: data.chefName ?? "",
          announcement: data.announcement ?? "",
          starter: toStrings(data.starter),
          mains: toStrings(data.mains),
          drink: Array.isArray(data.drink) && data.drink.length > 0
            ? data.drink.map((i: unknown) => typeof i === "string" ? i : (i as { name?: string }).name ?? "")
            : [],
          dessert: toStrings(data.dessert),
        });
      } else {
        setExistingId(null);
        setDraft(emptyDraft());
      }
    } catch {
      toast.error("Failed to load menu");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate && selectedLocation) {
      loadMenu(selectedDate, selectedLocation);
    }
  }, [selectedDate, selectedLocation, loadMenu]);

  const handleSave = async () => {
    if (!selectedDate || !selectedLocation) return;
    setIsSaving(true);
    try {
      const clean = (items: string[]) =>
        items.filter((i) => i.trim() !== "").map((i) => ({ name: i.trim() }));

      const body = {
        date: selectedDate,
        location: selectedLocation,
        chefName: draft.chefName.trim() || null,
        announcement: draft.announcement.trim() || null,
        starter: clean(draft.starter),
        mains: clean(draft.mains),
        drink: clean(draft.drink),
        dessert: clean(draft.dessert),
      };

      const res = await fetch("/api/admin/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      const saved = await res.json();
      setExistingId(saved.id);
      toast.success(existingId ? "Menu updated" : "Menu created");

      const listRes = await fetch("/api/admin/menus");
      if (listRes.ok) setRecentMenus(await listRes.json());
    } catch {
      toast.error("Failed to save menu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingId) return;
    try {
      const res = await fetch(`/api/admin/menus/${existingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setExistingId(null);
      setDraft(emptyDraft());
      toast.success("Menu deleted");
      const listRes = await fetch("/api/admin/menus");
      if (listRes.ok) setRecentMenus(await listRes.json());
    } catch {
      toast.error("Failed to delete menu");
    }
    setDeleteConfirmOpen(false);
  };

  const handleRecentClick = (menu: RecentMenu) => {
    const dateStr =
      typeof menu.date === "string"
        ? menu.date.slice(0, 10)
        : format(menu.date as Date, "yyyy-MM-dd");
    setSelectedDate(dateStr);
    setSelectedLocation(menu.location);
  };

  const canEdit = Boolean(selectedDate && selectedLocation);

  return (
    <div className="space-y-6">
      {/* Date & Location picker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4" />
            Select Date & Location
          </CardTitle>
          <CardDescription>
            Choose which restaurant and day you&apos;d like to edit the menu for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="menu-date">Date</Label>
              <Input
                id="menu-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="menu-location">Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger id="menu-location">
                  <SelectValue placeholder="Select a location…" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor + Preview side-by-side on large screens */}
      {canEdit && (
        <div className={cn(
          "grid gap-6",
          showPreview ? "xl:grid-cols-2" : "grid-cols-1"
        )}>
          {/* Editor */}
          <Card data-testid="menu-editor">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    {selectedLocation} —{" "}
                    {selectedDate ? format(parseISO(selectedDate), "EEEE, d MMMM yyyy") : ""}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {isLoading
                      ? "Loading…"
                      : existingId
                        ? "Menu exists — edit and save to update."
                        : "No menu for this day yet. Fill in the details and save."}
                  </CardDescription>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview((p) => !p)}
                    className="gap-1.5"
                  >
                    {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPreview ? "Hide preview" : "Preview"}
                  </Button>
                  {existingId && (
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Delete
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSave} disabled={isSaving || isLoading}>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {isSaving ? "Saving…" : existingId ? "Update" : "Save"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent
              className={cn("space-y-6", isLoading && "opacity-50 pointer-events-none")}
            >
              {/* Chef + Announcement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="chef-name" className="flex items-center gap-1.5">
                    <ChefHat className="w-3.5 h-3.5 text-muted-foreground" />
                    Chef name
                    <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="chef-name"
                    placeholder="e.g. Harri"
                    value={draft.chefName}
                    onChange={(e) => setDraft((d) => ({ ...d, chefName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="announcement" className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    Announcement
                    <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </Label>
                  <Textarea
                    id="announcement"
                    placeholder="e.g. Menu updated around 1pm on service days. We cater to most dietary requirements."
                    value={draft.announcement}
                    onChange={(e) => setDraft((d) => ({ ...d, announcement: e.target.value }))}
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              </div>

              <div className="border-t border-border/50 pt-4 space-y-5">
                <CourseEditor
                  label="Starter"
                  icon={<Salad className="w-4 h-4" />}
                  items={draft.starter}
                  onChange={(starter) => setDraft((d) => ({ ...d, starter }))}
                  placeholder="e.g. Bánh mì crostini: vegetable pâté, rock melon, pickled onion"
                />
                <CourseEditor
                  label="Mains"
                  icon={<UtensilsCrossed className="w-4 h-4" />}
                  items={draft.mains}
                  onChange={(mains) => setDraft((d) => ({ ...d, mains }))}
                  placeholder="e.g. Vegetarian cơm chiên (add multiple for alternatives)"
                />
                <CourseEditor
                  label="Drink"
                  icon={<Wine className="w-4 h-4" />}
                  items={draft.drink}
                  onChange={(drink) => setDraft((d) => ({ ...d, drink }))}
                  optional
                  placeholder="e.g. House kombucha: ginger & lemon"
                />
                <CourseEditor
                  label="Dessert"
                  icon={<Coffee className="w-4 h-4" />}
                  items={draft.dessert}
                  onChange={(dessert) => setDraft((d) => ({ ...d, dessert }))}
                  placeholder="e.g. Bánh flan, feijoa compote, oat crumble"
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-border/50">
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {isSaving ? "Saving…" : existingId ? "Update menu" : "Save menu"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Live Preview */}
          {showPreview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-muted-foreground">Website preview</h3>
                <Badge variant="secondary" className="text-xs">live</Badge>
              </div>
              <MenuPreview
                draft={draft}
                location={selectedLocation}
                date={selectedDate}
              />
            </div>
          )}
        </div>
      )}

      {/* Recent menus history */}
      {recentMenus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Menus</CardTitle>
            <CardDescription>Click a row to load that menu for editing.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {recentMenus.map((menu) => {
                const dateStr =
                  typeof menu.date === "string"
                    ? menu.date.slice(0, 10)
                    : format(menu.date as Date, "yyyy-MM-dd");
                const isSelected =
                  dateStr === selectedDate && menu.location === selectedLocation;
                return (
                  <button
                    key={menu.id}
                    type="button"
                    onClick={() => handleRecentClick(menu)}
                    className={cn(
                      "w-full text-left px-6 py-3 flex items-center gap-4 hover:bg-muted/50 transition-colors",
                      isSelected && "bg-muted"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {format(parseISO(dateStr + "T00:00:00"), "EEE, d MMM yyyy")}
                        </span>
                        <Badge variant="outline" className="text-xs">{menu.location}</Badge>
                        {menu.chefName && (
                          <span className="text-xs text-muted-foreground">
                            Chef: {menu.chefName}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      Updated{" "}
                      {typeof menu.updatedAt === "string"
                        ? format(parseISO(menu.updatedAt), "d MMM, h:mm a")
                        : format(menu.updatedAt as Date, "d MMM, h:mm a")}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this menu?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the menu for{" "}
              <strong>{selectedLocation}</strong> on{" "}
              <strong>
                {selectedDate ? format(parseISO(selectedDate), "d MMMM yyyy") : "this day"}
              </strong>
              . The website will show no menu for that day.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete menu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
