import { NextRequest, NextResponse } from "next/server";
import { generateMeme } from "@/trigger/memegenerator";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Trigger the workflow
    const result = await generateMeme.trigger({ prompt });
    return NextResponse.json({ success: true, runId: result.id, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
