import { NextResponse } from "next/server";
import { isTrialAvailable } from "@/lib/trial-key";
import { CORS_HEADERS, corsResponse } from "@/lib/api";

export async function GET() {
  return NextResponse.json(
    { available: isTrialAvailable() },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() { return corsResponse(); }
