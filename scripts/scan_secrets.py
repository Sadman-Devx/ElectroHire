#!/usr/bin/env python3
"""
Secret scanner for ElectroHire (hackathon Phase 5). Standard library only.

Looks for API keys / tokens / private keys in
  1. every file git tracks right now, and
  2. every line ever ADDED in the full git history of ALL branches
     (a key that was committed once and deleted later is still leaked).

    python scripts/scan_secrets.py            # working tree + full history
    python scripts/scan_secrets.py --tree     # tracked files only (fast)

Exit code 0 = clean, 1 = something found. Matches are printed redacted
(first 4 characters only) so the report itself is safe to paste.
If it finds a real key: REVOKE/ROTATE it at the provider first, then
clean the history -- deleting the line in a new commit is not enough.
"""

import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# High-signal patterns only, to keep false positives near zero.
PATTERNS = {
    "Tavily key": re.compile(r"\btvly-[A-Za-z0-9_-]{16,}"),
    "NVIDIA key": re.compile(r"\bnvapi-[A-Za-z0-9_-]{20,}"),
    "OpenAI/OpenRouter-style key": re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"),
    "Groq key": re.compile(r"\bgsk_[A-Za-z0-9]{20,}"),
    "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}"),
    "GitHub token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}"),
    "AWS access key id": re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    "JWT / bearer token": re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"),
    "Private key block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    # KEY=value with a non-empty, non-placeholder value.
    "Filled-in AI/Tavily key setting": re.compile(
        r"""\b(?:AI_API_KEY|TAVILY_API_KEY|NEBIUS_API_KEY)\s*[=:]\s*['"]?(?!\s|['"]|$|your|<|xxx|changeme|example|os\.environ|settings\.)[^\s'"#]{12,}""",
        re.IGNORECASE,
    ),
}

SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".woff", ".woff2",
                 ".ttf", ".zip", ".sqlite3", ".lock", ".map"}
SKIP_DIRS = {"node_modules", "venv", ".venv", "dist", "__pycache__", ".git"}
# This script itself legitimately contains the pattern text.
SELF = "scripts/scan_secrets.py"


def scan_text(text):
    """[(label, redacted_match)] for every pattern hit in `text`."""
    hits = []
    for label, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            hits.append((label, match.group(0)[:4] + "…[redacted]"))
    return hits


def _git(*args):
    return subprocess.run(
        ["git", "-C", str(REPO_ROOT), *args], capture_output=True, text=True,
        encoding="utf-8", errors="replace", check=False,
    )


def tracked_files():
    out = _git("ls-files").stdout.splitlines()
    for rel in out:
        path = Path(rel)
        if rel == SELF or path.suffix.lower() in SKIP_SUFFIXES or SKIP_DIRS & set(path.parts):
            continue
        yield rel


def scan_tree():
    findings = []
    for rel in tracked_files():
        try:
            text = (REPO_ROOT / rel).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for number, line in enumerate(text.splitlines(), start=1):
            for label, shown in scan_text(line):
                findings.append((f"{rel}:{number}", label, shown))
    return findings


def scan_history():
    """Every added line of every commit on every branch."""
    proc = subprocess.Popen(
        ["git", "-C", str(REPO_ROOT), "log", "--all", "-p", "--no-color", "-U0",
         "--format=commit %H", "--no-ext-diff"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
        encoding="utf-8", errors="replace",
    )
    findings, commit, current = [], "", ""
    for line in proc.stdout:
        if line.startswith("commit "):
            commit = line.split()[1][:10]
        elif line.startswith("+++ "):
            current = line[4:].strip().removeprefix("b/")
        elif line.startswith("+") and not line.startswith("+++"):
            if current == SELF or Path(current).suffix.lower() in SKIP_SUFFIXES:
                continue
            for label, shown in scan_text(line[1:]):
                findings.append((f"commit {commit} {current}", label, shown))
    proc.wait()
    return findings


def main(argv):
    tree_only = "--tree" in argv
    findings = [("working tree", *f) for f in scan_tree()]
    if not tree_only:
        findings += [("history", *f) for f in scan_history()]

    if not findings:
        scope = "tracked files" if tree_only else "tracked files + full git history (all branches)"
        print(f"OK: no secrets found in {scope}.")
        return 0

    print(f"FOUND {len(findings)} possible secret(s):\n")
    for where, location, label, shown in findings:
        print(f"  [{where}] {location}: {label} {shown}")
    print("\nRevoke/rotate any real key at its provider FIRST, then clean the history.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
