import Papa from "papaparse";

/**
 * Trigger a browser download for a string blob.
 */
export const downloadBlob = (filename, content, mime = "text/csv;charset=utf-8") => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Convert an array of objects to a CSV string.
 * Columns: explicit list of {key, header} so output order is stable.
 */
export const toCSV = (rows, columns) => {
  return Papa.unparse(
    {
      fields: columns.map((c) => c.header),
      data: rows.map((r) => columns.map((c) => {
        const v = typeof c.format === "function" ? c.format(r) : r[c.key];
        if (v === null || v === undefined) return "";
        return v;
      })),
    },
    { quotes: true }
  );
};

/**
 * Parse a CSV file (uploaded via <input type="file">) and return an array of rows.
 */
export const parseCSV = (file) => new Promise((resolve, reject) => {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
    complete: (res) => resolve(res.data || []),
    error: (err) => reject(err),
  });
});
