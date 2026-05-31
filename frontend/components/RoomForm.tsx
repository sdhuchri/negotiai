"use client";

import { useState } from "react";
import CharacterPicker from "./CharacterPicker";

export interface RoomFormData {
  title: string;
  name: string;
  avatar: string;
  rawText: string;
  file: File | null;
}

interface Props {
  tone: "amber" | "sky";
  submitLabel: string;
  showTitle?: boolean;
  defaultAvatar?: string;
  intakePlaceholder?: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (data: RoomFormData) => void;
}

const LABEL = "text-xs font-semibold uppercase tracking-wider text-slate-500";
const INPUT =
  "rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-400/20";

export default function RoomForm({
  tone,
  submitLabel,
  showTitle = false,
  defaultAvatar = "capybara",
  intakePlaceholder,
  busy = false,
  error,
  onSubmit,
}: Props) {
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [rawText, setRawText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const btn =
    tone === "amber"
      ? "from-amber-500 to-orange-500 shadow-amber-500/30"
      : "from-sky-500 to-cyan-500 shadow-sky-500/30";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ title, name: name.trim(), avatar, rawText, file });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {showTitle && (
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Judul Negosiasi</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. Pengadaan 10 Server 2026"
            className={INPUT}
          />
        </label>
      )}

      <div className="flex flex-col gap-2">
        <span className={LABEL}>Pilih Karakter</span>
        <CharacterPicker value={avatar} onChange={setAvatar} tone={tone} flip={tone === "amber"} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Nama Kamu / Tim</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. Tim Procurement BSYA"
          className={INPUT}
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Jelaskan kebutuhan / penawaranmu (teks bebas)</span>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={5}
          placeholder={
            intakePlaceholder ??
            "Tulis bebas — budget, kuantitas, prioritas, lead time, syarat… Nanti AI yang menganalisanya."
          }
          className={INPUT}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Atau lampirkan dokumen (opsional · PDF/DOCX/gambar)</span>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-1.5 file:font-medium file:text-sky-700 hover:file:bg-sky-200"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy || !name.trim()}
        className={`rounded-xl bg-gradient-to-r ${btn} px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {busy ? "Memproses…" : submitLabel}
      </button>
    </form>
  );
}
