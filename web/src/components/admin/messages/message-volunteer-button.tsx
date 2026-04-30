"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";

interface MessageVolunteerButtonProps {
  volunteerId: string;
}

export function MessageVolunteerButton({
  volunteerId,
}: MessageVolunteerButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/messages/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volunteerId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        alert(err.error ?? "Failed to start conversation");
        return;
      }
      const data = (await res.json()) as { thread: { id: string } };
      router.push(`/admin/messages?thread=${data.thread.id}`);
    } finally {
      setLoading(false);
    }
  }, [volunteerId, router]);

  return (
    <Button onClick={handleClick} disabled={loading} variant="outline" size="sm">
      {loading ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <MessageSquare className="w-4 h-4 mr-1.5" />
      )}
      Message
    </Button>
  );
}
