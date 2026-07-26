"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTokens } from "../../lib/api";
import KanbanBoard from "../../components/KanbanBoard";

export default function BoardPage({ params }) {
  const router = useRouter();

  useEffect(() => {
    const { accessToken } = getTokens();
    if (!accessToken) router.push("/login");
  }, [router]);

  return <KanbanBoard boardId={params.id} />;
}
