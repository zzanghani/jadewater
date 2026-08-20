"use client";

import { useEffect, useRef } from "react";
import { markRoomRead } from "@/app/(app)/messages/rooms/actions";

export default function MarkRoomRead({ roomId }: { roomId: string }) {
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (done.current === roomId) return;
    done.current = roomId;
    markRoomRead(roomId);
  }, [roomId]);

  return null;
}
