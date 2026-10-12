"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile, ProfileSlots } from "@/lib/types";

interface EditableProfile {
  name: string;
  display_name: string;
  slots: ProfileSlots;
  extended: string[];
}

interface EditableRow {
  name: string;
  display_name: string;
  slots: ProfileSlots;
  extended: string[];
  isNew: boolean;
  isDirty: boolean;
}

export default function ProfileEditor({ models }: { models: string[] }) {
  const [profiles, setProfiles] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [newProfileName, setNewProfileName] = useState("");
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(
    new Set(),
  );

  // Load profiles from API
  const loadProfiles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/profiles");
      if (!res.ok) throw new Error("Failed to load profiles");

      const data = (await res.json()) as {
        profiles: EditableProfile[];
      };
      setProfiles(
        data.profiles.map((p) => ({ ...p, isNew: false, isDirty: false })),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load profiles",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const toggleExpanded = (name: string) => {
    setExpandedProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const updateProfile = (
    name: string,
    updates: Partial<EditableRow>,
  ) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.name === name ? { ...p, ...updates, isDirty: true } : p,
      ),
    );
  };

  const updateSlot = (
    name: string,
    tier: keyof ProfileSlots,
    value: string | undefined,
  ) => {
    setProfiles((prev) =>
      prev.map((p) =>
        p.name === name
          ? {
              ...p,
              slots: { ...p.slots, [tier]: value || undefined },
              isDirty: true,
            }
          : p,
      ),
    );
  };

  const addNewProfile = async () => {
    if (!newProfileName.trim()) {
      setError("Profile name is required");
      return;
    }

    if (profiles.some((p) => p.name === newProfileName)) {
      setError("Profile name already exists");
      return;
    }

    try {
      setError("");
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProfileName,
          display_name: newProfileName,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to create profile");
      }

      setProfiles((prev) => [
        ...prev,
        {
          name: newProfileName,
          display_name: newProfileName,
          slots: {},
          extended: [],
          isNew: true,
          isDirty: true,
        },
      ]);
      setNewProfileName("");
      setExpandedProfiles((prev) => new Set([...prev, newProfileName]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile");
    }
  };

  const deleteProfile = async (name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the "${name}" profile?`,
      )
    ) {
      return;
    }

    try {
      setError("");
      const res = await fetch(`/api/profiles?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete profile");

      setProfiles((prev) => prev.filter((p) => p.name !== name));
      setExpandedProfiles((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete profile");
    }
  };

  const saveAll = async () => {
    const dirtyProfiles = profiles.filter((p) => p.isDirty);
    if (dirtyProfiles.length === 0) {
      setError("No changes to save");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const res = await fetch("/api/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profiles: dirtyProfiles.map((p) => ({
            name: p.name,
            display_name: p.display_name,
            slots: p.slots,
            extended: p.extended,
          })),
        }),
      });

      if (!res.ok) throw new Error("Failed to save profiles");

      setProfiles((prev) =>
        prev.map((p) => ({ ...p, isDirty: false, isNew: false })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profiles");
    } finally {
      setSaving(false);
    }
  };

  const hasDirtyProfiles = profiles.some((p) => p.isDirty);

  if (loading) {
    return <div className="editor-container">Loading profiles...</div>;
  }

  return (
    <div className="editor-container">
      {error && <div className="error-message">{error}</div>}

      <div className="editor-toolbar">
        <div className="new-profile-input">
          <input
            type="text"
            placeholder="New profile name…"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addNewProfile();
              }
            }}
          />
          <button onClick={addNewProfile} disabled={!newProfileName.trim()}>
            Add Profile
          </button>
        </div>

        <button
          onClick={saveAll}
          disabled={!hasDirtyProfiles || saving}
          className="save-button"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="profiles-list">
        {profiles.length === 0 ? (
          <div className="empty">No profiles yet. Create one to get started.</div>
        ) : (
          profiles.map((profile) => {
            const isExpanded = expandedProfiles.has(profile.name);
            const hasMissingTiers =
              !profile.slots.fable &&
              !profile.slots.opus &&
              !profile.slots.sonnet &&
              !profile.slots.haiku;

            return (
              <div
                key={profile.name}
                className={`profile-editor-row ${isExpanded ? "expanded" : ""} ${
                  profile.isDirty ? "dirty" : ""
                } ${profile.isNew ? "new" : ""}`}
              >
                <div className="row-header">
                  <button
                    className="expand-toggle"
                    onClick={() => toggleExpanded(profile.name)}
                  >
                    {isExpanded ? "▼" : "▶"} {profile.display_name}
                  </button>
                  <span className="profile-name-id" title={profile.name}>
                    {profile.name}
                  </span>
                  {profile.isDirty && <span className="badge dirty">unsaved</span>}
                  {profile.isNew && <span className="badge new">new</span>}
                  {hasMissingTiers && (
                    <span className="badge warn">incomplete</span>
                  )}
                  <button
                    className="delete-button"
                    onClick={() => deleteProfile(profile.name)}
                    title="Delete profile"
                  >
                    ✕
                  </button>
                </div>

                {isExpanded && (
                  <div className="row-content">
                    <div className="edit-group">
                      <label>Display Name</label>
                      <input
                        type="text"
                        value={profile.display_name}
                        onChange={(e) =>
                          updateProfile(profile.name, {
                            display_name: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="tiers-grid">
                      {["opus", "sonnet", "haiku"].map((tier) => (
                        <div key={tier} className="edit-group">
                          <label>{tier}</label>
                          <input
                            type="text"
                            list="model-list"
                            placeholder={`Select ${tier} model…`}
                            value={profile.slots[tier as keyof ProfileSlots] || ""}
                            onChange={(e) =>
                              updateSlot(
                                profile.name,
                                tier as keyof ProfileSlots,
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      ))}
                      <div className="edit-group">
                        <label>fable (if not opus)</label>
                        <input
                          type="text"
                          list="model-list"
                          placeholder="Select fable model…"
                          value={profile.slots.fable || ""}
                          onChange={(e) =>
                            updateSlot(profile.name, "fable", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="edit-group">
                      <label>Extended models (comma-separated)</label>
                      <input
                        type="text"
                        value={profile.extended.join(", ")}
                        onChange={(e) =>
                          updateProfile(profile.name, {
                            extended: e.target.value
                              .split(",")
                              .map((m) => m.trim())
                              .filter((m) => m),
                          })
                        }
                        placeholder="model1, model2, …"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <datalist id="model-list">
        {models.map((model) => (
          <option key={model} value={model} />
        ))}
      </datalist>
    </div>
  );
}
