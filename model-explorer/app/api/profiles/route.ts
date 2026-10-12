import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import type { Profile, ProfileSlots } from "@/lib/types";

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

async function readProfilesFile(): Promise<Record<string, RawProfile>> {
  const cfg = configDir();
  const file = path.join(cfg, "profiles.yaml");

  if (!fs.existsSync(file)) {
    return {};
  }

  try {
    const content = fs.readFileSync(file, "utf-8");
    const doc = yaml.load(content);
    if (doc && typeof doc === "object") {
      return doc as Record<string, RawProfile>;
    }
  } catch {
    // Malformed file — return empty
  }
  return {};
}

async function writeProfilesFile(
  profiles: Record<string, RawProfile>,
): Promise<void> {
  const cfg = configDir();

  // Ensure config directory exists
  if (!fs.existsSync(cfg)) {
    fs.mkdirSync(cfg, { recursive: true });
  }

  const file = path.join(cfg, "profiles.yaml");
  const content = yaml.dump(profiles, { lineWidth: -1, noRefs: true });
  fs.writeFileSync(file, content, "utf-8");
}

/**
 * GET /api/profiles
 * Fetch editable profiles from user config (not including builtin profiles)
 */
export async function GET() {
  try {
    const profiles = await readProfilesFile();
    const editable: SavedProfile[] = [];

    for (const [name, raw] of Object.entries(profiles)) {
      if (name === "meta") continue;

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

    const profiles = await readProfilesFile();

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
      meta.name =
        profile.display_name !== profile.name ? profile.display_name : undefined;

      // Only include non-empty slots (undefined values are dropped by yaml.dump)
      meta.opus_model = profile.slots.opus || undefined;
      meta.sonnet_model = profile.slots.sonnet || undefined;
      meta.haiku_model = profile.slots.haiku || undefined;
      meta.fable_model =
        profile.slots.fable && profile.slots.fable !== profile.slots.opus
          ? profile.slots.fable
          : undefined;
      meta.extended = profile.extended.length > 0 ? profile.extended : undefined;

      const entry: Record<string, unknown> = { ...existing };
      delete entry.meta; // managed: rewritten below
      delete entry.model; // managed: cleared when the entry is enabled

      profiles[profile.name] = Object.keys(meta).length > 0
        ? ({ ...entry, meta } as RawProfile)
        : ({ ...entry, model: {} } as RawProfile); // Disabled entry
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

    const profiles = await readProfilesFile();

    if (body.name in profiles) {
      return Response.json(
        { error: "Profile already exists" },
        { status: 409 },
      );
    }

    // Create new empty profile
    profiles[body.name] = {
      meta: {
        name:
          body.display_name && body.display_name !== body.name
            ? body.display_name
            : undefined,
      },
    };

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

    const profiles = await readProfilesFile();

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
