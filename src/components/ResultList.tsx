import type { ToolResult } from "../types";
import { downloadBlob, formatBytes } from "../utils/file";
import { zipResults } from "../utils/zip";
import { Icon } from "./Icon";

type ResultListProps = {
  results: ToolResult[];
};

export function ResultList({ results }: ResultListProps) {
  if (results.length === 0) return null;

  return (
    <section className="results">
      <div className="section-heading">
        <h2>Output</h2>
        {results.length > 1 && (
          <button
            className="button"
            type="button"
            onClick={async () => {
              const zip = await zipResults(results);
              downloadBlob(zip.blob, zip.filename);
            }}
          >
            <Icon name="Package" size={18} />
            ZIP all
          </button>
        )}
      </div>
      <ul className="result-list">
        {results.map((result) => (
          <li className="result-row" key={result.filename}>
            <Icon name="CheckCircle2" size={20} />
            <div>
              <strong>{result.filename}</strong>
              <span>{formatBytes(result.blob.size)}</span>
              {result.summary && <small>{result.summary}</small>}
            </div>
            <button className="button primary" type="button" onClick={() => downloadBlob(result.blob, result.filename)}>
              <Icon name="Download" size={18} />
              Download
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
