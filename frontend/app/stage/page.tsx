"use client";

import { useState } from "react";
import Stage, { type StageActor } from "@/components/Stage";
import {
  BACKGROUNDS,
  CHARACTERS,
  STATE_LABELS,
  STATE_ORDER,
  getCharacter,
  type NegotiationState,
} from "@/lib/characters";

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActorControls({
  title,
  tone,
  actor,
  onChange,
}: {
  title: string;
  tone: "amber" | "sky";
  actor: StageActor;
  onChange: (next: StageActor) => void;
}) {
  const accent = tone === "amber" ? "text-amber-600" : "text-sky-600";
  return (
    <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className={`mb-3 text-sm font-bold ${accent}`}>{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select
          label="Karakter"
          value={actor.charKey}
          options={CHARACTERS.map((c) => ({ value: c.key, label: c.label }))}
          onChange={(charKey) => onChange({ ...actor, charKey })}
        />
        <Select
          label="State"
          value={actor.state}
          options={STATE_ORDER.map((s) => ({ value: s, label: STATE_LABELS[s] }))}
          onChange={(state) => onChange({ ...actor, state: state as NegotiationState })}
        />
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-500">Nama Agent</span>
          <input
            value={actor.name}
            onChange={(e) => onChange({ ...actor, name: e.target.value })}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white"
          />
        </label>
      </div>
    </div>
  );
}

export default function StageDemo() {
  const [vendor, setVendor] = useState<StageActor>({
    charKey: "penguin",
    state: "aggressive",
    name: "Pak Budi · PT Vendor",
  });
  const [user, setUser] = useState<StageActor>({
    charKey: "capybara",
    state: "counter",
    name: "Tim Procurement",
  });
  const [bgKey, setBgKey] = useState<string>("snowy");

  const syncBiome = () => {
    const biome = getCharacter(vendor.charKey)?.biome;
    if (biome && BACKGROUNDS.some((b) => b.key === biome)) setBgKey(biome);
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-sky-600 shadow-sm ring-1 ring-sky-100">
            🎮 Stage Playground
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
            Panggung Negosiasi 🤝
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Pratinjau animasi avatar per <span className="font-medium text-slate-700">state negosiasi</span>.
          </p>
        </header>

        <Stage backgroundKey={bgKey} vendor={vendor} user={user} />

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="w-48">
              <Select
                label="Background"
                value={bgKey}
                options={BACKGROUNDS.map((b) => ({ value: b.key, label: b.label }))}
                onChange={setBgKey}
              />
            </div>
            <button
              onClick={syncBiome}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-sky-300 hover:text-sky-700"
            >
              Samakan background ke biome vendor
            </button>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <ActorControls title="Vendor Agent" tone="amber" actor={vendor} onChange={setVendor} />
            <ActorControls title="User Agent" tone="sky" actor={user} onChange={setUser} />
          </div>
        </div>
      </div>
    </main>
  );
}
