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
    if (token === "odd" || token === "even") {
      const parity = token === "odd" ? 1 : 0;
      for (let page = 1; page <= totalPages; page += 1) {
        if (page % 2 === parity) addIndex(page - 1, indexes, seen, options.allowDuplicates);
      }
      continue;
    }

    const match = token.match(/^([a-z]+|\d+)(?:\s*-\s*([a-z]+|\d+))?$/);
    if (!match) {
      throw new Error(`Page range "${token}" is not valid. Use values like 1, 2-4, last, odd, or even.`);
    }

    const start = resolvePageToken(match[1], totalPages);
    const end = resolvePageToken(match[2] ?? match[1], totalPages);

    const direction = start <= end ? 1 : -1;
    for (let page = start; direction > 0 ? page <= end : page >= end; page += direction) {
      addIndex(page - 1, indexes, seen, options.allowDuplicates);
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
  if (indexes.length === 0) return "none";

  const pages = indexes.map((index) => index + 1);
  const ranges: string[] = [];
  let start = pages[0];
  let previous = pages[0];

  for (let index = 1; index <= pages.length; index += 1) {
    const page = pages[index];
    if (page === previous + 1) {
      previous = page;
      continue;
    }

    ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = page;
    previous = page;
  }

  return ranges.join("_");
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

function resolvePageToken(token: string, totalPages: number): number {
  if (token === "first") return 1;
  if (token === "last") return totalPages;
  if (/^\d+$/.test(token)) {
    const page = Number(token);
    assertPageNumber(page, totalPages);
    return page;
  }

  throw new Error(`Page value "${token}" is not valid. Use a page number, first, last, odd, or even.`);
}

function addIndex(
  index: number,
  indexes: number[],
  seen: Set<number>,
  allowDuplicates = false
): void {
  if (allowDuplicates || !seen.has(index)) {
    seen.add(index);
    indexes.push(index);
  }
}
