"use client";

import { useEffect, useCallback, useReducer } from "react";
import { GitMerge, AlertTriangle, ArrowRight, Check, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { InfoBox } from "@/components/ui/info-box";
import { MotionSpinner } from "@/components/motion-spinner";
import { User } from "./users-data-table";
import type { MergePreview } from "@/lib/user-merge";

interface MergeUserDialogProps {
  user: User;
  children: React.ReactNode;
}

interface SearchUser {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profilePhotoUrl: string | null;
}

type Step = "search" | "preview" | "confirm";

// State management with useReducer
interface MergeDialogState {
  isOpen: boolean;
  step: Step;
  searchQuery: string;
  searchResults: SearchUser[];
  isSearching: boolean;
  selectedSourceUser: SearchUser | null;
  preview: MergePreview | null;
  isLoadingPreview: boolean;
  previewError: string;
  confirmEmail: string;
  isMerging: boolean;
  mergeError: string;
  mergeSuccess: boolean;
}

type MergeDialogAction =
  | { type: "OPEN_DIALOG" }
  | { type: "CLOSE_DIALOG" }
  | { type: "SET_STEP"; step: Step }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "SET_SEARCH_RESULTS"; results: SearchUser[] }
  | { type: "SET_IS_SEARCHING"; isSearching: boolean }
  | { type: "SELECT_SOURCE_USER"; user: SearchUser }
  | { type: "CLEAR_SOURCE_USER" }
  | { type: "START_LOADING_PREVIEW" }
  | { type: "SET_PREVIEW"; preview: MergePreview }
  | { type: "SET_PREVIEW_ERROR"; error: string }
  | { type: "SET_CONFIRM_EMAIL"; email: string }
  | { type: "START_MERGE" }
  | { type: "MERGE_SUCCESS" }
  | { type: "MERGE_ERROR"; error: string }
  | { type: "RESET" };

const initialState: MergeDialogState = {
  isOpen: false,
  step: "search",
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  selectedSourceUser: null,
  preview: null,
  isLoadingPreview: false,
  previewError: "",
  confirmEmail: "",
  isMerging: false,
  mergeError: "",
  mergeSuccess: false,
};

function mergeDialogReducer(
  state: MergeDialogState,
  action: MergeDialogAction
): MergeDialogState {
  switch (action.type) {
    case "OPEN_DIALOG":
      return { ...initialState, isOpen: true };
    case "CLOSE_DIALOG":
      return state.isMerging ? state : initialState;
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };
    case "SET_SEARCH_RESULTS":
      return { ...state, searchResults: action.results, isSearching: false };
    case "SET_IS_SEARCHING":
      return { ...state, isSearching: action.isSearching };
    case "SELECT_SOURCE_USER":
      return {
        ...state,
        selectedSourceUser: action.user,
        searchQuery: "",
        searchResults: [],
      };
    case "CLEAR_SOURCE_USER":
      return { ...state, selectedSourceUser: null };
    case "START_LOADING_PREVIEW":
      return { ...state, isLoadingPreview: true, previewError: "" };
    case "SET_PREVIEW":
      return {
        ...state,
        preview: action.preview,
        isLoadingPreview: false,
        step: "preview",
      };
    case "SET_PREVIEW_ERROR":
      return { ...state, previewError: action.error, isLoadingPreview: false };
    case "SET_CONFIRM_EMAIL":
      return { ...state, confirmEmail: action.email };
    case "START_MERGE":
      return { ...state, isMerging: true, mergeError: "" };
    case "MERGE_SUCCESS":
      return { ...state, isMerging: false, mergeSuccess: true };
    case "MERGE_ERROR":
      return { ...state, isMerging: false, mergeError: action.error };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

function getDisplayName(user: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  if (user.name) return user.name;
  if (user.firstName || user.lastName) {
    return `${user.firstName || ""} ${user.lastName || ""}`.trim();
  }
  return user.email;
}

function getInitials(user: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  if (user.name) {
    return user.name
      .split(" ")
      .map((n) => n.charAt(0))
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }
  if (user.firstName || user.lastName) {
    return `${user.firstName?.charAt(0) || ""}${user.lastName?.charAt(0) || ""}`.toUpperCase();
  }
  return user.email.charAt(0).toUpperCase();
}

export function MergeUserDialog({ user, children }: MergeUserDialogProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(mergeDialogReducer, initialState);

  const {
    isOpen,
    step,
    searchQuery,
    searchResults,
    isSearching,
    selectedSourceUser,
    preview,
    isLoadingPreview,
    previewError,
    confirmEmail,
    isMerging,
    mergeError,
    mergeSuccess,
  } = state;

  const targetUser = user;

  // Handle dialog open/close
  const handleOpenChange = useCallback((open: boolean) => {
    dispatch({ type: open ? "OPEN_DIALOG" : "CLOSE_DIALOG" });
  }, []);

  // Debounced search for source user
  useEffect(() => {
    if (!searchQuery.trim()) {
      dispatch({ type: "SET_SEARCH_RESULTS", results: [] });
      return;
    }

    dispatch({ type: "SET_IS_SEARCHING", isSearching: true });
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/volunteers/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (response.ok) {
          const data = await response.json();
          // Filter out the target user from results
          const filtered = (data.volunteers || []).filter(
            (v: SearchUser) => v.id !== targetUser.id
          );
          dispatch({ type: "SET_SEARCH_RESULTS", results: filtered });
        } else {
          dispatch({ type: "SET_SEARCH_RESULTS", results: [] });
        }
      } catch (error) {
        console.error("Search error:", error);
        dispatch({ type: "SET_SEARCH_RESULTS", results: [] });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, targetUser.id]);

  // Load preview when source user is selected
  const loadPreview = useCallback(async () => {
    if (!selectedSourceUser) return;

    dispatch({ type: "START_LOADING_PREVIEW" });

    try {
      const response = await fetch(
        `/api/admin/users/merge/preview?targetId=${targetUser.id}&sourceId=${selectedSourceUser.id}`
      );

      if (response.ok) {
        const data = await response.json();
        dispatch({ type: "SET_PREVIEW", preview: data });
      } else {
        const errorData = await response.json();
        dispatch({
          type: "SET_PREVIEW_ERROR",
          error: errorData.error || "Failed to load merge preview",
        });
      }
    } catch (error) {
      console.error("Preview error:", error);
      dispatch({ type: "SET_PREVIEW_ERROR", error: "Failed to load merge preview" });
    }
  }, [selectedSourceUser, targetUser.id]);

  // Execute merge
  const handleMerge = async () => {
    if (!selectedSourceUser || !confirmEmail.trim()) return;

    dispatch({ type: "START_MERGE" });

    try {
      const response = await fetch("/api/admin/users/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: targetUser.id,
          sourceUserId: selectedSourceUser.id,
          confirmEmail: confirmEmail.trim(),
        }),
      });

      if (response.ok) {
        dispatch({ type: "MERGE_SUCCESS" });
        setTimeout(() => {
          dispatch({ type: "CLOSE_DIALOG" });
          router.refresh();
        }, 2000);
      } else {
        const errorData = await response.json();
        dispatch({
          type: "MERGE_ERROR",
          error: errorData.error || "Failed to merge users",
        });
      }
    } catch (error) {
      console.error("Merge error:", error);
      dispatch({ type: "MERGE_ERROR", error: "Failed to merge users. Please try again." });
    }
  };

  const isConfirmEmailValid =
    selectedSourceUser &&
    confirmEmail.trim().toLowerCase() === selectedSourceUser.email.toLowerCase();

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] flex flex-col"
        data-testid="merge-user-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" data-testid="merge-dialog-title">
            <GitMerge className="h-5 w-5" />
            Merge Users
          </DialogTitle>
          <DialogDescription>
            Merge another account into{" "}
            <strong>{getDisplayName(targetUser)}</strong>. The source account
            will be deleted and all their data transferred.
          </DialogDescription>
        </DialogHeader>

        {/* Target user display */}
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={targetUser.profilePhotoUrl || undefined}
              alt={getDisplayName(targetUser)}
            />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {getInitials(targetUser)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{getDisplayName(targetUser)}</p>
            <p className="text-sm text-muted-foreground truncate">
              {targetUser.email}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 bg-primary/10 text-primary border-primary/30">
            Target
          </Badge>
        </div>

        <div className="flex items-center justify-center py-1">
          <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {step === "search" && (
            <div className="space-y-4">
              {/* Search input */}
              <div className="space-y-2">
                <Label htmlFor="source-search">
                  Search for source account to merge
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="source-search"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value })}
                    className="pl-9"
                    data-testid="merge-search-input"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Selected source user */}
              {selectedSourceUser && (
                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={selectedSourceUser.profilePhotoUrl || undefined}
                      alt={getDisplayName(selectedSourceUser)}
                    />
                    <AvatarFallback className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold">
                      {getInitials(selectedSourceUser)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {getDisplayName(selectedSourceUser)}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedSourceUser.email}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">
                    Source
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch({ type: "CLEAR_SOURCE_USER" })}
                    data-testid="clear-source-user"
                  >
                    Clear
                  </Button>
                </div>
              )}

              {/* Search results */}
              {!selectedSourceUser && searchQuery.trim() && (
                <>
                  {isSearching ? (
                    <div className="flex items-center justify-center p-4">
                      <MotionSpinner className="w-5 h-5" />
                      <span className="ml-2 text-sm text-muted-foreground">
                        Searching...
                      </span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div
                      className="border rounded-lg divide-y max-h-48 overflow-y-auto"
                      data-testid="merge-search-results"
                    >
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
                          onClick={() => dispatch({ type: "SELECT_SOURCE_USER", user: result })}
                          data-testid={`merge-search-result-${result.id}`}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={result.profilePhotoUrl || undefined}
                              alt={getDisplayName(result)}
                            />
                            <AvatarFallback>
                              {getInitials(result)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {getDisplayName(result)}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {result.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center p-4">
                      No users found matching your search
                    </div>
                  )}
                </>
              )}

              {previewError && (
                <InfoBox title="Error" variant="red" testId="preview-error">
                  <p>{previewError}</p>
                </InfoBox>
              )}
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              {/* Source user display */}
              <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarImage
                    src={preview.sourceUser.profilePhotoUrl || undefined}
                    alt={getDisplayName(preview.sourceUser)}
                  />
                  <AvatarFallback className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-semibold">
                    {getInitials(preview.sourceUser)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {getDisplayName(preview.sourceUser)}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {preview.sourceUser.email}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700">
                  Will be deleted
                </Badge>
              </div>

              {/* Merge preview stats */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium text-sm">Data to be transferred:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {preview.estimatedStats.signups.toTransfer > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signups</span>
                      <span className="font-medium">
                        {preview.estimatedStats.signups.toTransfer}
                        {preview.estimatedStats.signups.toSkip > 0 && (
                          <span className="text-amber-600 ml-1">
                            (+{preview.estimatedStats.signups.toSkip} skip)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {preview.estimatedStats.achievements.toTransfer > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Achievements</span>
                      <span className="font-medium">
                        {preview.estimatedStats.achievements.toTransfer}
                        {preview.estimatedStats.achievements.toSkip > 0 && (
                          <span className="text-amber-600 ml-1">
                            (+{preview.estimatedStats.achievements.toSkip} skip)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {preview.estimatedStats.friendships.toTransfer > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Friendships</span>
                      <span className="font-medium">
                        {preview.estimatedStats.friendships.toTransfer}
                        {preview.estimatedStats.friendships.toSkip > 0 && (
                          <span className="text-amber-600 ml-1">
                            (+{preview.estimatedStats.friendships.toSkip} skip)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {preview.estimatedStats.notifications > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Notifications</span>
                      <span className="font-medium">
                        {preview.estimatedStats.notifications}
                      </span>
                    </div>
                  )}
                  {preview.estimatedStats.adminNotes > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Admin Notes</span>
                      <span className="font-medium">
                        {preview.estimatedStats.adminNotes}
                      </span>
                    </div>
                  )}
                  {preview.estimatedStats.groupBookings.toTransfer > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Group Bookings</span>
                      <span className="font-medium">
                        {preview.estimatedStats.groupBookings.toTransfer}
                      </span>
                    </div>
                  )}
                  {preview.estimatedStats.passkeys > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Passkeys</span>
                      <span className="font-medium">
                        {preview.estimatedStats.passkeys}
                      </span>
                    </div>
                  )}
                  {preview.estimatedStats.restaurantManager && (
                    <div className="flex justify-between col-span-2">
                      <span className="text-muted-foreground">
                        Restaurant Manager status
                      </span>
                      <span className="font-medium text-green-600">
                        Will transfer
                      </span>
                    </div>
                  )}
                  {preview.estimatedStats.regularVolunteer && (
                    <div className="flex justify-between col-span-2">
                      <span className="text-muted-foreground">
                        Regular Volunteer status
                      </span>
                      <span className="font-medium text-green-600">
                        Will transfer
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Conflict warnings */}
              {(preview.conflicts.duplicateSignups > 0 ||
                preview.conflicts.duplicateAchievements > 0 ||
                preview.conflicts.duplicateFriendships > 0) && (
                <InfoBox
                  title="Duplicates will be skipped"
                  variant="amber"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  testId="merge-conflicts-warning"
                >
                  <ul className="text-sm space-y-1">
                    {preview.conflicts.duplicateSignups > 0 && (
                      <li>
                        {preview.conflicts.duplicateSignups} signup(s) for same shifts
                      </li>
                    )}
                    {preview.conflicts.duplicateAchievements > 0 && (
                      <li>
                        {preview.conflicts.duplicateAchievements} achievement(s) already earned
                      </li>
                    )}
                    {preview.conflicts.duplicateFriendships > 0 && (
                      <li>
                        {preview.conflicts.duplicateFriendships} friendship(s) (duplicates or self-refs)
                      </li>
                    )}
                  </ul>
                </InfoBox>
              )}
            </div>
          )}

          {step === "confirm" && preview && (
            <div className="space-y-4">
              <InfoBox
                title="This action cannot be undone"
                variant="red"
                icon={<AlertTriangle className="h-4 w-4" />}
                testId="merge-warning"
              >
                <p className="text-sm">
                  The account <strong>{preview.sourceUser.email}</strong> will be
                  permanently deleted after merge. All their data will be
                  transferred to <strong>{preview.targetUser.email}</strong>.
                </p>
              </InfoBox>

              <div className="space-y-2">
                <Label htmlFor="confirm-email">
                  Type the source account&apos;s email to confirm:
                </Label>
                <Input
                  id="confirm-email"
                  type="email"
                  placeholder={preview.sourceUser.email}
                  value={confirmEmail}
                  onChange={(e) => dispatch({ type: "SET_CONFIRM_EMAIL", email: e.target.value })}
                  className="font-mono text-sm"
                  disabled={isMerging}
                  data-testid="merge-confirm-email-input"
                />
              </div>

              {mergeError && (
                <InfoBox title="Error" variant="red" testId="merge-error">
                  <p>{mergeError}</p>
                </InfoBox>
              )}

              {mergeSuccess && (
                <InfoBox title="Success" variant="green" testId="merge-success">
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Users merged successfully! Redirecting...
                  </p>
                </InfoBox>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
          {step === "search" && (
            <>
              <Button
                variant="outline"
                onClick={() => dispatch({ type: "CLOSE_DIALOG" })}
                data-testid="merge-cancel-button"
              >
                Cancel
              </Button>
              <Button
                onClick={loadPreview}
                disabled={!selectedSourceUser || isLoadingPreview}
                data-testid="merge-preview-button"
              >
                {isLoadingPreview ? (
                  <>
                    <MotionSpinner className="mr-2 h-4 w-4" />
                    Loading...
                  </>
                ) : (
                  "Preview Merge"
                )}
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => dispatch({ type: "SET_STEP", step: "search" })}
                data-testid="merge-back-button"
              >
                Back
              </Button>
              <Button
                onClick={() => dispatch({ type: "SET_STEP", step: "confirm" })}
                data-testid="merge-continue-button"
              >
                Continue
              </Button>
            </>
          )}

          {step === "confirm" && (
            <>
              <Button
                variant="outline"
                onClick={() => dispatch({ type: "SET_STEP", step: "preview" })}
                disabled={isMerging}
                data-testid="merge-back-button"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleMerge}
                disabled={!isConfirmEmailValid || isMerging || mergeSuccess}
                data-testid="merge-confirm-button"
              >
                {isMerging ? (
                  <>
                    <MotionSpinner className="mr-2 h-4 w-4" color="white" />
                    Merging...
                  </>
                ) : (
                  <>
                    <GitMerge className="mr-2 h-4 w-4" />
                    Merge Users
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
