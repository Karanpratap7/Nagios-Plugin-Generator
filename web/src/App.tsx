import React, { useState } from "react";

type GenerateResponse = {
  id: string;
  filename: string;
  path?: string;
  preview?: string;
};

export const App: React.FC = () => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    author: "",
    version: "",
    command: "",
    warningThreshold: "",
    criticalThreshold: "",
    outputTemplate: "",
    copyToContainer: false,
    containerName: "",
    targetDir: ""
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [plugin, setPlugin] = useState<GenerateResponse | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setStatusError(false);
    setLoading(true);

    try {
      const payload = {
        ...form,
        warningThreshold: form.warningThreshold || null,
        criticalThreshold: form.criticalThreshold || null,
        outputTemplate: form.outputTemplate || null,
        containerName: form.containerName || null,
        targetDir: form.targetDir || null
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate plugin");
      }

      setPlugin(data);
      setStatus("Plugin generated successfully.");
    } catch (err: any) {
      setStatusError(true);
      setStatus(err.message || "Failed to generate plugin");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!plugin?.id) return;
    window.location.href = `/api/plugins/${plugin.id}/download`;
  };

  const handleCopyToContainer = async () => {
    if (!plugin?.id) return;
    setStatusError(false);
    setStatus("Copying into container...");
    try {
      const res = await fetch(
        `/api/plugins/${plugin.id}/copy-to-container`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            containerName: form.containerName || undefined,
            targetDir: form.targetDir || undefined
          })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to copy plugin");
      }
      setStatus(
        `Copied into container: ${data.containerName} (${data.targetPath})`
      );
    } catch (err: any) {
      setStatusError(true);
      setStatus(err.message || "Failed to copy plugin");
    }
  };

  const features = [
    {
      title: "Define plugin",
      description:
        "Name, description, author, version, and thresholds in one place.",
      accent: "from-sky-400/80 via-cyan-300/80 to-emerald-300/80"
    },
    {
      title: "Generate script",
      description:
        "Produce a Bash Nagios plugin with proper exit codes and help text.",
      accent: "from-violet-400/80 via-fuchsia-300/80 to-sky-300/80"
    },
    {
      title: "Save & download",
      description: "Store plugins on the server and download them instantly.",
      accent: "from-amber-300/80 via-orange-400/80 to-rose-400/80"
    },
    {
      title: "Copy into container",
      description:
        "Ship plugins into your Nagios container over the Docker socket.",
      accent: "from-lime-300/80 via-emerald-400/80 to-cyan-400/80"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10 md:py-16">
      <div className="max-w-6xl w-full">
        {/* Background glows */}
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-sky-500/18 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-violet-500/22 blur-3xl" />
          <div className="absolute inset-y-1/4 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[80px]" />
        </div>

        <div className="grid gap-10 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)] items-stretch md:items-center">
          {/* Left column: hero + features */}
          <div className="space-y-6 md:space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 shadow-sm shadow-sky-500/40">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300 animate-pulse" />
              Nagios Plugin Generator
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight">
              Generate, ship, and manage{" "}
              <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                Nagios plugins
              </span>{" "}
              in one place.
            </h1>

            <p className="text-sm md:text-base text-slate-300/95 leading-relaxed max-w-xl">
              Capture your check logic, thresholds, and metadata from the
              browser, then export ready-to-run Bash plugins. Save them on the
              server, download them, or copy directly into a Nagios container.
            </p>

            <dl className="grid grid-cols-2 gap-4 pt-2 text-xs text-slate-300">
              <div>
                <dt className="text-slate-400">Output</dt>
                <dd className="font-mono text-slate-100">
                  Bash Nagios plugin
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Container support</dt>
                <dd className="font-mono text-slate-100">Docker socket</dd>
              </div>
            </dl>

            <div className="relative mt-6">
              <div className="group relative h-full w-full rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-900/85 via-slate-950/95 to-slate-950/90 p-3 shadow-[0_26px_90px_rgba(15,23,42,0.97)] transition-transform duration-500 md:hover:-translate-y-1 md:hover:rotate-[0.4deg] md:hover:scale-[1.01]">
                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-tr from-sky-500/15 via-transparent to-violet-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="grid h-full grid-cols-2 gap-3 md:gap-3.5">
                  {features.map((feature, index) => {
                    const delay = 80 * index;
                    return (
                      <div
                        key={feature.title}
                        className={`
                          relative overflow-hidden rounded-2xl border border-slate-700/70
                          bg-slate-900/75 px-4 py-4
                          shadow-[0_16px_40px_rgba(15,23,42,0.9)]
                          transition-all duration-300
                          hover:-translate-y-1 hover:border-slate-400/80 hover:bg-slate-900
                          hover:shadow-[0_24px_70px_rgba(15,23,42,0.98)]
                        `}
                        style={{
                          animation: "fadeInUp 0.5s ease-out forwards",
                          animationDelay: `${delay}ms`,
                          opacity: 0,
                          transform: "translateY(8px)"
                        }}
                      >
                        <div
                          className={`
                            pointer-events-none absolute -inset-0.5
                            bg-gradient-to-br ${feature.accent}
                            opacity-0 mix-blend-screen blur-xl
                            transition-opacity duration-300
                            group-hover:opacity-70
                          `}
                        />
                        <div className="relative flex h-full flex-col gap-2">
                          <div className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(34,197,94,0.25)]" />
                            {feature.title}
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-300">
                            {feature.description}
                          </p>
                          <div className="mt-auto flex items-center justify-between pt-1 text-[10px] text-slate-400">
                            <span className="font-mono uppercase tracking-wide text-[9px] text-slate-500">
                              plugin-step
                            </span>
                            <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px]">
                              #{index + 1}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-5 -bottom-6 h-10 rounded-full bg-gradient-to-t from-black/40 via-black/10 to-transparent blur-2xl" />
            </div>
          </div>

          {/* Right column: form + preview */}
          <div className="relative">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.9)] backdrop-blur-lg">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-200">
                      Plugin name
                    </label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      placeholder="check_http_custom"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-200">
                      Description
                    </label>
                    <input
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      placeholder="Custom HTTP check"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-200">
                      Author
                    </label>
                    <input
                      name="author"
                      value={form.author}
                      onChange={handleChange}
                      placeholder="Your name"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-200">
                      Version
                    </label>
                    <input
                      name="version"
                      value={form.version}
                      onChange={handleChange}
                      placeholder="1.0.0"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-200">
                    Command to run (embedded in plugin)
                  </label>
                  <textarea
                    name="command"
                    value={form.command}
                    onChange={handleChange}
                    required
                    placeholder="curl -fsS http://localhost:8080/healthz"
                    className="min-h-[80px] w-full resize-y rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-200">
                      Warning threshold (optional)
                    </label>
                    <input
                      name="warningThreshold"
                      value={form.warningThreshold}
                      onChange={handleChange}
                      placeholder="e.g. response time > 0.5"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-200">
                      Critical threshold (optional)
                    </label>
                    <input
                      name="criticalThreshold"
                      value={form.criticalThreshold}
                      onChange={handleChange}
                      placeholder="e.g. response time > 1.0"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-200">
                    Output message template
                  </label>
                  <input
                    name="outputTemplate"
                    value={form.outputTemplate}
                    onChange={handleChange}
                    placeholder="HTTP check: ${STATUS_TEXT} (${DETAILS})"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="copyToContainer"
                    type="checkbox"
                    name="copyToContainer"
                    checked={form.copyToContainer}
                    onChange={handleChange}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-sky-400 focus:ring-sky-500"
                  />
                  <label
                    htmlFor="copyToContainer"
                    className="text-xs text-slate-200"
                  >
                    Also copy into Nagios container
                  </label>
                </div>

                {form.copyToContainer && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-200">
                        Container name / ID
                      </label>
                      <input
                        name="containerName"
                        value={form.containerName}
                        onChange={handleChange}
                        placeholder="nagios"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-200">
                        Target dir in container
                      </label>
                      <input
                        name="targetDir"
                        value={form.targetDir}
                        onChange={handleChange}
                        placeholder="/usr/local/nagios/libexec"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-100 outline-none ring-0 transition focus:border-sky-400 focus:ring-2 focus:ring-sky-500/40"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="group inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-2 text-xs font-medium text-slate-950 shadow-lg shadow-sky-500/40 transition hover:bg-sky-400 disabled:opacity-60"
                  >
                    <span>{loading ? "Generating..." : "Generate plugin"}</span>
                    <span className="transition-transform group-hover:translate-x-0.5">
                      →
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={!plugin}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 disabled:opacity-50"
                  >
                    Download script
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyToContainer}
                    disabled={!plugin || !form.copyToContainer}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    Copy into Nagios container
                  </button>
                </div>
              </form>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-3">
                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-3">
                  <div className="mb-2 flex items-center justify-between text-[11px] text-slate-300">
                    <span>Generated plugin preview</span>
                    {plugin?.filename && (
                      <span className="font-mono text-[10px] text-slate-400">
                        {plugin.filename}
                      </span>
                    )}
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950/80 p-2 text-[11px] text-slate-200">
                    <code>
                      {plugin?.preview ||
                        "(Generate a plugin to see the script here...)"}
                    </code>
                  </pre>
                </div>
                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-3 text-[11px] text-slate-200">
                  <div className="mb-1 font-medium text-slate-100">
                    Details
                  </div>
                  {plugin ? (
                    <div className="space-y-1">
                      <div>Saved as: {plugin.filename}</div>
                      {plugin.path && (
                        <div className="text-slate-400">Path: {plugin.path}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      No plugin generated yet.
                    </div>
                  )}
                  {status && (
                    <div
                      className={`mt-3 text-[11px] ${
                        statusError ? "text-rose-300" : "text-indigo-300"
                      }`}
                    >
                      {status}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

