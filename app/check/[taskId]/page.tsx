"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { Eye, RefreshCw, ArrowLeft, MessageSquareCheck, ThumbsUp } from "lucide-react";
import confetti from "canvas-confetti";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "";
const COOLDOWN = 30;

interface ProofRecord {
  id: string;
  type?: string;
  label?: string;
  value?: string;
  image?: string;
  isDefinition?: boolean;
  definitionId?: string;
}

export default function CheckPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = use(params);
  const [definitions, setDefinitions] = useState<ProofRecord[]>([]);
  const [submissions, setSubmissions] = useState<ProofRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const hasConfettied = useRef(false);

  const fetchProofs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/tasks/${taskId}/proofs`, {
        headers: { "x-api-key": API_KEY },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || "Failed to fetch proofs");
      }
      const data = await res.json();
      setDefinitions(data.definitions ?? []);
      setSubmissions(data.submissions ?? []);
      setLastChecked(new Date().toLocaleTimeString());
      setCooldown(COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Fetch on initial load
  useEffect(() => {
    fetchProofs();
  }, [fetchProofs]);

  // Auto-poll every 10 seconds, max 6 times, then stop
  const hasResult = submissions.some((s) => {
    const def = definitions.find((d) => d.id === s.definitionId);
    return def?.type === "inputText";
  });
  const [pollCount, setPollCount] = useState(0);
  useEffect(() => {
    if (hasResult || pollCount >= 3) return;
    const interval = setInterval(() => {
      setPollCount((c) => c + 1);
      fetchProofs();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchProofs, hasResult, pollCount]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Fire confetti when a result appears
  useEffect(() => {
    const hasResult = submissions.some((s) => {
      const def = definitions.find((d) => d.id === s.definitionId);
      return def?.type === "inputText";
    });
    if (hasResult && !hasConfettied.current) {
      hasConfettied.current = true;
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }
  }, [submissions, definitions]);

  // Find the showImage definition and inputText submission
  const imageDef = definitions.find((d) => d.type === "showImage");
  const rawImgSrc = imageDef?.image || imageDef?.value;
  const imageSrc = rawImgSrc && !rawImgSrc.startsWith("data:") && !rawImgSrc.startsWith("http")
    ? `data:image/jpeg;base64,${rawImgSrc}`
    : rawImgSrc;
  const textSubmission = submissions.find((s) => {
    const def = definitions.find((d) => d.id === s.definitionId);
    return def?.type === "inputText";
  });
  console.log("++++++++++++++++++++++++++");
  console.log("imageDef:", imageDef);
  console.log("rawImgSrc:", rawImgSrc);
  console.log("imageSrc:", imageSrc);
  

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center gap-8 py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

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

        

        {definitions.length > 0 && (
          <div className="flex flex-col gap-0">
            {[
              { label: "Submitted", active: true },
              { label: "Reviewing", active: true },
              { label: "Done", active: !!textSubmission },
            ].map((step, i) => (
              <div key={step.label} className="flex flex-row items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${
                      step.active
                        ? "border-green-500 bg-green-500"
                        : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
                    }`}
                  />
                  {i < 2 && (
                    <div
                      className={`w-0.5 h-6 ${
                        step.active
                          ? "bg-green-500"
                          : "bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    />
                  )}
                </div>
                <p
                  className={`text-sm -mt-0.5 ${
                    step.active
                      ? "font-medium text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        )}
        

        {/* Image + Result side by side */}

        {(imageSrc || textSubmission) && (
          <div className="flex flex-col gap-6 w-full">
            {imageSrc && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-zinc-500 uppercase">Image</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt="Captcha"
                  className="max-w-xs rounded-lg border border-zinc-200 dark:border-zinc-800"
                />
              </div>
            )}
            {textSubmission && (
              <div className="flex flex-col gap-2 w-full sm:w-1/2">
                <p className="text-xs font-medium text-zinc-500 uppercase">Captcha Text</p>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                  <p className="flex flex-row items-center gap-2 text-2xl font-bold text-green-700 dark:text-green-300">
                    {textSubmission.value}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        

        {error && (
          <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

       {!textSubmission && (
          <div className="flex flex-col gap-2">
            <button
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => fetchProofs()}
              disabled={loading || cooldown > 0}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading
                ? "Checking..."
                : cooldown > 0
                  ? `Wait ${cooldown}s`
                  : "Check for updates"}
            </button>
            {lastChecked && (
              <p className="text-xs text-zinc-400 text-center">
                Last checked: {lastChecked}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
