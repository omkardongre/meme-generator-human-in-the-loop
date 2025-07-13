# Meme generator with human-in-the-loop approval

> **ℹ️ Note:** This is a v4 project. If you are using v3 and want to upgrade, please refer to our [v4 upgrade guide](https://trigger.dev/docs/v4-upgrade-guide).

This example reference project demonstrates using a human-in-the-loop workflow to approve memes generated using **Google Gemini (Generative AI)** and hosted via **UploadThing**.

## Features

- A [Next.js](https://nextjs.org/) app, with an [endpoint](src/app/endpoints/[slug]/page.tsx) for approving the generated memes
- [Trigger.dev](https://trigger.dev) tasks to generate the images and orchestrate the waitpoint workflow
- [Google Gemini (Generative AI)](https://ai.google.dev/) for generating the images
- [UploadThing](https://uploadthing.com/) for image hosting
- A [Slack app](https://api.slack.com/quickstart) for the human-in-the-loop step, with the approval buttons linked to the endpoint

![slack-meme-approval](https://github.com/user-attachments/assets/a953211a-d23a-44a0-a466-dde94be10d70)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy the `.env.example` file to `.env` and fill in the required environment variables:

- `GEMINI_API_KEY`: Your Google Gemini API key. [Get started here.](https://ai.google.dev/)
- `TRIGGER_SECRET_KEY`: Your Trigger.dev Secret API key. [Get it from your project dashboard.](https://cloud.trigger.dev/login)
- `SLACK_WEBHOOK_URL`: Your Slack webhook URL for notifications. [Create a Slack app.](https://api.slack.com/quickstart)
- `NEXT_PUBLIC_APP_URL`: The public URL for your app (used for approval callbacks).
- `UPLOADTHING_TOKEN`: Your UploadThing API token. [Get it here.](https://uploadthing.com/)

### 3. Configure Trigger.dev

Copy the project ref from the Trigger.dev dashboard and add it to the `trigger.config.ts` file.

### 4. Run the app

Open two terminals:

**Terminal 1: Start Next.js server**
```bash
npm run dev
```

**Terminal 2: Start Trigger.dev background worker**
```bash
npx trigger.dev@v4-beta dev
```

### 5. Test the workflow

- Go to the [Trigger.dev dashboard](https://cloud.trigger.dev/dashboard) test page and trigger the workflow with a payload like:

```json
{
  "prompt": "A meme with a cat and a dog"
}
```

- Submit a meme prompt in the app UI.
- Approve a meme variant in Slack when prompted.

## Relevant code

- **Meme generator task**: [src/trigger/memegenerator.ts](src/trigger/memegenerator.ts)
  - Generates two meme variants using Gemini
  - Uploads images to UploadThing
  - Creates a waitpoint token for human approval
  - Sends images with approval buttons to Slack
  - Handles the approval workflow

- **Upload helper**: [src/trigger/uploadthing.ts](src/trigger/uploadthing.ts)
  - Handles image upload to UploadThing

- **Approval Endpoint**: [src/app/endpoints/[slug]/page.tsx](src/app/endpoints/[slug]/page.tsx)
  - Processes user selections from Slack
  - Completes waitpoint with chosen meme
  - Gives feedback to the approver

## Learn More

- [Trigger.dev Documentation](https://trigger.dev/docs)
- [Trigger.dev wait tokens](https://trigger.dev/docs/upgrade-to-v4)
- [Google Gemini API](https://ai.google.dev/)
- [UploadThing](https://uploadthing.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
