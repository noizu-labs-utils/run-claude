defmodule RunClaudeWeb.RequestTest do
  use ExUnit.Case, async: false
  import Phoenix.ConnTest

  @endpoint RunClaudeWeb.Endpoint

  test "GET /healthz returns ok for k8s probes" do
    conn = get(build_conn(), "/healthz")
    assert conn.status == 200
    assert conn.resp_body == "ok"
  end

  test "GET / renders the landing page with the hero headline" do
    conn = get(build_conn(), "/")
    assert conn.status == 200
    assert conn.resp_body =~ "Claude Code. Your models."
  end

  test "GET / includes SEO head tags" do
    conn = get(build_conn(), "/")
    body = conn.resp_body

    assert body =~ "<title>run-claude — Claude Code. Your models.</title>"
    assert body =~ ~r/name="description" content="run-claude routes Claude Code/
    assert body =~ "og:title"
  end

  test "GET / includes benefits, tier table, how-it-works, FAQ, and CTA copy" do
    conn = get(build_conn(), "/")
    body = conn.resp_body

    assert body =~ "Claude Code, your models"
    assert body =~ "Your subscription, where it makes sense"
    assert body =~ "Local gateway, no middleman"
    assert body =~ "Tier mappings are one YAML stanza"
    assert body =~ "claude-opus-5"
    assert body =~ "wafer/deepseek-v4-flash-0731-fast[1m]"
    assert body =~ "cerebras/llama-3.3-70b"
    assert body =~ "How it works"
    assert body =~ "Do my API keys leave my machine?"
    assert body =~ "the license?"
    assert body =~ "run-claude secrets init --generate"
    assert body =~ "Install from source"
    assert body =~ "Prerequisites"
    assert body =~ "Not on PyPI"
  end

  test "GET / includes footer attribution and disclaimer" do
    conn = get(build_conn(), "/")
    body = conn.resp_body

    assert body =~ "open source, MIT"
    assert body =~ "https://github.com/noizu/run-claude"
    assert body =~ "This site is Elixir Hologram."
    assert body =~ "independent open-source tool"
    assert body =~ "trademarks of their respective owners"
  end

  test "static assets are served" do
    conn = get(build_conn(), "/assets/css/site.css")
    assert conn.status == 200
  end
end
