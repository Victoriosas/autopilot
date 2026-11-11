#!/usr/bin/env python3
"""Read-only, secret-free GitHub inventory for plan cloud baseline."""
import datetime as dt
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "plan-cloud-output"
OUT.mkdir(exist_ok=True)
REPO = os.environ.get("GITHUB_REPOSITORY", "Victoriosas/autopilot")
TOKEN = os.environ.get("GH_TOKEN", "")
SHA = os.environ.get("GITHUB_SHA", "unknown")

def get(path):
    req = Request(f"https://api.github.com/repos/{REPO}/{path}",
        headers={"Accept": "application/vnd.github+json",
                 "Authorization": f"Bearer {TOKEN}",
                 "User-Agent": "victoriosas-plan-cloud"})
    with urlopen(req, timeout=20) as response:
        return json.load(response)

def main():
    skill = ROOT / ".agents/skills/plan/SKILL.md"
    assert skill.is_file(), "Missing plan skill; cloud run must use committed skill"
    data = skill.read_text(encoding="utf-8")
    assert "name: plan" in data[:500], "Unexpected skill metadata"
    assert (ROOT / "AGENTS.md").is_file(), "Missing AGENTS.md"
    prs = get("pulls?state=open&per_page=100")
    branches = get("branches/main")
    normalized = [{"number": p["number"], "title": p["title"],
                   "draft": p["draft"], "base": p["base"]["ref"],
                   "head": p["head"]["sha"], "url": p["html_url"]}
                  for p in prs]
    observed = dt.datetime.now(dt.timezone.utc).isoformat()
    result = {"repository": REPO, "observed_utc": observed,
              "checkout_sha": SHA, "main_sha": branches["commit"]["sha"],
              "plan_skill_present": True, "open_pull_requests": normalized,
              "status": "INVENTORY_ONLY", "execution_authorized": False}
    (OUT / "inventory.json").write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    lines = ["# PLAN Cloud · Inventario verificable", "",
             f"- Repositorio: `{REPO}`", f"- Observado (UTC): {observed}",
             f"- SHA del checkout: `{SHA}`",
             f"- SHA de main: `{result['main_sha']}`",
             f"- Habilidad plan: presente ({len(data.splitlines())} líneas)",
             f"- PR abiertas: {len(normalized)}", "",
             "## PR abiertas", ""]
    for p in normalized:
        lines.append(f"- #{p['number']} · {p['title']} · {'borrador' if p['draft'] else 'abierta'} · {p['head'][:12]}")
    lines += ["", "## Decisión de seguridad", "",
              "Auditoría P0 en lectura. No se ejecutaron modelos ni cambios, fusiones, despliegues o envíos.",
              "Esta salida NO certifica CI, estado de worktrees locales ni escritores activos.",
              "La siguiente misión debe reconciliar estado y evidencias antes de modificar el repositorio.", ""]
    (OUT / "report.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"plan-cloud: {len(normalized)} PR abiertas; main={result['main_sha']}; reporte creado")

if __name__ == "__main__":
    main()
