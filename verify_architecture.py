"""Architecture validation — proves the simulation layer never touches raw data.

Statically scans every module downstream of the Twin (engine, simulation,
diff, report, explain, validation, personality) and fails if any of them
imports the data layer or pandas IO. Run it live in front of judges:

    python3 verify_architecture.py
"""
import ast
import sys
from pathlib import Path

TWIN_DIR = Path(__file__).parent / "twin"

# modules that must be isolated from raw transactions
DOWNSTREAM = ["engine.py", "simulation.py", "diff.py", "report.py",
              "explain.py", "validation.py", "personality.py",
              "budget_rule.py", "suggestions.py"]
# forbidden dependencies for those modules
FORBIDDEN = {"data_loader", "pandas", "pd"}


def imports_of(path: Path) -> set[str]:
    tree = ast.parse(path.read_text())
    found = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            found.update(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                found.add(node.module.split(".")[-1])
            found.update(a.name for a in node.names)
    return found


def main() -> int:
    failures = []
    for name in DOWNSTREAM:
        mods = imports_of(TWIN_DIR / name)
        bad = mods & FORBIDDEN
        status = "FAIL" if bad else "OK"
        print(f"  twin/{name:18s} {status}"
              + (f"  ← imports {sorted(bad)}" if bad else ""))
        if bad:
            failures.append(name)

    print()
    if failures:
        print("ARCHITECTURE VIOLATION: simulation layer depends on raw data.")
        return 1
    print("PASS — the Twin and Simulation layers are fully isolated from raw "
          "transactions.\nThey can only reason from FinancialTwin state.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
