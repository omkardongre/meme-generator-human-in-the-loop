import { logger, task, wait } from "@trigger.dev/sdk";
import { GoogleGenAI, Modality } from "@google/genai";
import axios from "axios";
import { uploadToUploadThing } from "./uploadthing";

// Define the ApprovalToken type
type ApprovalToken = {
  memeVariant: 1 | 2;
};

// Create Gemini client using the new @google/genai package
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY as string,
});

// Main meme generator task
export const generateMeme = task({
  id: "meme-generator",
  maxDuration: 600,
  queue: {
    name: "per-user-meme-queue", // any name
    concurrencyLimit: 1, // limit to 1
  },
  run: async (payload: { prompt: string }, { ctx }) => {
    // log context values
    logger.log("Context values", {
      ctx: ctx,
    });

    // log ctx.concurrencyKey
    logger.log("Concurrency key", {
      concurrencyKey: ctx.concurrencyKey,
    });

    const token = await wait.createToken({ timeout: "10m" });

    const generatedMemes = await generateSingleMeme.batchTriggerAndWait([
      { payload: { prompt: payload.prompt } },
      { payload: { prompt: payload.prompt } },
    ]);

    const firstMeme = generatedMemes.runs.at(0);
    const secondMeme = generatedMemes.runs.at(1);

    if (firstMeme?.ok !== true || secondMeme?.ok !== true) {
      throw new Error("Failed to generate memes");
    }

    const generatedImageUrl1 = firstMeme.output.imageUrl;
    const generatedImageUrl2 = secondMeme.output.imageUrl;

    logger.log("Sending Slack notification", {
      generatedImageUrl1,
      generatedImageUrl2,
      tokenId: token.id,
      prompt: payload.prompt,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
    });

    await sendSlackApprovalMessage({
      generatedImageUrl1,
      generatedImageUrl2,
      tokenId: token.id,
      prompt: payload.prompt,
    });

    logger.log("Slack notification sent, waiting for approval");

    const result = await wait.forToken<ApprovalToken>(token.id);

    if (!result.ok) {
      throw new Error("Failed to get approval token");
    } else {
      console.log(
        "The meme that was chosen was variant",
        result.output.memeVariant
      );
    }

    return {
      generatedImageUrl1,
      generatedImageUrl2,
      selectedVariant: result.output.memeVariant,
      approved: true,
    };
  },
});

// Subtask for generating a single meme image using the new @google/genai package
export const generateSingleMeme = task({
  id: "generate-single-meme",
  run: async (payload: { prompt: string }) => {
    try {
      // Use the newer @google/genai package approach
      const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: `Generate a meme image for the following prompt: ${payload.prompt}`,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      // Find the image part in the response
      // Define the expected type for a content part
      type GeminiContentPart = {
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      };
      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (part: GeminiContentPart) =>
          part.inlineData?.mimeType?.startsWith("image/")
      );

      if (!imagePart?.inlineData?.data) {
        throw new Error(
          "Failed to generate meme image - no image data found in response"
        );
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");

      // Upload to UploadThing
      const imageUrl = await uploadToUploadThing(
        imageBuffer,
        `meme-${Date.now()}.png`
      );

      return {
        imageUrl,
      };
    } catch (error) {
      logger.error("Error generating meme image", {
        error: (error as Error)?.message || error,
        prompt: payload.prompt,
      });
      throw error;
    }
  },
});

type SendApprovalMessageParams = {
  generatedImageUrl1: string;
  generatedImageUrl2: string;
  tokenId: string;
  prompt: string;
};

export async function sendSlackApprovalMessage({
  generatedImageUrl1,
  generatedImageUrl2,
  tokenId,
  prompt,
}: SendApprovalMessageParams) {
  const webHookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webHookUrl) throw new Error("SLACK_WEBHOOK_URL is not set");

  const message = {
    text: "Choose the funniest meme",
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🎭 Choose the funniest meme",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Prompt:*\n${prompt}`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Meme Variants:*\n1. ${generatedImageUrl1}\n2. ${generatedImageUrl2}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Select Variant 1",
              emoji: true,
            },
            style: "primary",
            value: JSON.stringify({ tokenId, memeVariant: 1 }),
            action_id: "meme_approve_1",
            url: `${process.env.NEXT_PUBLIC_APP_URL}/endpoints/${tokenId}?variant=1`,
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Select Variant 2",
              emoji: true,
            },
            style: "primary",
            value: JSON.stringify({ tokenId, memeVariant: 2 }),
            action_id: "meme_approve_2",
            url: `${process.env.NEXT_PUBLIC_APP_URL}/endpoints/${tokenId}?variant=2`,
          },
        ],
      },
    ],
  };

  try {
    logger.log("Making HTTPS request to Slack using axios", {
      webhookUrl: webHookUrl,
      messageLength: Buffer.byteLength(JSON.stringify(message)),
    });

    const response = await axios.post(webHookUrl, message, {
      headers: { "Content-Type": "application/json" },
      timeout: 120000, // 2 minutes
    });

    logger.log("Slack response received", {
      statusCode: response.status,
      statusMessage: response.statusText,
      response: response.data,
    });

    if (response.status !== 200) {
      throw new Error(
        `Failed to send Slack notification: ${response.status} - ${response.statusText}`
      );
    }
  } catch (error: unknown) {
    logger.error("Error sending Slack notification", {
      error: (error as Error)?.message || error,
      sentPayload: message,
    });
    throw error;
  }
}