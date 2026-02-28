import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sessionsRes, statsRes, nodesRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, topic, mode, grade, score_total, key_concepts, created_at")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("knowledge_nodes")
      .select("label, node_type, mention_count, confidence")
      .eq("user_id", user.id)
      .order("mention_count", { ascending: false })
      .limit(30),
  ]);

  return NextResponse.json({
    sessions: sessionsRes.data || [],
    stats: statsRes.data || null,
    topConcepts: nodesRes.data || [],
    user: { id: user.id, email: user.email, name: user.user_metadata?.full_name },
  });
}
