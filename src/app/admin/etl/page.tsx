"use client";

import { useCallback, useState } from "react";

type StepStatus = "idle" | "running" | "success" | "error";

type StepResult = {
  status: StepStatus;
  message?: string;
  data?: unknown;
};

function StatusBadge({ status }: { status: StepStatus }) {
  const styles: Record<StepStatus, string> = {
    idle: "bg-zinc-100 text-zinc-600",
    running: "bg-blue-100 text-blue-700",
    success: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };

  const labels: Record<StepStatus, string> = {
    idle: "Ready",
    running: "Running...",
    success: "Success",
    error: "Error",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function EtlStep({
  title,
  description,
  buttonLabel,
  result,
  onRun,
  disabled,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  result: StepResult;
  onRun: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-zinc-900">{title}</h3>
            <StatusBadge status={result.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
          {result.message && (
            <p
              className={`mt-2 text-sm ${
                result.status === "error" ? "text-red-600" : "text-zinc-600"
              }`}
            >
              {result.message}
            </p>
          )}
        </div>
        <button
          onClick={onRun}
          disabled={disabled || result.status === "running"}
          className="ml-4 shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {result.status === "running" ? "Running..." : buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default function AdminEtlPage() {
  const [schemaResult, setSchemaResult] = useState<StepResult>({
    status: "idle",
  });
  const [seedResult, setSeedResult] = useState<StepResult>({ status: "idle" });
  const [ingestResult, setIngestResult] = useState<StepResult>({
    status: "idle",
  });
  const [chaptersResult, setChaptersResult] = useState<StepResult>({
    status: "idle",
  });
  const [versesResult, setVersesResult] = useState<StepResult>({
    status: "idle",
  });

  const runStep = useCallback(
    async (
      endpoint: string,
      body: Record<string, unknown>,
      setResult: (result: StepResult) => void
    ) => {
      setResult({ status: "running" });
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.ok) {
          setResult({
            status: "success",
            message: JSON.stringify(json.data, null, 2),
            data: json.data,
          });
        } else {
          setResult({
            status: "error",
            message: json.error ?? "Unknown error",
          });
        }
      } catch (err) {
        setResult({
          status: "error",
          message: err instanceof Error ? err.message : "Request failed",
        });
      }
    },
    []
  );

  const runSchema = useCallback(() => {
    runStep("/api/admin/schema/validators", {}, setSchemaResult);
  }, [runStep]);

  const runSeed = useCallback(() => {
    runStep("/api/admin/seed", {}, setSeedResult);
  }, [runStep]);

  const runIngest = useCallback(() => {
    runStep(
      "/api/admin/ingest/kjv",
      { bibleId: 1001, source: "ABS" },
      setIngestResult
    );
  }, [runStep]);

  const runChapters = useCallback(() => {
    runStep(
      "/api/admin/transform/chapters",
      { transformProfileId: 1 },
      setChaptersResult
    );
  }, [runStep]);

  const runVerses = useCallback(() => {
    runStep(
      "/api/admin/transform/verses",
      { transformProfileId: 1 },
      setVersesResult
    );
  }, [runStep]);

  const runAll = useCallback(async () => {
    setSchemaResult({ status: "running" });
    setSeedResult({ status: "idle" });
    setIngestResult({ status: "idle" });
    setChaptersResult({ status: "idle" });
    setVersesResult({ status: "idle" });

    // Step 1: Schema
    try {
      const schemaRes = await fetch("/api/admin/schema/validators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const schemaJson = await schemaRes.json();
      if (!schemaJson.ok) {
        setSchemaResult({ status: "error", message: schemaJson.error });
        return;
      }
      setSchemaResult({ status: "success", message: "Validators applied" });
    } catch (err) {
      setSchemaResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
      return;
    }

    // Step 2: Seed
    setSeedResult({ status: "running" });
    try {
      const seedRes = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const seedJson = await seedRes.json();
      if (!seedJson.ok) {
        setSeedResult({ status: "error", message: seedJson.error });
        return;
      }
      setSeedResult({
        status: "success",
        message: `Books: ${seedJson.data.books.created} created`,
      });
    } catch (err) {
      setSeedResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
      return;
    }

    // Step 3: Ingest
    setIngestResult({ status: "running" });
    try {
      const ingestRes = await fetch("/api/admin/ingest/kjv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bibleId: 1001, source: "ABS" }),
      });
      const ingestJson = await ingestRes.json();
      if (!ingestJson.ok) {
        setIngestResult({ status: "error", message: ingestJson.error });
        return;
      }
      setIngestResult({
        status: "success",
        message: `Ingested: ${ingestJson.data.ingested} chapters`,
      });
    } catch (err) {
      setIngestResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
      return;
    }

    // Step 4: Transform Chapters
    setChaptersResult({ status: "running" });
    try {
      const chaptersRes = await fetch("/api/admin/transform/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformProfileId: 1 }),
      });
      const chaptersJson = await chaptersRes.json();
      if (!chaptersJson.ok) {
        setChaptersResult({ status: "error", message: chaptersJson.error });
        return;
      }
      setChaptersResult({
        status: "success",
        message: `Processed: ${chaptersJson.data.processed} chapters`,
      });
    } catch (err) {
      setChaptersResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
      return;
    }

    // Step 5: Transform Verses
    setVersesResult({ status: "running" });
    try {
      const versesRes = await fetch("/api/admin/transform/verses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transformProfileId: 1 }),
      });
      const versesJson = await versesRes.json();
      if (!versesJson.ok) {
        setVersesResult({ status: "error", message: versesJson.error });
        return;
      }
      setVersesResult({
        status: "success",
        message: `Processed: ${versesJson.data.processed} verses`,
      });
    } catch (err) {
      setVersesResult({
        status: "error",
        message: err instanceof Error ? err.message : "Failed",
      });
    }
  }, []);

  const isAnyRunning = [
    schemaResult,
    seedResult,
    ingestResult,
    chaptersResult,
    versesResult,
  ].some((r) => r.status === "running");

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">ETL Pipeline</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Initialize the database and run the ETL pipeline.
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={isAnyRunning}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAnyRunning ? "Running..." : "Run All Steps"}
        </button>
      </div>

      <div className="space-y-3">
        <EtlStep
          title="1. Apply Schema Validators"
          description="Create/update MongoDB collections with JSON schema validators."
          buttonLabel="Apply"
          result={schemaResult}
          onRun={runSchema}
          disabled={isAnyRunning}
        />

        <EtlStep
          title="2. Seed Dimension Tables"
          description="Create language, bible, book records, and default transform profiles."
          buttonLabel="Seed"
          result={seedResult}
          onRun={runSeed}
          disabled={isAnyRunning}
        />

        <EtlStep
          title="3. Ingest KJV Chapters"
          description="Load raw chapter JSON files from bibles/kjv-english/ into rawChapters collection."
          buttonLabel="Ingest"
          result={ingestResult}
          onRun={runIngest}
          disabled={isAnyRunning}
        />

        <EtlStep
          title="4. Transform Chapters"
          description="Process raw chapters into chapters collection with text extraction and hashing."
          buttonLabel="Transform"
          result={chaptersResult}
          onRun={runChapters}
          disabled={isAnyRunning}
        />

        <EtlStep
          title="5. Transform Verses"
          description="Extract verses from raw chapters into verses collection."
          buttonLabel="Transform"
          result={versesResult}
          onRun={runVerses}
          disabled={isAnyRunning}
        />
      </div>
    </section>
  );
}
