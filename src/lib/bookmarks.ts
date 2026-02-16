/**
 * Session Bookmarks and Tags Management
 * Allows users to bookmark important messages and tag sessions
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const BOOKMARKS_FILE = path.join(CLAUDE_DIR, "bookmarks.json");

export interface Bookmark {
  id: string;
  sessionId: string;
  lineNumber: number;
  label?: string;
  createdAt: string;
  preview?: string;
}

export interface SessionTag {
  sessionId: string;
  tags: string[];
  name?: string;
  starred: boolean;
  notes?: string;
  updatedAt: string;
}

export interface BookmarksData {
  version: number;
  bookmarks: Bookmark[];
  sessionTags: SessionTag[];
}

function generateId(): string {
  return `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadBookmarksData(): BookmarksData {
  if (!fs.existsSync(BOOKMARKS_FILE)) {
    return { version: 1, bookmarks: [], sessionTags: [] };
  }
  try {
    const content = fs.readFileSync(BOOKMARKS_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return { version: 1, bookmarks: [], sessionTags: [] };
  }
}

function saveBookmarksData(data: BookmarksData): void {
  const dir = path.dirname(BOOKMARKS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function addBookmark(
  sessionId: string,
  lineNumber: number,
  options?: { label?: string; preview?: string }
): Bookmark {
  const data = loadBookmarksData();

  const existing = data.bookmarks.find(
    (b) => b.sessionId === sessionId && b.lineNumber === lineNumber
  );
  if (existing) {
    if (options?.label) existing.label = options.label;
    if (options?.preview) existing.preview = options.preview;
    saveBookmarksData(data);
    return existing;
  }

  const bookmark: Bookmark = {
    id: generateId(),
    sessionId,
    lineNumber,
    label: options?.label,
    preview: options?.preview,
    createdAt: new Date().toISOString(),
  };

  data.bookmarks.push(bookmark);
  saveBookmarksData(data);
  return bookmark;
}

export function removeBookmark(bookmarkId: string): boolean {
  const data = loadBookmarksData();
  const index = data.bookmarks.findIndex((b) => b.id === bookmarkId);
  if (index === -1) return false;
  data.bookmarks.splice(index, 1);
  saveBookmarksData(data);
  return true;
}

export function getSessionBookmarks(sessionId: string): Bookmark[] {
  const data = loadBookmarksData();
  return data.bookmarks
    .filter((b) => b.sessionId === sessionId || b.sessionId.startsWith(sessionId))
    .sort((a, b) => a.lineNumber - b.lineNumber);
}

export function getAllBookmarks(): Bookmark[] {
  const data = loadBookmarksData();
  return data.bookmarks.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function tagSession(
  sessionId: string,
  options: { tags?: string[]; name?: string; starred?: boolean; notes?: string }
): SessionTag {
  const data = loadBookmarksData();

  let sessionTag = data.sessionTags.find((t) => t.sessionId === sessionId);

  if (!sessionTag) {
    sessionTag = {
      sessionId,
      tags: [],
      starred: false,
      updatedAt: new Date().toISOString(),
    };
    data.sessionTags.push(sessionTag);
  }

  if (options.tags !== undefined) {
    sessionTag.tags = [...new Set(options.tags)];
  }
  if (options.name !== undefined) {
    sessionTag.name = options.name;
  }
  if (options.starred !== undefined) {
    sessionTag.starred = options.starred;
  }
  if (options.notes !== undefined) {
    sessionTag.notes = options.notes;
  }
  sessionTag.updatedAt = new Date().toISOString();

  saveBookmarksData(data);
  return sessionTag;
}

export function addTagToSession(sessionId: string, tag: string): SessionTag {
  const data = loadBookmarksData();
  let sessionTag = data.sessionTags.find((t) => t.sessionId === sessionId);

  if (!sessionTag) {
    sessionTag = {
      sessionId,
      tags: [tag],
      starred: false,
      updatedAt: new Date().toISOString(),
    };
    data.sessionTags.push(sessionTag);
  } else if (!sessionTag.tags.includes(tag)) {
    sessionTag.tags.push(tag);
    sessionTag.updatedAt = new Date().toISOString();
  }

  saveBookmarksData(data);
  return sessionTag;
}

export function removeTagFromSession(sessionId: string, tag: string): SessionTag | null {
  const data = loadBookmarksData();
  const sessionTag = data.sessionTags.find((t) => t.sessionId === sessionId);

  if (!sessionTag) return null;

  sessionTag.tags = sessionTag.tags.filter((t) => t !== tag);
  sessionTag.updatedAt = new Date().toISOString();

  saveBookmarksData(data);
  return sessionTag;
}

export function renameSession(sessionId: string, name: string): SessionTag {
  return tagSession(sessionId, { name });
}

export function starSession(sessionId: string, starred: boolean = true): SessionTag {
  return tagSession(sessionId, { starred });
}

export function getSessionTags(sessionId: string): SessionTag | null {
  const data = loadBookmarksData();
  return data.sessionTags.find(
    (t) => t.sessionId === sessionId || t.sessionId.startsWith(sessionId)
  ) || null;
}

export function getAllSessionTags(): SessionTag[] {
  const data = loadBookmarksData();
  return data.sessionTags.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getStarredSessions(): SessionTag[] {
  const data = loadBookmarksData();
  return data.sessionTags
    .filter((t) => t.starred)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getSessionsByTag(tag: string): SessionTag[] {
  const data = loadBookmarksData();
  return data.sessionTags
    .filter((t) => t.tags.includes(tag))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getAllTags(): { tag: string; count: number }[] {
  const data = loadBookmarksData();
  const tagCounts = new Map<string, number>();

  for (const session of data.sessionTags) {
    for (const tag of session.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function clearSessionTags(sessionId: string): boolean {
  const data = loadBookmarksData();
  const index = data.sessionTags.findIndex((t) => t.sessionId === sessionId);
  if (index === -1) return false;
  data.sessionTags.splice(index, 1);
  saveBookmarksData(data);
  return true;
}

export function clearAllBookmarks(): { bookmarksCleared: number; tagsCleared: number } {
  const data = loadBookmarksData();
  const bookmarksCleared = data.bookmarks.length;
  const tagsCleared = data.sessionTags.length;
  data.bookmarks = [];
  data.sessionTags = [];
  saveBookmarksData(data);
  return { bookmarksCleared, tagsCleared };
}

export interface BookmarksSummary {
  totalBookmarks: number;
  totalTaggedSessions: number;
  starredSessions: number;
  totalTags: number;
  topTags: { tag: string; count: number }[];
  recentBookmarks: Bookmark[];
}

export function getBookmarksSummary(): BookmarksSummary {
  const data = loadBookmarksData();
  const allTags = getAllTags();

  return {
    totalBookmarks: data.bookmarks.length,
    totalTaggedSessions: data.sessionTags.length,
    starredSessions: data.sessionTags.filter((t) => t.starred).length,
    totalTags: allTags.length,
    topTags: allTags.slice(0, 10),
    recentBookmarks: data.bookmarks
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
  };
}

export function formatBookmarkReport(summary: BookmarksSummary): string {
  let output = "Bookmarks & Tags Summary\n";
  output += "═".repeat(50) + "\n\n";

  output += `Total Bookmarks: ${summary.totalBookmarks}\n`;
  output += `Tagged Sessions: ${summary.totalTaggedSessions}\n`;
  output += `Starred Sessions: ${summary.starredSessions}\n`;
  output += `Unique Tags: ${summary.totalTags}\n\n`;

  if (summary.topTags.length > 0) {
    output += "Top Tags:\n";
    for (const { tag, count } of summary.topTags) {
      output += `  #${tag} (${count})\n`;
    }
    output += "\n";
  }

  if (summary.recentBookmarks.length > 0) {
    output += "Recent Bookmarks:\n";
    for (const bookmark of summary.recentBookmarks) {
      const label = bookmark.label || `Line ${bookmark.lineNumber}`;
      const session = bookmark.sessionId.slice(0, 8);
      output += `  ${label} [${session}...]\n`;
    }
  }

  return output;
}
