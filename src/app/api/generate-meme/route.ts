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
    const result = await generateMeme.trigger(
      { prompt },
      { concurrencyKey: "omkarkey" }
    );

    // const result2 = await generateMeme.trigger(
    //   { prompt },
    //   { concurrencyKey: "omkarkey" }
    // );
    // const result3 = await generateMeme.trigger(
    //   { prompt },
    //   { concurrencyKey: "omkarkey" }
    // );

    console.log("result  = ", result);
    // console.log("result2 = ", result2);
    // console.log("result3 = ", result3);
    return NextResponse.json({ success: true, runId: result.id, ...result });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error).message || "Unknown error" },
      { status: 500 }
    );
  }
}
