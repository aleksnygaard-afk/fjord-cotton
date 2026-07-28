"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────
type Facet = { key: string; name_no: string; name_en: string };
type Facets = { themes: Facet[]; collections: Facet[] };

type PublishStatus = "draft" | "scheduled" | "published";
type RowState = "idle" | "uploading" | "done" | "error";

type Row = {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  themeKey: string;
  collectionKey: string;
  priceOverrideKr: string;
  status: PublishStatus;
  publishAt: string; // datetime-local value
  prompt: string;
  generator: string;
  state: RowState;
  message?: string;
  warnings?: string[];
  result?: { slug: string; variantCount: number; mockupUrl: string | null };
};

// ── Styles (design tokens from 01-design-spec.md) ────────────
const card: React.CSSProperties = {
  border: "1px solid var(--line)",
  background: "var(--surface)",
  borderRadius: 2,
  padding: 20,
};
const label: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--faint)",
  marginBottom: 6,
  display: "block",
};
const input: React.CSSProperties = {
  width: "100%",
  fontFamily: "inherit",
  fontSize: 13,
  padding: "9px 11px",
  border: "1px solid var(--line)",
  background: "var(--bg)",
  borderRadius: 2,
  outline: "none",
  color: "var(--ink)",
};
const primaryBtn: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 13,
  letterSpacing: "0.04em",
  background: "var(--ink)",
  color: "var(--bg)",
  border: "none",
  padding: "13px 26px",
  borderRadius: 2,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 12,
  background: "none",
  border: "1px solid var(--ink)",
  padding: "8px 16px",
  borderRadius: 2,
  cursor: "pointer",
  color: "var(--ink)",
};

const uid = () =>
  `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  return base.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export default function AdminUploadPage() {
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Defaults applied to each newly added file, so ten files take one setup.
  const [defTheme, setDefTheme] = useState("");
  const [defCollection, setDefCollection] = useState("");
  const [defStatus, setDefStatus] = useState<PublishStatus>("draft");
  const [defGenerator, setDefGenerator] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("fc_admin_token");
    if (saved) setToken(saved);
  }, []);

  const connect = useCallback(async () => {
    setConnectError(null);
    try {
      const res = await fetch("/api/admin/facets", {
        headers: { "x-admin-token": token },
      });
      if (!res.ok) {
        setConnectError(
          res.status === 401
            ? "Feil admin-token."
            : `Kunne ikke hente data (${res.status}).`,
        );
        return;
      }
      const data = (await res.json()) as Facets;
      setFacets(data);
      setConnected(true);
      localStorage.setItem("fc_admin_token", token);
    } catch {
      setConnectError("Nettverksfeil. Kjører serveren?");
    }
  }, [token]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const pngs = Array.from(files).filter(
        (f) => f.type === "image/png" || f.name.toLowerCase().endsWith(".png"),
      );
      setRows((prev) => [
        ...prev,
        ...pngs.map((file) => ({
          id: uid(),
          file,
          previewUrl: URL.createObjectURL(file),
          title: titleFromFilename(file.name),
          themeKey: defTheme,
          collectionKey: defCollection,
          priceOverrideKr: "",
          status: defStatus,
          publishAt: "",
          prompt: "",
          generator: defGenerator,
          state: "idle" as RowState,
        })),
      ]);
    },
    [defTheme, defCollection, defStatus, defGenerator],
  );

  const patch = (id: string, next: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));

  const remove = (id: string) =>
    setRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.id !== id);
    });

  async function uploadRow(row: Row): Promise<void> {
    patch(row.id, { state: "uploading", message: undefined, warnings: undefined });
    const fd = new FormData();
    fd.set("file", row.file);
    fd.set("title", row.title);
    if (row.themeKey) fd.set("themeKey", row.themeKey);
    if (row.collectionKey) fd.set("collectionKey", row.collectionKey);
    if (row.priceOverrideKr) fd.set("priceOverrideKr", row.priceOverrideKr);
    fd.set("status", row.status);
    if (row.status === "scheduled" && row.publishAt)
      fd.set("publishAt", new Date(row.publishAt).toISOString());
    if (row.prompt) fd.set("prompt", row.prompt);
    if (row.generator) fd.set("generator", row.generator);

    try {
      const res = await fetch("/api/admin/designs", {
        method: "POST",
        headers: { "x-admin-token": token },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        patch(row.id, {
          state: "error",
          message:
            data?.error ??
            (data?.issues ? JSON.stringify(data.issues) : `Feil (${res.status})`),
        });
        return;
      }
      patch(row.id, {
        state: "done",
        warnings: data.warnings?.length ? data.warnings : undefined,
        result: {
          slug: data.design.slug,
          variantCount: data.design.variantCount,
          mockupUrl: data.design.mockupUrl,
        },
      });
    } catch {
      patch(row.id, { state: "error", message: "Nettverksfeil under opplasting." });
    }
  }

  async function uploadAll() {
    setBusy(true);
    // Sequential: keeps server load predictable and status readable.
    const pendingIds = rows
      .filter((r) => r.state === "idle" || r.state === "error")
      .map((r) => r.id);
    for (const id of pendingIds) {
      // Re-read from the ref so any edits made mid-run are picked up.
      const latest = rowsRef.current.find((r) => r.id === id);
      if (latest) await uploadRow(latest);
    }
    setBusy(false);
  }

  const pendingCount = rows.filter(
    (r) => r.state === "idle" || r.state === "error",
  ).length;

  // ── Token gate ──
  if (!connected) {
    return (
      <main style={{ maxWidth: 460, margin: "0 auto", padding: "72px 32px" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 40,
            letterSpacing: "-0.02em",
            margin: "0 0 8px",
          }}
        >
          Admin-opplasting
        </h1>
        <p style={{ fontSize: 14, color: "var(--body)", margin: "0 0 24px" }}>
          Skriv inn admin-token for å fortsette.
        </p>
        <div style={card}>
          <label style={label}>Admin-token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            placeholder="x-admin-token"
            style={{ ...input, marginBottom: 14 }}
          />
          <button style={primaryBtn} onClick={connect} disabled={!token}>
            Koble til
          </button>
          {connectError && (
            <p style={{ color: "#a75c3c", fontSize: 13, marginTop: 14 }}>
              {connectError}
            </p>
          )}
        </div>
      </main>
    );
  }

  // ── Main uploader ──
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 32px 100px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          Daglig opplasting
        </h1>
        <button
          style={{ ...ghostBtn, borderColor: "var(--line)" }}
          onClick={() => {
            setConnected(false);
            localStorage.removeItem("fc_admin_token");
          }}
        >
          Logg ut
        </button>
      </div>
      <p style={{ fontSize: 14, color: "var(--body)", margin: "0 0 28px", maxWidth: 620 }}>
        Slipp inn print-filene (PNG, 4500×5400). For hver fil settes bare tittel,
        tema, kolleksjon og publisering — resten utledes automatisk.
      </p>

      {/* Defaults */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ ...label, marginBottom: 12 }}>
          Standardverdier for nye filer
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 12,
          }}
        >
          <div>
            <label style={label}>Tema</label>
            <select
              style={input}
              value={defTheme}
              onChange={(e) => setDefTheme(e.target.value)}
            >
              <option value="">—</option>
              {facets?.themes.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name_no}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Kolleksjon</label>
            <select
              style={input}
              value={defCollection}
              onChange={(e) => setDefCollection(e.target.value)}
            >
              <option value="">—</option>
              {facets?.collections.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name_no}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Status</label>
            <select
              style={input}
              value={defStatus}
              onChange={(e) => setDefStatus(e.target.value as PublishStatus)}
            >
              <option value="draft">Utkast</option>
              <option value="scheduled">Planlagt</option>
              <option value="published">Publisert nå</option>
            </select>
          </div>
          <div>
            <label style={label}>Generator</label>
            <input
              style={input}
              value={defGenerator}
              onChange={(e) => setDefGenerator(e.target.value)}
              placeholder="f.eks. gpt-image-1"
            />
          </div>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `1px dashed ${dragOver ? "var(--ink)" : "var(--line-strong)"}`,
          background: dragOver ? "#efeadd" : "var(--surface)",
          borderRadius: 2,
          padding: "44px 32px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 15, color: "var(--body)" }}>
          Dra og slipp PNG-filer her, eller klikk for å velge
        </div>
        <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>
          Flere filer om gangen
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Rows */}
      {rows.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {rows.length} fil{rows.length === 1 ? "" : "er"} · {pendingCount} klar
            til opplasting
          </span>
          <button
            style={{ ...primaryBtn, opacity: busy || pendingCount === 0 ? 0.5 : 1 }}
            onClick={uploadAll}
            disabled={busy || pendingCount === 0}
          >
            {busy ? "Laster opp…" : `Last opp ${pendingCount}`}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((row) => (
          <RowCard
            key={row.id}
            row={row}
            facets={facets!}
            onPatch={(next) => patch(row.id, next)}
            onRemove={() => remove(row.id)}
            onUpload={() => uploadRow(row)}
          />
        ))}
      </div>
    </main>
  );
}

// ── One file card ────────────────────────────────────────────
function RowCard({
  row,
  facets,
  onPatch,
  onRemove,
  onUpload,
}: {
  row: Row;
  facets: Facets;
  onPatch: (next: Partial<Row>) => void;
  onRemove: () => void;
  onUpload: () => void;
}) {
  const stateColor: Record<RowState, string> = {
    idle: "var(--faint)",
    uploading: "var(--accent)",
    done: "#4a6b4a",
    error: "#a75c3c",
  };
  const stateLabel: Record<RowState, string> = {
    idle: "Klar",
    uploading: "Laster opp…",
    done: "Publisert",
    error: "Feil",
  };
  const disabled = row.state === "uploading" || row.state === "done";

  return (
    <div style={card}>
      <div style={{ display: "grid", gridTemplateColumns: "72px 1fr auto", gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={row.previewUrl}
          alt=""
          style={{
            width: 72,
            height: 90,
            objectFit: "cover",
            borderRadius: 2,
            border: "1px solid var(--line)",
            background: "var(--bg)",
          }}
        />
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={label}>Tittel</label>
              <input
                style={input}
                value={row.title}
                disabled={disabled}
                onChange={(e) => onPatch({ title: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Tema</label>
              <select
                style={input}
                value={row.themeKey}
                disabled={disabled}
                onChange={(e) => onPatch({ themeKey: e.target.value })}
              >
                <option value="">—</option>
                {facets.themes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name_no}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Kolleksjon</label>
              <select
                style={input}
                value={row.collectionKey}
                disabled={disabled}
                onChange={(e) => onPatch({ collectionKey: e.target.value })}
              >
                <option value="">—</option>
                {facets.collections.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name_no}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={label}>Prisoverstyring (kr)</label>
              <input
                style={input}
                type="number"
                min={0}
                placeholder="349"
                value={row.priceOverrideKr}
                disabled={disabled}
                onChange={(e) => onPatch({ priceOverrideKr: e.target.value })}
              />
            </div>
            <div>
              <label style={label}>Status</label>
              <select
                style={input}
                value={row.status}
                disabled={disabled}
                onChange={(e) =>
                  onPatch({ status: e.target.value as PublishStatus })
                }
              >
                <option value="draft">Utkast</option>
                <option value="scheduled">Planlagt</option>
                <option value="published">Publisert nå</option>
              </select>
            </div>
            {row.status === "scheduled" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={label}>Publiseringsdato</label>
                <input
                  style={input}
                  type="datetime-local"
                  value={row.publishAt}
                  disabled={disabled}
                  onChange={(e) => onPatch({ publishAt: e.target.value })}
                />
              </div>
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={label}>Prompt (proveniens)</label>
              <input
                style={input}
                value={row.prompt}
                disabled={disabled}
                placeholder="Prompt brukt for å generere kunsten"
                onChange={(e) => onPatch({ prompt: e.target.value })}
              />
            </div>
          </div>

          {row.state === "error" && row.message && (
            <p style={{ color: "#a75c3c", fontSize: 12, margin: "12px 0 0" }}>
              {row.message}
            </p>
          )}
          {row.warnings?.map((w, i) => (
            <p
              key={i}
              style={{ color: "#8a6d3b", fontSize: 12, margin: "8px 0 0" }}
            >
              ⚠ {w}
            </p>
          ))}
          {row.state === "done" && row.result && (
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "12px 0 0" }}>
              /{row.result.slug} · {row.result.variantCount} varianter opprettet
            </p>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: stateColor[row.state],
            }}
          >
            {stateLabel[row.state]}
          </span>
          {row.state !== "done" && (
            <div style={{ display: "flex", gap: 8 }}>
              {row.state !== "uploading" && (
                <>
                  <button style={ghostBtn} onClick={onUpload}>
                    Last opp
                  </button>
                  <button
                    style={{
                      ...ghostBtn,
                      borderColor: "var(--line)",
                      color: "var(--accent)",
                    }}
                    onClick={onRemove}
                  >
                    Fjern
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
