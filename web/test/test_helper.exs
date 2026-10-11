# Hologram.Test.setup() force-runs the Hologram compiler, which crashes under
# `mix test --cover`: the post-cover recompile calls :code.which/1 on every
# module, and for cover-compiled modules it returns :cover_compiled — a value
# BeamFile cannot read, so beam_defs/1 fails with {:error, :non_existing}.
# CI (and any HOLOGRAM_START=1 run) has Hologram started and the bundles
# already built by the preceding `mix compile`, so setup() is only needed for
# bare local runs where nothing has started Hologram yet.
# Truthy check, not exact "1": an exported HOLOGRAM_START=true/yes (or any
# non-disabled value) means Hologram is already started; only "", "0" and
# "false" mean "nothing started it" and warrant the force-setup.
hologram_started? = System.get_env("HOLOGRAM_START", "") not in ["", "0", "false"]
unless hologram_started? do
  Hologram.Test.setup()
end

ExUnit.start()
