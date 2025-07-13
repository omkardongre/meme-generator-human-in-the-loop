"use client";
import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | {
    generatedImageUrl1: string;
    generatedImageUrl2: string;
    selectedVariant: number;
    approved: boolean;
  }>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate-meme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      if (!data.runId) throw new Error("No runId returned");

      // Poll for result
      let pollResult = null;
      for (let i = 0; i < 60; i++) { // Poll for up to 2 minutes
        const pollRes = await fetch(`/api/generate-meme/result/${data.runId}`);
        const pollData = await pollRes.json();
        if (pollData.status === "complete") {
          pollResult = pollData;
          break;
        }
        await new Promise(res => setTimeout(res, 2000)); // wait 2 seconds
      }
      if (!pollResult) throw new Error("Timeout waiting for meme generation");
      setResult(pollResult);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-6">Meme Generator</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md">
        <input
          type="text"
          placeholder="Enter a meme prompt..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="border rounded px-3 py-2 text-lg"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 text-lg disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Meme"}
        </button>
      </form>
      {error && <div className="text-red-600 mt-4">Error: {error}</div>}
      {result && (
        <div className="mt-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Generated Memes</h2>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <div>
              <img src={result.generatedImageUrl1} alt="Meme Variant 1" className="max-w-xs rounded shadow" />
              <div className="mt-2">Variant 1</div>
              {result.selectedVariant === 1 && result.approved && <span className="text-green-600 font-bold">Approved</span>}
            </div>
            <div>
              <img src={result.generatedImageUrl2} alt="Meme Variant 2" className="max-w-xs rounded shadow" />
              <div className="mt-2">Variant 2</div>
              {result.selectedVariant === 2 && result.approved && <span className="text-green-600 font-bold">Approved</span>}
            </div>
          </div>
          {result.approved && (
            <div className="mt-4 text-green-700 font-semibold">Approval complete! Variant {result.selectedVariant} was chosen.</div>
          )}
        </div>
      )}
    </div>
  );
}

