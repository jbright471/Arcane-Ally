"""Run on a host with Bash; test the deployed controller's real path policy."""
import subprocess
import sys
from pathlib import Path

source = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("arcane-ally-deploy.sh")).read_text()
start = source.index("RUNTIME_CHANGE=0")
end = source.index("if (( ${#BLOCKED_FILES[@]} > 0 )); then", start)
policy = source[start:end]
script = 'CHANGED_FILES=("$@")\n' + policy + '\nprintf "%s %s" "$RUNTIME_CHANGE" "${#BLOCKED_FILES[@]}"\n'
cases = {
    "client/src/App.tsx": "1 0",
    "client/package.json": "1 0",
    "client/vite.config.ts": "1 0",
    "server/server.js": "1 0",
    "server/test/productionServerSecurity.test.js": "0 0",
    "client/README.md": "0 0",
    "docs/deployment/arcane-ally-deploy.sh": "0 0",
    "server/schema.js": "0 1",
    "server/lib/restAuthorization.js": "0 1",
    "server/package.json": "0 1",
    "server/package-lock.json": "0 1",
    "client/package-lock.json": "0 1",
    "Dockerfile": "0 1",
    "server/.env": "0 1",
    "data/dnd.db": "0 1",
}
for path, expected in cases.items():
    actual = subprocess.check_output(["bash", "-c", script, "policy-test", path], text=True)
    assert actual == expected, (path, actual, expected)
print(f"release_policy_checks={len(cases)} passed")
