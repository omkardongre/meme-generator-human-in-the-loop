import { logger, task, wait } from "@trigger.dev/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as https from "https";
import { uploadToUploadThing } from "./uploadthing";

// Define the ApprovalToken type
type ApprovalToken = {
  memeVariant: 1 | 2;
};

// Create Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Main meme generator task
export const generateMeme = task({
  id: "meme-generator",
  maxDuration: 600,
  run: async (payload: { prompt: string }) => {
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

// Subtask for generating a single meme image
export const generateSingleMeme = task({
  id: "generate-single-meme",
  run: async (payload: { prompt: string }) => {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-preview-image-generation",
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Generate an image for the following prompt: ${payload.prompt}`,
            },
          ],
        },
      ],
    });

    const imagePart = response.response?.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.mimeType?.startsWith("image/")
    );

    if (!imagePart?.inlineData?.data) {
      throw new Error("Failed to generate meme image");
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
    // Upload to UploadThing
    const imageUrl = await uploadToUploadThing(imageBuffer, `meme-${Date.now()}.png`);

    return {
      imageUrl,
    };
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
    text: `Choose the funniest meme`,
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
          text: `*Meme Variants:*
1. ${generatedImageUrl1}
2. ${generatedImageUrl2}`,
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
    const parsedUrl = new URL(webHookUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(JSON.stringify(message)),
      },
    };

    logger.log("Making HTTPS request to Slack", {
      options,
      messageLength: Buffer.byteLength(JSON.stringify(message)),
    });

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        logger.log("Slack response received", {
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          response: data,
        });

        if (res.statusCode !== 200) {
          throw new Error(
            `Failed to send Slack notification: ${res.statusCode} - ${res.statusMessage}`
          );
        }
      });
    });

    req.on("error", (error) => {
      logger.error("HTTPS request error", {
        error,
        errorType: error.name,
        errorMessage: error.message,
        sentPayload: message,
      });
      throw error;
    });

    req.on("socket", (socket) => {
      socket.setTimeout(30000);
      socket.on("timeout", () => {
        logger.error("HTTPS request timeout");
        req.abort();
      });
    });

    req.write(JSON.stringify(message));
    req.end();
  } catch (error) {
    logger.error("Error sending Slack notification", {
      error,
      sentPayload: message,
    });
    throw error;
  }
}
