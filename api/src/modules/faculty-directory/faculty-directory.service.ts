import type { Env } from "../../core/types";

const FACULTY_DIRECTORY_CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_FACULTY_JSON_URL =
  "https://raw.githubusercontent.com/ece-kalasalingam/ece-kalasalingam.github.io/master/faculty.json";
const DEFAULT_FACULTY_PROFILE_BASE_URL = "https://eceklu.in/faculty/?faculty=";

type RawFacultyRow = {
  name?: unknown;
  slug?: unknown;
  email?: unknown;
  designation?: unknown;
};

export type FacultyDirectoryItem = {
  name: string;
  slug: string;
  email: string;
  designation: string | null;
  profileUrl: string;
};

let facultyDirectoryCache: { cachedAt: number; rows: FacultyDirectoryItem[] } | null = null;

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function getFacultyJsonUrl(env: Env): string {
  const configured = String(env.FACULTY_JSON_URL ?? "").trim();
  return configured || DEFAULT_FACULTY_JSON_URL;
}

function getFacultyProfileBaseUrl(env: Env): string {
  const configured = String(env.FACULTY_PROFILE_BASE_URL ?? "").trim();
  return configured || DEFAULT_FACULTY_PROFILE_BASE_URL;
}

function makeFacultyProfileUrl(baseUrl: string, slug: string): string {
  if (!slug) return "";
  if (baseUrl.includes("{slug}")) {
    return baseUrl.replace("{slug}", encodeURIComponent(slug));
  }
  const separator = baseUrl.includes("?") || baseUrl.endsWith("=") ? "" : "/";
  return `${baseUrl}${separator}${encodeURIComponent(slug)}`;
}

async function fetchFacultyDirectoryRows(env: Env): Promise<FacultyDirectoryItem[]> {
  const sourceUrl = getFacultyJsonUrl(env);
  const profileBase = getFacultyProfileBaseUrl(env);
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Faculty JSON fetch failed: HTTP ${response.status}`);
  }
  const parsed = (await response.json()) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Faculty JSON payload is not an array");
  }
  const dedupe = new Map<string, FacultyDirectoryItem>();
  for (const item of parsed) {
    const row = (item ?? {}) as RawFacultyRow;
    const email = normalizeEmail(row.email);
    const slug = String(row.slug ?? "").trim();
    const name = String(row.name ?? "").trim();
    if (!email || !slug || !name) continue;
    dedupe.set(email, {
      email,
      slug,
      name,
      designation: String(row.designation ?? "").trim() || null,
      profileUrl: makeFacultyProfileUrl(profileBase, slug),
    });
  }
  return Array.from(dedupe.values());
}

export async function readFacultyDirectory(env: Env): Promise<FacultyDirectoryItem[]> {
  if (facultyDirectoryCache && Date.now() - facultyDirectoryCache.cachedAt <= FACULTY_DIRECTORY_CACHE_TTL_MS) {
    return facultyDirectoryCache.rows;
  }
  const rows = await fetchFacultyDirectoryRows(env);
  facultyDirectoryCache = { cachedAt: Date.now(), rows };
  return rows;
}

export async function lookupFacultyByEmail(
  env: Env,
  emailRaw: string | null,
): Promise<{ matched: boolean; faculty: FacultyDirectoryItem | null }> {
  const email = normalizeEmail(emailRaw);
  if (!email) {
    return { matched: false, faculty: null };
  }
  const rows = await readFacultyDirectory(env);
  const matched = rows.find((item) => item.email === email) ?? null;
  return { matched: Boolean(matched), faculty: matched };
}

export async function pickRandomFaculty(env: Env): Promise<FacultyDirectoryItem | null> {
  const rows = await readFacultyDirectory(env);
  if (rows.length === 0) return null;
  const index = Math.floor(Math.random() * rows.length);
  return rows[index] ?? null;
}

