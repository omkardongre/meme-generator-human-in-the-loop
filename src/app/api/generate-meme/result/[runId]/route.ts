import { NextRequest, NextResponse } from "next/server";
import { runs } from "@trigger.dev/sdk";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  const { runId } = await context.params;
  try {
    const run = await runs.retrieve(runId);
    if (!run || !run.output) {
      return NextResponse.json({ status: "pending" });
    }
    return NextResponse.json({
      status: "complete",
      ...run.output,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
