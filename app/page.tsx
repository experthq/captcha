"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Eye, MessageSquareCheck } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";
const CAMPAIGN_ID = process.env.NEXT_PUBLIC_CAMPAIGN_ID ?? "";

function compressImage(file: File, maxWidth = 300, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL("image/jpeg", quality);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ProofDefinition {
  id: string;
  type?: string;
  label?: string;
}

interface GenerateResult {
  tasks: Array<{ id: string; [key: string]: unknown }>;
  generated: number;
  balanceSpent: number;
  balanceRemaining: number;
}

export default function Home() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const base64 = await compressImage(file);
      setPreview(base64);
    } catch {
      console.error("Failed to process image");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview) return;
    setSubmitting(true);
    setError(null);

    try {
      // Fetch template for discovery
      const templateRes = await fetch(
        `${API_BASE}/v1/campaigns/${CAMPAIGN_ID}/template`,
        { headers: { "x-api-key": API_KEY } },
      );
      if (!templateRes.ok) {
        const err = await templateRes.json();
        throw new Error(err.message || err.error || "Failed to fetch template");
      }
      const templateData = await templateRes.json();
      console.log("Campaign template:", templateData);

      // Find the first showImage proof definition
      const proofDefs: ProofDefinition[] = templateData.proofDefinitions ?? [];
      const imageProof = proofDefs.find((p) => p.type === "showImage");
      if (!imageProof) {
        throw new Error("No showImage proof definition found in campaign template");
      }

      // Generate a task with the image as a proof override
      const body = {
        tasks: [{ proofs: { [imageProof.id]: { value: preview } } }],
      };

      const genRes = await fetch(
        `${API_BASE}/v1/campaigns/${CAMPAIGN_ID}/generate-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
          },
          body: JSON.stringify(body),
        },
      );

      const genData: GenerateResult = await genRes.json();
      if (!genRes.ok) {
        throw new Error(genData.balanceRemaining !== undefined ? "Insufficient balance" : "Failed to generate task");
      }

      const taskId = genData.tasks?.[0]?.id as string;
      if (taskId) {
        router.push(`/check/${taskId}`);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">

        <div className="flex flex-row gap-4">
          <Eye className="w-10 h-10" />
          <MessageSquareCheck className="w-10 h-10" />
        </div>

        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Upload a captcha image and get the text.
          </h1>
          <p className="max-w-md text-sm leading-8 text-zinc-600 dark:text-zinc-400">
            Powered by {" "}
            <a
              href="https://experthq.com"
              className="font-bold text-zinc-950 dark:text-zinc-50"
            >
              ExpertHQ
            </a>{" "}
          </p>
        </div>

        {preview && (
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <img
              src={preview}
              alt="Uploaded captcha"
              className="max-w-xs rounded-lg border border-zinc-200 dark:border-zinc-800"
            />
            <p className="text-xs text-zinc-400">
              {Math.round((preview.length * 3) / 4 / 1024)} KB (base64)
            </p>
          </div>
        )}

        {error && (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row w-auto">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          
            <button
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] ${preview ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-zinc-200 dark:hover:text-zinc-100" : ""}`}
              onClick={() => inputRef.current?.click()}
              disabled={loading || submitting}
            >
              <Upload className="w-7 h-7" />
              {loading ? "Processing..." : preview ? "" : "Upload Image"}
            </button>

          {preview && (
            <button
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]`}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
