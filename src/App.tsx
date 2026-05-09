import { useEffect, useMemo, useState } from "react";
import type { ToolDefinition, ToolOptions, ToolResult } from "./types";
import { categories, defaultOptionsFor, getTool, tools } from "./tools/registry";
import { navigate, normalizeRoute, pathForRoute } from "./utils/router";
import { FileDropzone } from "./components/FileDropzone";
import { Icon } from "./components/Icon";
import { PdfPreview } from "./components/PdfPreview";
import { ResultList } from "./components/ResultList";
import { ToolOptionsForm } from "./components/ToolOptionsForm";

export default function App() {
  const [route, setRoute] = useState(normalizeRoute());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("route")) {
      const cleanRoute = normalizeRoute();
      window.history.replaceState({}, "", pathForRoute(cleanRoute));
      setRoute(cleanRoute);
    }

    const onPopState = () => setRoute(normalizeRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const toolId = route.match(/^\/tool\/([^/]+)/)?.[1];
  const tool = toolId ? getTool(toolId) : undefined;

  return (
    <div className="app-shell">
      <Header />
      <main>{tool ? <ToolWorkspace tool={tool} /> : <Dashboard />}</main>
    </div>
  );
}

function Header() {
  return (
    <header className="topbar">
      <button className="brand" type="button" onClick={() => navigate("/")}>
        <img src="./icon.svg" alt="" />
        <span>DocuKind</span>
      </button>
      <nav aria-label="Project links">
        <span className="status-chip">
          <Icon name="ShieldCheck" size={16} />
          No uploads
        </span>
        <a className="ghost-link" href="https://github.com/Highdrys01/PDF-IMG" target="_blank" rel="noreferrer">
          <Icon name="Github" size={16} />
          GitHub
        </a>
      </nav>
    </header>
  );
}

function Dashboard() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const filteredTools = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesQuery = !normalized || `${tool.title} ${tool.tagline} ${tool.category}`.toLowerCase().includes(normalized);
      const matchesCategory = category === "All" || tool.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [category, query]);

  return (
    <div className="dashboard">
      <section className="workspace-title">
        <div>
          <p className="eyebrow">Free browser toolkit</p>
          <h1>PDF work, kept on your device.</h1>
        </div>
        <div className="metric-strip" aria-label="Privacy facts">
          <span>0 uploads</span>
          <span>0 accounts</span>
          <span>MIT</span>
        </div>
      </section>

      <section className="toolbar" aria-label="Tool filters">
        <label className="search-box">
          <Icon name="Search" size={18} />
          <input value={query} placeholder="Search tools" onChange={(event) => setQuery(event.currentTarget.value)} />
        </label>
        <div className="segmented">
          {["All", ...categories].map((item) => (
            <button className={item === category ? "active" : ""} type="button" key={item} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="tool-grid" aria-label="PDF tools">
        {filteredTools.map((tool) => (
          <button className="tool-card" type="button" key={tool.id} onClick={() => navigate(`/tool/${tool.id}`)}>
            <span className="tool-icon">
              <Icon name={tool.icon} size={24} />
            </span>
            <span className="tool-copy">
              <strong>{tool.title}</strong>
              <span>{tool.tagline}</span>
            </span>
            <small>{tool.category}</small>
          </button>
        ))}
      </section>
      {filteredTools.length === 0 && (
        <p className="empty-state">No tools match that search.</p>
      )}
    </div>
  );
}

function ToolWorkspace({ tool }: { tool: ToolDefinition }) {
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<ToolOptions>(() => defaultOptionsFor(tool));
  const [results, setResults] = useState<ToolResult[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setFiles([]);
    setOptions(defaultOptionsFor(tool));
    setResults([]);
    setError("");
    setProgress("");
    setIsRunning(false);
  }, [tool]);

  const canRun = files.length >= tool.minFiles && !isRunning;

  const runTool = async () => {
    if (files.length < tool.minFiles) {
      setError(tool.minFiles > 1 ? `Add at least ${tool.minFiles} files.` : "Add a file first.");
      return;
    }

    setIsRunning(true);
    setError("");
    setResults([]);
    setProgress("Preparing");

    try {
      const processor = await tool.processor();
      setProgress("Processing");
      const output = await processor(files, options, { onProgress: setProgress });
      setResults(output);
      setProgress(`Done: ${output.length} file${output.length === 1 ? "" : "s"} ready`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
      setProgress("");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="tool-workspace">
      <button className="back-link" type="button" onClick={() => navigate("/")}>
        <Icon name="ArrowLeft" size={18} />
        Tools
      </button>

      <section className="workspace-title compact">
        <span className="tool-icon large">
          <Icon name={tool.icon} size={28} />
        </span>
        <div>
          <p className="eyebrow">{tool.category}</p>
          <h1>{tool.title}</h1>
          <p className="tool-tagline">{tool.tagline}</p>
        </div>
      </section>

      <div className="workspace-grid">
        <div className="work-panel">
          <FileDropzone tool={tool} files={files} onFilesChange={(next) => {
            setFiles(next);
            setResults([]);
            setError("");
          }} />

          <section className="settings">
            <div className="section-heading">
              <h2>Settings</h2>
            </div>
            <ToolOptionsForm fields={tool.options} options={options} onChange={setOptions} />
            {tool.id === "compress" && options.mode === "raster" && (
              <p className="warning-copy">Raster scan rebuilds pages as images. Text selection and form fields will not survive.</p>
            )}
            {tool.options.some((option) => option.name === "pages") && (
              <p className="quiet-copy">Page fields accept `all`, `first`, `last`, `odd`, `even`, and ranges like `2-6`.</p>
            )}
          </section>

          {error && <p className="error-copy">{error}</p>}
          {progress && (
            <p className="progress-copy">
              {isRunning && <Icon name="Loader2" className="spin" size={16} />}
              {progress}
            </p>
          )}

          <button className="button run-button" type="button" disabled={!canRun} onClick={runTool}>
            {isRunning ? <Icon name="Loader2" className="spin" size={18} /> : <Icon name={tool.icon} size={18} />}
            Run {tool.title}
          </button>

          <ResultList results={results} />
        </div>

        <PdfPreview file={files[0]} />
      </div>
    </div>
  );
}
