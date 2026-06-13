import os
import subprocess
import sys
from pathlib import Path

KUSTOMIZATION = Path("deploy/k8s/overlays/dev/kustomization.yaml")
COMMIT = os.environ.get("BITBUCKET_COMMIT", "")

if not COMMIT:
    print("BITBUCKET_COMMIT not set, skipping")
    sys.exit(0)

# Get list of changed files in this commit
try:
    result = subprocess.run(
        ["git", "diff", "--name-only", f"{COMMIT}~1..{COMMIT}"],
        capture_output=True, text=True, check=True,
    )
    changed_files = result.stdout.splitlines()
except subprocess.CalledProcessError:
    changed_files = []

# Map source path prefixes to image names (matching pipeline build conditions)
PATH_IMAGE_MAP = {
    "frontend": "liga360-frontend",
    "services/auth-svc": "liga360-auth-svc",
    "services/gateway": "liga360-gateway",
    "services/inscriptions-svc": "liga360-inscriptions-svc",
    "services/teams-svc": "liga360-teams-svc",
    "services/tournaments-svc": "liga360-tournaments-svc",
    "services/matchevents-svc": "liga360-matchevents-svc",
    "database": "liga360-migrator",
}

# Determine which images need tag updates
images_to_update = set()
for changed_file in changed_files:
    for prefix, image_name in PATH_IMAGE_MAP.items():
        if changed_file.startswith(prefix):
            images_to_update.add(image_name)

# Read current kustomization
content = KUSTOMIZATION.read_text(encoding="utf-8")
lines = content.splitlines()
new_lines = []
current_image = None

for line in lines:
    stripped = line.lstrip()
    if stripped.startswith("- name:"):
        current_image = stripped.split(":", 1)[1].strip()
        new_lines.append(line)
    elif stripped.startswith("newName:"):
        new_lines.append(line)
    elif stripped.startswith("newTag:"):
        indent = line[: len(line) - len(stripped)]
        if current_image in images_to_update:
            new_lines.append(f"{indent}newTag: {COMMIT}")
        else:
            new_lines.append(line)
        current_image = None
    else:
        new_lines.append(line)

updated = "\n".join(new_lines) + "\n"
if updated != content:
    KUSTOMIZATION.write_text(updated, encoding="utf-8")
    print(f"Updated tags for: {', '.join(sorted(images_to_update))}")
else:
    print("No tag changes needed")
