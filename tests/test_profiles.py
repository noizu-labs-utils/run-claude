"""Tests for run_claude.profiles inspection helpers."""

import pytest

from run_claude.profiles import (
    clear_caches,
    format_profile_list,
    format_profile_view,
    inspect_profile,
    list_profile_infos,
    list_profiles,
)


def test_list_profile_infos_includes_display_names():
    infos = {info.name: info for info in list_profile_infos()}
    assert "alibaba" in infos
    assert infos["alibaba"].display_name == "Alibaba Token Plan"
    assert infos["alibaba"].source_path.exists()


def test_list_profiles_matches_infos():
    assert list_profiles() == [info.name for info in list_profile_infos()]


def test_inspect_alibaba_tiers_and_extended(monkeypatch, tmp_path):
    # Hermetic: pin resolution to the built-in catalog (see test_inspect_wafer_tiers).
    monkeypatch.setattr(
        "run_claude.profiles.get_user_models_file",
        lambda: tmp_path / "no-user-models.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_file",
        lambda: tmp_path / "no-user-profiles.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_override_file",
        lambda: tmp_path / "no-user-profile-override.yaml",
    )
    clear_caches()
    try:
        _assert_alibaba_inspection()
    finally:
        clear_caches()


def _assert_alibaba_inspection():
    inspection = inspect_profile("alibaba")
    assert inspection is not None
    assert inspection.name == "alibaba"
    assert inspection.display_name == "Alibaba Token Plan"
    assert inspection.fable_fallback is False

    opus = inspection.tiers["opus"]
    assert opus.model_name == "alibaba/qwen3.8-max"
    assert opus.internal_name == "anthropic/qwen3.8-max"
    assert opus.key_env == "QWEN_SUB_KEY"
    assert opus.instance == "qwen"
    assert "token-plan.ap-southeast-1.maas.aliyuncs.com" in opus.api_base

    fable = inspection.tiers["fable"]
    assert fable.model_name == "alibaba/deepseek-v4-pro-0813"
    assert fable.internal_name == "anthropic/deepseek-v4-pro-0813"

    sonnet = inspection.tiers["sonnet"]
    assert sonnet.internal_name == "anthropic/glm-5.2"

    haiku = inspection.tiers["haiku"]
    assert haiku.internal_name == "anthropic/qwen3.6-flash"

    extra_names = {item.model_name for item in inspection.extended}
    assert "alibaba/kimi-k2.7-code" in extra_names
    assert "alibaba/deepseek-v4-pro" in extra_names
    assert "alibaba/minimax-m2.5" in extra_names
    # Tier models themselves are not repeated as additional models.
    assert "alibaba/qwen3.8-max" not in extra_names


def test_inspect_wafer_tiers(monkeypatch, tmp_path):
    # Hermetic: pin resolution to the built-in catalog. inspect_profile merges
    # ~/.config/run-claude/models.yaml over built-ins, so a host with stale
    # user overrides would otherwise fail this repo-tier assertion.
    monkeypatch.setattr(
        "run_claude.profiles.get_user_models_file",
        lambda: tmp_path / "no-user-models.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_file",
        lambda: tmp_path / "no-user-profiles.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_override_file",
        lambda: tmp_path / "no-user-profile-override.yaml",
    )
    clear_caches()
    try:
        _assert_wafer_inspection()
    finally:
        clear_caches()


def _assert_wafer_inspection():
    inspection = inspect_profile("wafer")
    assert inspection is not None
    assert inspection.name == "wafer"
    assert inspection.display_name == "Wafer Serverless"

    fable = inspection.tiers["fable"]
    assert fable.model_name == "wafer/kimi-k3[1m]"
    assert fable.internal_name == "anthropic/Kimi-K3"
    assert fable.key_env == "WAFER_AI_API_KEY"
    assert "pass.wafer.ai" in fable.api_base

    # Tier remap (2026-08): opus=GLM-5.3-Flash, sonnet=Qwen3.5-397B, haiku=DS-V4-Flash-Fast
    expected_internal = {
        "opus": "anthropic/GLM-5.3-Flash",
        "sonnet": "anthropic/Qwen3.5-397B-A17B",
        "haiku": "anthropic/DeepSeek-V4-Flash-0731-Fast",
    }
    for tier, internal in expected_internal.items():
        binding = inspection.tiers[tier]
        assert binding.internal_name == internal
        assert binding.key_env == "WAFER_AI_API_KEY"
        assert "pass.wafer.ai" in binding.api_base

    extra_names = {item.model_name for item in inspection.extended}
    assert "wafer/kimi-k2.6[1m]" in extra_names
    assert "wafer/glm-5.2[1m]" in extra_names


def test_inspect_zai_pro_instances(monkeypatch, tmp_path):
    # Hermetic: pin resolution to the built-in catalog (see test_inspect_wafer_tiers).
    # A host with a stale ~/.config/run-claude/user.profiles.yaml zai-pro override
    # would otherwise shadow this repo's haiku_model update.
    monkeypatch.setattr(
        "run_claude.profiles.get_user_models_file",
        lambda: tmp_path / "no-user-models.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_file",
        lambda: tmp_path / "no-user-profiles.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_override_file",
        lambda: tmp_path / "no-user-profile-override.yaml",
    )
    clear_caches()
    try:
        inspection = inspect_profile("zai-pro")
        assert inspection is not None
        assert inspection.tiers["fable"].internal_name == "anthropic/glm-5.3"
        # Effort ladder (2026-10): fable = glm-5.3 at max; opus = glm-5.3-flash at
        # max, sonnet at high (FlashX is not subscribed); haiku = flash at low.
        assert inspection.tiers["fable"].model_name == "zai/glm-5.3 (sub, max)"
        assert inspection.tiers["opus"].model_name == "zai/glm-5.3-flash (sub, max)"
        assert inspection.tiers["opus"].internal_name == "anthropic/glm-5.3-flash"
        assert inspection.tiers["opus"].key_env == "ZAI_SUB_KEY"
        assert inspection.tiers["opus"].instance == "zai"
        assert inspection.tiers["haiku"].model_name == "zai/glm-5.3-flash (sub, low)"
        assert inspection.tiers["haiku"].internal_name == "anthropic/glm-5.3-flash"

        tyna = next(item for item in inspection.extended if item.model_name == "zai-alt/glm-5.3-flash")
        assert tyna.key_env == "ZAI_SUB_KEY_TYNA"
        assert tyna.instance == "tyna"
        assert tyna.internal_name == "anthropic/glm-5.3-flash"
    finally:
        clear_caches()


def test_inspect_zai_pro_alt_defaults_to_tyna(monkeypatch, tmp_path):
    # Hermetic: see test_inspect_zai_pro_instances.
    monkeypatch.setattr(
        "run_claude.profiles.get_user_models_file",
        lambda: tmp_path / "no-user-models.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_file",
        lambda: tmp_path / "no-user-profiles.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_override_file",
        lambda: tmp_path / "no-user-profile-override.yaml",
    )
    clear_caches()
    try:
        inspection = inspect_profile("zai-pro-alt")
        assert inspection is not None
        assert inspection.display_name == "Zai Subscription (Alt)"
        assert inspection.tiers["opus"].model_name == "zai-alt/glm-5.3-flash (sub, max)"
        # 994711a (tier ladder): sonnet is pinned to the explicit (sub, high) id.
        assert inspection.tiers["sonnet"].model_name == "zai-alt/glm-5.3-flash (sub, high)"
        assert inspection.tiers["haiku"].model_name == "zai-alt/glm-5.3-flash (sub, low)"
        assert inspection.tiers["fable"].model_name == "zai-alt/glm-5.3 (sub, max)"
        assert inspection.tiers["opus"].internal_name == "anthropic/glm-5.3-flash"
        assert inspection.tiers["sonnet"].internal_name == "anthropic/glm-5.3-flash"
        assert inspection.tiers["haiku"].internal_name == "anthropic/glm-5.3-flash"
        assert inspection.tiers["fable"].internal_name == "anthropic/glm-5.3"
        assert inspection.tiers["opus"].key_env == "ZAI_SUB_KEY_TYNA"
        assert inspection.tiers["opus"].instance == "tyna"

        extra_names = {item.model_name for item in inspection.extended}
        assert "zai-alt/glm-5.3-flash[1m]" in extra_names
        assert "zai-alt/glm-5.3[1m]" in extra_names
        assert "zai-oa-alt/glm-5.3" in extra_names
        assert "zai-alt/opus" not in extra_names
        assert "zai/opus" not in extra_names
    finally:
        clear_caches()


def test_zai_alt_profile_is_alias_of_zai_pro_alt():
    alt = inspect_profile("zai-alt")
    pro_alt = inspect_profile("zai-pro-alt")
    assert alt is not None and pro_alt is not None
    assert alt.tiers["opus"].model_name == pro_alt.tiers["opus"].model_name
    assert alt.tiers["opus"].key_env == "ZAI_SUB_KEY_TYNA"


def test_zai_alt_catalog_clone_mirrors_zai_skus():
    from run_claude.profiles import load_model_definitions

    models = load_model_definitions(force_reload=True, quiet=True)
    assert "zai-alt/glm-5.3-flash" in models
    src = models["zai/glm-5.3-flash"]
    dst = models["zai-alt/glm-5.3-flash"]
    assert dst.litellm_params["model"] == src.litellm_params["model"]
    assert dst.litellm_params["api_base"] == src.litellm_params["api_base"]
    assert src.litellm_params["api_key"] == "os.environ/ZAI_SUB_KEY"
    assert dst.litellm_params["api_key"] == "os.environ/ZAI_SUB_KEY_TYNA"
    assert "zai-alt/glm-5.3-flash[1m]" in models
    assert "zai-oa-alt/glm-5.3" in models
    assert models["zai-oa-alt/glm-5.3"].litellm_params["model"] == (
        models["zai-oa/glm-5.3"].litellm_params["model"]
    )


def test_inspect_cerebras_explicit_fable_tier(monkeypatch, tmp_path):
    # Hermetic: see test_inspect_zai_pro_instances. Without this a host
    # ~/.config/run-claude/models.yaml masked the missing catalog entry.
    monkeypatch.setattr(
        "run_claude.profiles.get_user_models_file",
        lambda: tmp_path / "no-user-models.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_file",
        lambda: tmp_path / "no-user-profiles.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_override_file",
        lambda: tmp_path / "no-user-profile-override.yaml",
    )
    clear_caches()
    try:
        inspection = inspect_profile("cerebras")
        assert inspection is not None
        assert inspection.fable_fallback is False
        assert inspection.tiers["fable"].model_name == "cerebras/zai-glm-4.7"
        # Tier variance (2026-10): gemma-4-31b dropped from the catalog;
        # opus = qwen-3-235b, haiku = llama-3.3-70b (was gpt-oss-120b, dup of sonnet).
        assert inspection.tiers["opus"].model_name == "cerebras/qwen-3-235b-a22b-instruct-2507"
        assert inspection.tiers["sonnet"].model_name == "cerebras/gpt-oss-120b"
        assert inspection.tiers["haiku"].model_name == "cerebras/llama-3.3-70b"
        assert inspection.tiers["opus"].key_env == "CEREBRAS_API_KEY"
    finally:
        clear_caches()


def test_inspect_missing_returns_none():
    assert inspect_profile("definitely-not-a-profile") is None


def test_unprefixed_models_group_by_named_key():
    inspection = inspect_profile("anthropic")
    assert inspection is not None
    families = {ks.family for ks in inspection.key_sets}
    assert "anthropic" in families
    assert not any(name.startswith("claude-") for name in families)


def test_format_profile_view_headers():
    inspection = inspect_profile("alibaba")
    text = format_profile_view(inspection)
    assert "ROLE" in text
    assert "MODEL NAME" in text
    assert "INTERNAL NAME" in text
    assert "KEY ENV" in text
    assert "INSTANCE" in text
    assert "Additional models:" in text
    assert "Key sets:" in text
    assert "FAMILY" in text
    assert "DEFAULT ENV" in text
    assert "OVERRIDE" in text
    assert "QWEN_SUB_KEY" in text


def test_inspect_zai_pro_key_sets(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    # Hermetic: ignore any real ~/.config/run-claude overrides so key-set
    # families reflect the repo profiles only (CI has no user config).
    monkeypatch.setattr(
        "run_claude.profiles.get_user_models_file",
        lambda: tmp_path / "no-user-models.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_file",
        lambda: tmp_path / "no-user-profiles.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_override_file",
        lambda: tmp_path / "no-user-profile-override.yaml",
    )
    clear_caches()
    inspection = inspect_profile("zai-pro")
    assert inspection is not None
    families = {ks.family: ks for ks in inspection.key_sets}
    assert "zai" in families
    assert families["zai"].key_env == "ZAI_SUB_KEY"
    assert families["zai"].instance == "zai"
    assert families["zai"].override == ""
    # zai-tyna tier aliases were removed (its SKUs live under zai-alt clones);
    # zai-pro binds zai/* slots plus zai-alt/zai-oa SKUs via its extended list.
    assert "zai-tyna" not in families
    clear_caches()


def test_inspect_zai_pro_alt_key_sets(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    # Hermetic: ignore any real ~/.config/run-claude overrides so key-set
    # families reflect the repo profiles only (CI has no user config).
    monkeypatch.setattr(
        "run_claude.profiles.get_user_models_file",
        lambda: tmp_path / "no-user-models.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_file",
        lambda: tmp_path / "no-user-profiles.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_override_file",
        lambda: tmp_path / "no-user-profile-override.yaml",
    )
    clear_caches()
    inspection = inspect_profile("zai-pro-alt")
    assert inspection is not None
    families = {ks.family: ks for ks in inspection.key_sets}
    assert "zai-alt" in families
    assert families["zai-alt"].key_env == "ZAI_SUB_KEY_TYNA"
    assert families["zai-alt"].instance == "tyna"
    # 994711a: zai-alt's extended list mirrors zai-pro, so the bare zai/zai-oa
    # SKUs are exposed too and the zai family (ZAI_SUB_KEY) shows up in key
    # sets. Tier slots stay on the alt key (see *_defaults_to_tyna).
    assert "zai" in families
    assert families["zai"].key_env == "ZAI_SUB_KEY"
    clear_caches()


def test_inspect_key_set_family_override(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    from run_claude.state import State, save_state

    save_state(State(key_families={"zai": "tyna"}))
    inspection = inspect_profile("zai-pro")
    assert inspection is not None
    zai = next(ks for ks in inspection.key_sets if ks.family == "zai")
    assert zai.override == "tyna"
    assert zai.override_env == "ZAI_SUB_KEY_TYNA"
    assert zai.effective_instance == "tyna"
    assert zai.effective_env == "ZAI_SUB_KEY_TYNA"
    text = format_profile_view(inspection)
    assert "tyna" in text
    assert "OVERRIDE" in text


def test_list_profile_infos_with_keys_includes_overrides(monkeypatch, tmp_path):
    monkeypatch.setenv("XDG_STATE_HOME", str(tmp_path))
    from run_claude.state import State, save_state

    save_state(State(key_families={"zai-alt": "zai"}))
    infos = {info.name: info for info in list_profile_infos(with_keys=True)}
    assert "zai-pro-alt" in infos
    brief = " ".join(ks.brief() for ks in infos["zai-pro-alt"].key_sets)
    assert "zai-alt=" in brief
    assert "->zai" in brief
    listing = format_profile_list(list(infos.values()))
    assert "zai-pro-alt" in listing
    assert "alibaba" in listing
    assert "QWEN_SUB_KEY" in listing


def _assert_no_flashx_refs(profile_name):
    """No profile may reference glm-5.3-flashx: FlashX is not in the z.ai subscription.

    The glm-5.3-flashx model cards stay in models.yaml (the SKUs exist), but
    profiles must bind the plain glm-5.3-flash equivalents instead. Checks tier
    slots as well as the extended list.
    """
    from run_claude.profiles import load_profile

    profile = load_profile(profile_name)
    assert profile is not None
    meta = profile.meta
    names = list(meta.extended or [])
    for slot in ("opus_model", "sonnet_model", "haiku_model", "fable_model"):
        value = getattr(meta, slot, None)
        if value:
            names.append(value)
    for name in names:
        assert "flashx" not in name, f"flashx is not subscribed: {name!r}"


def test_zai_pro_x_profile_exists_without_flashx():
    # The -x profiles are kept for compatibility but no longer bind FlashX.
    #
    # The display name no longer claims FlashX (it is not in the subscription),
    # but the profile key zai-pro-x is kept so existing aliases and saved
    # bindings keep resolving. zai-pro-x is now equivalent to zai-pro. The
    # contract that matters -- no flashx bindings anywhere -- is enforced by
    # _assert_no_flashx_refs below.
    assert "zai-pro-x" in list_profiles()
    inspection = inspect_profile("zai-pro-x")
    assert inspection is not None
    assert inspection.name == "zai-pro-x"
    assert inspection.display_name == "Zai Subscription (legacy -x alias)"
    assert inspection.tiers["opus"].internal_name == "anthropic/glm-5.3-flash"
    assert inspection.tiers["sonnet"].internal_name == "anthropic/glm-5.3-flash"
    assert inspection.tiers["opus"].instance == "zai"

    extra_names = {item.model_name for item in inspection.extended}
    assert "zai/glm-5.3-flash" in extra_names
    assert "zai/glm-5.3-flash[1m]" in extra_names

    _assert_no_flashx_refs("zai-pro-x")


def test_zai_alt_x_profile_exists_without_flashx():
    assert "zai-alt-x" in list_profiles()
    inspection = inspect_profile("zai-alt-x")
    assert inspection is not None
    assert inspection.name == "zai-alt-x"
    assert inspection.display_name == "Zai Subscription (Alt, legacy -x alias)"
    assert inspection.tiers["opus"].model_name == "zai-alt/glm-5.3-flash"
    assert inspection.tiers["sonnet"].model_name == "zai-alt/glm-5.3-flash"
    assert inspection.tiers["opus"].internal_name == "anthropic/glm-5.3-flash"
    assert inspection.tiers["haiku"].model_name == "zai-alt/glm-5.3-flash"
    assert inspection.tiers["fable"].model_name == "zai-alt/glm-5.3"

    extra_names = {item.model_name for item in inspection.extended}
    assert "zai-alt/glm-5.3-flash[1m]" in extra_names
    assert "zai-oa-alt/glm-5.3-flash" in extra_names

    _assert_no_flashx_refs("zai-alt-x")


def _pin_builtin_profile_resolution(monkeypatch, tmp_path):
    """Hermetic: pin resolution to the built-in catalog (see test_inspect_wafer_tiers)."""
    monkeypatch.setattr(
        "run_claude.profiles.get_user_models_file",
        lambda: tmp_path / "no-user-models.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_file",
        lambda: tmp_path / "no-user-profiles.yaml",
    )
    monkeypatch.setattr(
        "run_claude.profiles.get_user_profiles_override_file",
        lambda: tmp_path / "no-user-profile-override.yaml",
    )


def test_profile_meta_env_passthrough_defaults_false():
    from run_claude.profiles import ProfileMeta

    assert ProfileMeta.from_dict({}).env_passthrough is False
    assert ProfileMeta.from_dict({"name": "x"}).env_passthrough is False


def test_profile_meta_env_passthrough_coercion_matrix():
    """Quoted "false" must not enable passthrough; unrecognised values stay False."""
    from run_claude.profiles import ProfileMeta

    def parse(value):
        return ProfileMeta.from_dict({"env_passthrough": value}).env_passthrough

    # Real booleans
    assert parse(True) is True
    assert parse(False) is False
    # Strings, both cases (the quoted-"false" footgun from review)
    assert parse("true") is True
    assert parse("false") is False
    assert parse("TRUE") is True
    assert parse("False") is False
    assert parse("yes") is True
    assert parse("off") is False
    assert parse("") is False
    # Null / absent
    assert parse(None) is False
    # Numeric YAML scalars
    assert parse(1) is True
    assert parse(0) is False
    # Unrecognised -> default False, never a raise (hot path on every command)
    assert parse("maybe") is False
    assert parse("2") is False


def test_profile_to_dict_round_trips_env_passthrough():
    from run_claude.profiles import Profile, ProfileMeta

    profile = Profile(meta=ProfileMeta(name="t", env_passthrough=True))
    assert profile.to_dict()["meta"]["env_passthrough"] is True
    restored = Profile.from_dict(profile.to_dict())
    assert restored.meta.env_passthrough is True


def test_anthropic_profile_is_env_passthrough_only(monkeypatch, tmp_path):
    from run_claude.profiles import load_profile

    _pin_builtin_profile_resolution(monkeypatch, tmp_path)
    clear_caches()
    try:
        profile = load_profile("anthropic")
        assert profile is not None
        assert profile.meta.env_passthrough is True
    finally:
        clear_caches()


def test_env_passthrough_stays_off_otherwise(monkeypatch, tmp_path):
    from run_claude.profiles import load_profile

    _pin_builtin_profile_resolution(monkeypatch, tmp_path)
    clear_caches()
    try:
        for name in ("cerebras", "alibaba", "zai-pro", "wafer", "claude-plan"):
            profile = load_profile(name)
            assert profile is not None
            assert profile.meta.env_passthrough is False, name
    finally:
        clear_caches()


def test_profile_meta_from_data_env_passthrough_flat_and_nested():
    from run_claude.profiles import _profile_meta_from_data

    flat = _profile_meta_from_data("t", {"env_passthrough": True})
    nested = _profile_meta_from_data("t", {"meta": {"env_passthrough": True}})
    assert flat.env_passthrough is True
    assert nested.env_passthrough is True
