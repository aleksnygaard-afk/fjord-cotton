"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="fc-btn-secondary"
      style={{ padding: "10px 20px", fontSize: 13 }}
    >
      {label}
    </button>
  );
}
