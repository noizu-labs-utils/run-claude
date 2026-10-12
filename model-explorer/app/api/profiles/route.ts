import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import type { Profile, ProfileSlots } from "@/lib/types";

const PROFILES_FILENAME = "profiles.yaml";

/**
 * Top-level keys the profiles loader (run_claude/profiles.py) treats as
 * metadata rather than profiles. The editor must never create, save, or
 * delete a profile under one of these names — it would corrupt the file's
 * meta/entries separation.
 */
const RESERVED_PROFILE_NAMES: ReadonlySet<string> = new Set(["meta"]);

/** Meta keys this editor manages; everything else in `meta` is preserved. */
const MANAGED_META_KEYS = [
  "name",
  "opus_model",
  "sonnet_model",
  "haiku_model",
  "fable_model",
  "extended",
] as const;

/** User config dir, mirroring get_config_dir() (XDG_CONFIG_HOME respected). */
function configDir(): string {
  const env = process.env.RUN_CLAUDE_CONFIG_DIR;
  if (env) return env;
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "run-claude");
}

interface RawProfile {
  name?: string;
  opus_model?: string | null;
  sonnet_model?: string | null;
  haiku_model?: string | null;
  fable_model?: string | null;
  extended?: string[] | null;
  model?: unknown;
  meta?: Record<string, unknown>;
}

interface SavedProfile {
  name: string;
  display_name: string;
  slots: ProfileSlots;
  extended: string[];
}

/**
 * Result of reading profiles.yaml. "Missing" and "unparseable" are distinct:
 * a missing file is legitimately empty (writes may proceed), but a file that
 * exists and fails to parse is an error state — every write handler must
 * refuse to touch it, otherwise the next save would rewrite the whole file
 * from an empty view and silently destroy the user's config.
 */
type ProfilesRead =
  | { ok: true; profiles: Record<string, RawProfile> }
  | { ok: false; error: string };

function readProfilesFile(): ProfilesRead {
  const cfg = configDir();
  const file = path.join(cfg, PROFILES_FILENAME);

  if (!fs.existsSync(file)) {
    return { ok: true, profiles: {} };
  }

  let content: string;
  try {
    content = fs.readFileSync(file, "utf-8");
  } catch (error) {
    return {
      ok: false,
      error: `Failed to read ${file}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  let doc: unknown;
  try {
    doc = yaml.load(content);
  } catch (error) {
    return {
      ok: false,
      error: `${PROFILES_FILENAME} could not be parsed: ${
        error instanceof Error ? error.message : String(error)
      }. Fix the file by hand (a timestamped .backup-* copy of the previous version may sit next to it) before using the editor — refusing to read or overwrite it.`,
    };
  }

  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return {
      ok: false,
      error: `${PROFILES_FILENAME} did not parse to a mapping of profiles (got ${
        doc === null ? "null" : Array.isArray(doc) ? "a list" : typeof doc
      }). Fix the file by hand before using the editor — refusing to read or overwrite it.`,
    };
  }

  return { ok: true, profiles: doc as Record<string, RawProfile> };
}

/**
 * Shared guard for every handler: on an unreadable/unparseable file, return
 * the 409 response to send; when the file is readable, extract the profiles.
 * Returns null when the read succeeded.
 */
function readOrConflict(
  read: ProfilesRead,
): { profiles: Record<string, RawProfile>; conflict: null } | {
  profiles: null;
  conflict: Response;
} {
  if (read.ok) {
    return { profiles: read.profiles, conflict: null };
  }
  return {
    profiles: null,
    // 409 (not 500): the server is fine — the stored resource is in a state
    // (unparseable) that conflicts with the operation until the user fixes it.
    conflict: Response.json({ error: read.error }, { status: 409 }),
  };
}

function writeProfilesFile(profiles: Record<string, RawProfile>): void {
  const cfg = configDir();

  // Ensure config directory exists
  if (!fs.existsSync(cfg)) {
    fs.mkdirSync(cfg, { recursive: true });
  }

  const file = path.join(cfg, PROFILES_FILENAME);
  const content = yaml.dump(profiles, { lineWidth: -1, noRefs: true });

  // NOTE: there is deliberately no cross-process locking around the
  // read-modify-write cycle in PUT/POST/DELETE. Two concurrent saves can
  // still lose one side's updates. Accepted for a local-only dev tool;
  // real locking is a larger design change.

  // Keep a timestamped backup of the previous file before replacing it, so
  // any bad save remains recoverable.
  if (fs.existsSync(file)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(file, `${file}.backup-${stamp}`);
  }

  // Write to a temp file in the SAME directory, then rename over the target.
  // A same-filesystem rename is atomic, so a crash mid-write can never leave
  // profiles.yaml truncated or interleaved.
  // (Sync fs in async handlers: acknowledged and deliberate for a local-only
  // tool — converting to fs/promises is deferred to keep this diff focused.)
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(tmp, content, "utf-8");
    fs.renameSync(tmp, file);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // best effort cleanup
    }
    throw error;
  }
}

/**
 * GET /api/profiles
 * Fetch editable profiles from user config (not including builtin profiles)
 */
export async function GET() {
  try {
    const read = readOrConflict(readProfilesFile());
    if (read.conflict) return read.conflict;
    const profiles = read.profiles;
    const editable: SavedProfile[] = [];

    for (const [name, raw] of Object.entries(profiles)) {
      if (RESERVED_PROFILE_NAMES.has(name)) continue;

      const meta = (raw.meta ?? raw) as Record<string, unknown>;
      const str = (v: unknown) =>
        typeof v === "string" && v ? v : undefined;

      const ext = Array.isArray(meta.extended)
        ? (meta.extended as string[])
        : [];

      const opus = str(meta.opus_model);
      editable.push({
        name,
        display_name: str(meta.name) ?? name,
        slots: {
          fable: str(meta.fable_model) ?? opus,
          opus,
          sonnet: str(meta.sonnet_model),
          haiku: str(meta.haiku_model),
        },
        extended: ext.filter((m) => typeof m === "string"),
      });
    }

    return Response.json({ profiles: editable });
  } catch (error) {
    console.error("Error reading profiles:", error);
    return Response.json(
      { error: "Failed to read profiles" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/profiles
 * Update/save profile(s) to the user config file
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json() as {
      profiles: Array<{
        name: string;
        display_name: string;
        slots: ProfileSlots;
        extended: string[];
      }>;
    };

    if (!Array.isArray(body.profiles)) {
      return Response.json(
        { error: "Invalid request: profiles must be an array" },
        { status: 400 },
      );
    }

    for (const profile of body.profiles) {
      if (RESERVED_PROFILE_NAMES.has(profile.name)) {
        return Response.json(
          {
            error: `"${profile.name}" is a reserved name and cannot be used as a profile — the profiles loader treats a top-level "${profile.name}" key as metadata, not a profile.`,
          },
          { status: 400 },
        );
      }
    }

    const read = readOrConflict(readProfilesFile());
    if (read.conflict) return read.conflict;
    const profiles = read.profiles;

    // Update profiles from request. Preserve keys the editor does not manage
    // (e.g. env_passthrough) on both the entry and its meta map: spread the
    // existing shapes and overwrite only the keys this editor manages.
    for (const profile of body.profiles) {
      const existingRaw = profiles[profile.name];
      const existing =
        existingRaw && typeof existingRaw === "object" ? existingRaw : {};
      const existingMeta =
        existing.meta && typeof existing.meta === "object"
          ? existing.meta
          : {};

      const meta: Record<string, unknown> = { ...existingMeta };

      // Only include non-empty slots (undefined values are dropped by yaml.dump)
      const fable =
        profile.slots.fable && profile.slots.fable !== profile.slots.opus
          ? profile.slots.fable
          : undefined;

      meta.name =
        profile.display_name !== profile.name ? profile.display_name : undefined;
      meta.opus_model = profile.slots.opus || undefined;
      meta.sonnet_model = profile.slots.sonnet || undefined;
      meta.haiku_model = profile.slots.haiku || undefined;
      meta.fable_model = fable;
      meta.extended = profile.extended.length > 0 ? profile.extended : undefined;

      // An entry with no model slots and no extended models is DISABLED.
      // The loader's disable convention (run_claude/profiles.py
      // _is_profile_disabled) is `model: null` or `model: false` — write
      // exactly that. `model: {}` (or an emptied `meta: {}`) parses as a
      // truthy entry with no models, i.e. enabled-with-no-models, not
      // disabled.
      const enabled =
        Boolean(
          profile.slots.opus || profile.slots.sonnet || profile.slots.haiku || fable,
        ) || profile.extended.length > 0;

      const entry: Record<string, unknown> = { ...existing };
      delete entry.meta; // managed: rewritten below
      delete entry.model; // managed: rewritten below

      if (enabled) {
        profiles[profile.name] = { ...entry, meta } as RawProfile;
      } else {
        // Drop the managed (now-empty) meta keys; keep unmanaged ones.
        const rest: Record<string, unknown> = { ...meta };
        for (const key of MANAGED_META_KEYS) delete rest[key];
        profiles[profile.name] =
          Object.keys(rest).length > 0
            ? ({ ...entry, meta: rest, model: null } as RawProfile)
            : ({ ...entry, model: null } as RawProfile);
      }
    }

    await writeProfilesFile(profiles);

    return Response.json({
      success: true,
      message: "Profiles saved successfully",
    });
  } catch (error) {
    console.error("Error updating profiles:", error);
    return Response.json(
      { error: "Failed to update profiles" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/profiles
 * Create a new profile
 */
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name: string;
      display_name: string;
    };

    if (!body.name || typeof body.name !== "string") {
      return Response.json(
        { error: "Profile name is required" },
        { status: 400 },
      );
    }

    if (RESERVED_PROFILE_NAMES.has(body.name)) {
      return Response.json(
        {
          error: `"${body.name}" is a reserved name and cannot be used as a profile — the profiles loader treats a top-level "${body.name}" key as metadata, not a profile.`,
        },
        { status: 400 },
      );
    }

    const read = readOrConflict(readProfilesFile());
    if (read.conflict) return read.conflict;
    const profiles = read.profiles;

    if (body.name in profiles) {
      return Response.json(
        { error: "Profile already exists" },
        { status: 409 },
      );
    }

    // Create the profile disabled (`model: null`, the loader's disable
    // convention) so it stays inert until the editor gives it real models —
    // an empty entry would parse as enabled-with-no-models.
    profiles[body.name] = { model: null } as RawProfile;

    await writeProfilesFile(profiles);

    return Response.json(
      { success: true, message: "Profile created successfully" },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating profile:", error);
    return Response.json(
      { error: "Failed to create profile" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/profiles
 * Delete a profile by name (query param: name)
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get("name");

    if (!name) {
      return Response.json(
        { error: "Profile name is required" },
        { status: 400 },
      );
    }

    if (RESERVED_PROFILE_NAMES.has(name)) {
      return Response.json(
        {
          error: `"${name}" is a reserved name and cannot be deleted as a profile — the profiles loader treats a top-level "${name}" key as metadata.`,
        },
        { status: 400 },
      );
    }

    const read = readOrConflict(readProfilesFile());
    if (read.conflict) return read.conflict;
    const profiles = read.profiles;

    if (!(name in profiles)) {
      return Response.json(
        { error: "Profile not found" },
        { status: 404 },
      );
    }

    delete profiles[name];
    await writeProfilesFile(profiles);

    return Response.json({
      success: true,
      message: "Profile deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return Response.json(
      { error: "Failed to delete profile" },
      { status: 500 },
    );
  }
}
