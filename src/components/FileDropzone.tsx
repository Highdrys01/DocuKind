import { useRef, useState } from "react";
import type { ToolDefinition } from "../types";
import { acceptsFile, dedupeFiles, formatBytes } from "../utils/file";
import { Icon } from "./Icon";

type FileDropzoneProps = {
  tool: ToolDefinition;
  files: File[];
  onFilesChange: (files: File[]) => void;
};

export function FileDropzone({ tool, files, onFilesChange }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);

  const addFiles = (incoming: FileList | File[]) => {
    const next = Array.from(incoming);
    const accepted = next.filter((file) => acceptsFile(file, tool.accepts));
    const rejected = next.filter((file) => !acceptsFile(file, tool.accepts)).map((file) => file.name);
    setRejectedFiles(rejected);

    if (accepted.length === 0) return;
    onFilesChange(tool.multiple ? dedupeFiles([...files, ...accepted]) : accepted.slice(0, 1));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;

    const next = [...files];
    const [file] = next.splice(index, 1);
    next.splice(target, 0, file);
    onFilesChange(next);
  };

  return (
    <section
      className={`dropzone ${isDragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        addFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        className="sr-only"
        data-testid="file-input"
        type="file"
        accept={tool.accepts}
        multiple={tool.multiple}
        onChange={(event) => {
          if (event.currentTarget.files) addFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <div className="dropzone-main">
        <span className="dropzone-icon">
          <Icon name="UploadCloud" size={30} />
        </span>
        <div>
          <h2>Add files</h2>
          <p>{tool.multiple ? "Drop files here or choose them from your device." : "Drop a file here or choose one from your device."}</p>
          <small>{tool.accepts.replaceAll(",", ", ")}</small>
        </div>
        <button className="button primary" type="button" onClick={() => inputRef.current?.click()}>
          Choose
        </button>
      </div>

      {files.length > 0 && (
        <ul className="file-list" aria-label="Selected files">
          {files.map((file, index) => (
            <li className="file-row" key={`${file.name}-${file.lastModified}-${index}`}>
              <Icon name="FileText" size={20} />
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatBytes(file.size)}</span>
              {tool.multiple && (
                <span className="file-actions">
                  <button className="icon-button" type="button" aria-label="Move up" onClick={() => moveFile(index, -1)}>
                    <Icon name="ArrowUp" size={16} />
                  </button>
                  <button className="icon-button" type="button" aria-label="Move down" onClick={() => moveFile(index, 1)}>
                    <Icon name="ArrowDown" size={16} />
                  </button>
                </span>
              )}
              <button
                className="icon-button"
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}
              >
                <Icon name="X" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {rejectedFiles.length > 0 && (
        <p className="inline-alert" role="alert">
          Skipped unsupported file{rejectedFiles.length > 1 ? "s" : ""}: {rejectedFiles.join(", ")}
        </p>
      )}
    </section>
  );
}
