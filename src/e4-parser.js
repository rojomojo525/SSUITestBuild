const CORE_SIGNALS = ["ACC", "BVP", "EDA", "HR", "TEMP"];
const OPTIONAL_FILES = ["IBI", "TAGS", "INFO"];

function baseName(path) {
  return path
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, "")
    .toUpperCase();
}

function numericRows(text) {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((value) => Number(value.trim())))
    .filter((row) => row.some(Number.isFinite));
}

function summarizeDimensions(samples, dimensions) {
  return Array.from({ length: dimensions }, (_, dimension) => {
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;

    for (const sample of samples) {
      const value = Array.isArray(sample) ? sample[dimension] : sample;
      if (!Number.isFinite(value)) continue;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }

    return {
      minimum: Number.isFinite(minimum) ? minimum : 0,
      maximum: Number.isFinite(maximum) ? maximum : 0,
    };
  });
}

function parseContinuousSignal(name, text) {
  const rows = numericRows(text);
  if (rows.length < 3) {
    throw new Error(`${name}.csv does not contain an E4 header and samples.`);
  }

  const startedAt = rows[0][0];
  const frequency = rows[1][0];
  const dimensions = name === "ACC" ? 3 : 1;

  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new Error(`${name}.csv has an invalid sampling frequency.`);
  }

  const samples = rows
    .slice(2)
    .map((row) => {
      if (dimensions === 1) return row[0];
      return row.slice(0, dimensions);
    })
    .filter((sample) =>
      Array.isArray(sample)
        ? sample.length === dimensions && sample.every(Number.isFinite)
        : Number.isFinite(sample),
    );

  if (samples.length === 0) {
    throw new Error(`${name}.csv contains no readable samples.`);
  }

  return {
    name,
    startedAt,
    frequency,
    dimensions,
    samples,
    durationSeconds: samples.length / frequency,
    ranges: summarizeDimensions(samples, dimensions),
  };
}

export async function parseE4Session(files) {
  const byName = new Map();

  for (const file of files) {
    const name = baseName(file.webkitRelativePath || file.name);
    if (!byName.has(name)) byName.set(name, file);
  }

  const missing = CORE_SIGNALS.filter((name) => !byName.has(name));
  if (missing.length) {
    throw new Error(`Missing required E4 files: ${missing.join(", ")}.`);
  }

  const tracks = [];
  for (const name of CORE_SIGNALS) {
    tracks.push(parseContinuousSignal(name, await byName.get(name).text()));
  }

  return {
    folderName:
      files[0]?.webkitRelativePath?.split("/")[0] ||
      files[0]?.name?.replace(/\.[^.]+$/, "") ||
      "E4 Session",
    tracks,
    presentFiles: [...byName.keys()],
    optionalFiles: OPTIONAL_FILES.filter((name) => byName.has(name)),
  };
}

export function sampleToMidi(track, sample, minimumPitch = 48, span = 24) {
  const value = Array.isArray(sample)
    ? Math.sqrt(sample.reduce((sum, item) => sum + item * item, 0))
    : sample;
  const range = track.ranges[0];
  const width = range.maximum - range.minimum || 1;
  const normalized = Math.max(0, Math.min(1, (value - range.minimum) / width));
  return Math.round(minimumPitch + normalized * span);
}

export const E4_CORE_SIGNALS = CORE_SIGNALS;
