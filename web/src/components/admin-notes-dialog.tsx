"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Info,
  MessageSquare,
  Clock,
  User,
  FileText,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AdminNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
}

interface AdminNotesDialogProps {
  volunteerId: string;
  volunteerName: string;
  trigger?: React.ReactNode;
}

export function AdminNotesDialog({ 
  volunteerId, 
  volunteerName,
  trigger 
}: AdminNotesDialogProps) {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Fetch notes when dialog opens
  const fetchNotes = useCallback(async () => {
    if (!open) return; // Don't fetch if dialog isn't open
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/admin-notes?volunteerId=${volunteerId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setError('Failed to load admin notes');
    } finally {
      setLoading(false);
    }
  }, [open, volunteerId]);

  useEffect(() => {
    if (open) {
      fetchNotes();
    }
  }, [open, volunteerId, fetchNotes]);

  // Get creator name
  const getCreatorName = (creator: AdminNote['creator']) => {
    return creator.name || 
           `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || 
           'Admin';
  };

  const defaultTrigger = (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
    >
      <Info className="h-3.5 w-3.5 mr-1" />
      <span className="text-xs">Notes</span>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid={`admin-notes-dialog-${volunteerId}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-600" />
            Admin Notes for {volunteerName}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {loading && (
            <div className="space-y-3" data-testid="notes-loading">
              <div className="animate-pulse bg-muted/50 rounded-lg h-20"></div>
              <div className="animate-pulse bg-muted/50 rounded-lg h-16"></div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!loading && !error && (
            <>
              {notes.length === 0 ? (
                <div className="text-center py-8" data-testid="no-notes-message">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No admin notes for this volunteer</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Notes can be added from the volunteer&apos;s profile page
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2" data-testid="notes-list">
                  <div className="text-sm text-muted-foreground mb-2">
                    {notes.length} {notes.length === 1 ? 'note' : 'notes'} • Most recent first
                  </div>
                  
                  {notes.map((note, index) => (
                    <Card 
                      key={note.id} 
                      className={index === 0 ? "border-orange-200 bg-orange-50/30" : ""}
                      data-testid={`note-${note.id}`}
                    >
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`note-content-${note.id}`}>
                            {note.content}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {getCreatorName(note.creator)}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(note.createdAt), 'MMM d, yyyy • h:mma')}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {index === 0 && notes.length > 1 && (
                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                                  Latest
                                </Badge>
                              )}
                              {note.updatedAt !== note.createdAt && (
                                <Badge variant="outline" className="text-xs">
                                  Edited
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Quick action to go to volunteer profile */}
          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              To add, edit, or delete notes, visit the volunteer&apos;s profile page:
            </p>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="text-blue-600 hover:bg-blue-50 border-blue-200"
              data-testid="open-volunteer-profile-button"
            >
              <a href={`/admin/volunteers/${volunteerId}`} target="_blank" rel="noopener noreferrer">
                <User className="h-4 w-4 mr-2" />
                Open {volunteerName}&apos;s Profile
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}