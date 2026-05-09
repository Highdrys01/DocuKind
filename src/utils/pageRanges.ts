export type ParsePageOptions = {
  allowDuplicates?: boolean;
};

export function allPageIndexes(totalPages: number): number[] {
  assertPageTotal(totalPages);
  return Array.from({ length: totalPages }, (_, index) => index);
}

export function parsePageSelection(
  rawValue: string | undefined,
  totalPages: number,
  options: ParsePageOptions = {}
): number[] {
  assertPageTotal(totalPages);

  const value = (rawValue ?? "").trim().toLowerCase();
  if (!value || value === "all" || value === "*") {
    return allPageIndexes(totalPages);
  }

  const seen = new Set<number>();
  const indexes: number[] = [];
  const tokens = value.split(/[,\n]+/).map((token) => token.trim()).filter(Boolean);

  for (const token of tokens) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) {
      throw new Error(`Page range "${token}" is not valid. Use values like 1, 2-4, 7.`);
    }

    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    assertPageNumber(start, totalPages);
    assertPageNumber(end, totalPages);

    const direction = start <= end ? 1 : -1;
    for (let page = start; direction > 0 ? page <= end : page >= end; page += direction) {
      const index = page - 1;
      if (options.allowDuplicates || !seen.has(index)) {
        seen.add(index);
        indexes.push(index);
      }
    }
  }

  if (indexes.length === 0) {
    throw new Error("Choose at least one page.");
  }

  return indexes;
}

export function parseRangeGroups(rawValue: string | undefined, totalPages: number): number[][] {
  const value = (rawValue ?? "").trim();
  if (!value) return [allPageIndexes(totalPages)];

  return value
    .split(/[;\n]+/)
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => parsePageSelection(group, totalPages));
}

export function formatPageLabel(indexes: number[]): string {
  return indexes.map((index) => index + 1).join("-");
}

function assertPageTotal(totalPages: number): void {
  if (!Number.isInteger(totalPages) || totalPages < 1) {
    throw new Error("The PDF does not contain any pages.");
  }
}

function assertPageNumber(page: number, totalPages: number): void {
  if (!Number.isInteger(page) || page < 1 || page > totalPages) {
    throw new Error(`Page ${page} is outside the document range of 1-${totalPages}.`);
  }
}
