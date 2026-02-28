import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?redirectTo=/dashboard");

  // Get profile to check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, tenant_id")
    .eq("id", user.id)
    .single();

  // Get session history
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, topic, mode, grade, score_total, key_concepts, created_at, score_knowledge_fidelity, score_structural_integrity, score_hypothesis_generation, score_thinking_depth")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(30);

  // Get stats
  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", user.id)
    .single();

  // Get top knowledge concepts
  const { data: concepts } = await supabase
    .from("knowledge_nodes")
    .select("label, node_type, mention_count, confidence")
    .eq("user_id", user.id)
    .order("mention_count", { ascending: false })
    .limit(20);

  return (
    <DashboardClient
      user={{ id: user.id, email: user.email || "", name: profile?.full_name || user.email || "ユーザー", role: profile?.role || "user" }}
      sessions={sessions || []}
      stats={stats}
      concepts={concepts || []}
    />
  );
}
