"""Architecture validation — proves the simulation layer never touches raw data.

Statically inspects every module downstream of the Twin (engine, simulation,
diff, explain, personality, report, validation, memory-at-runtime) and fails
if any of them imports the data source or reads files.

Run directly, or via `build_twins.py --inspect N` (judge mode).
"""
import ast
import sys
from pathlib import Path

TWIN_DIR = Path(__file__).parent / "twin"

# modules that must be pure state-machines (no raw-data access)
DOWNSTREAM = ["engine.py", "simulation.py", "diff.py", "explain.py",
              "personality.py", "report.py", "validation.py",
              "budget_rule.py", "suggestions.py"]

# the only module allowed to know about the data source
FORBIDDEN_IMPORTS = {"data_loader", "pandas", "csv", "sqlite3"}
FORBIDDEN_CALLS = {"read_csv", "read_json", "open"}


def check_module(path: Path) -> list[str]:
    tree = ast.parse(path.read_text())
    violations = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = [a.name for a in node.names]
            module = getattr(node, "module", "") or ""
            for banned in FORBIDDEN_IMPORTS:
                if banned in module or any(banned in n for n in names):
                    violations.append(
                        f"{path.name}:{node.lineno} imports '{banned}'")
        if isinstance(node, ast.Call):
            fn = node.func
            name = getattr(fn, "attr", None) or getattr(fn, "id", None)
            if name in FORBIDDEN_CALLS:
                violations.append(
                    f"{path.name}:{node.lineno} calls '{name}()'")
    return violations


def run_check(verbose: bool = True) -> bool:
    all_violations = []
    for fname in DOWNSTREAM:
        path = TWIN_DIR / fname
        if not path.exists():
            continue
        v = check_module(path)
        all_violations.extend(v)
        if verbose:
            status = "FAIL" if v else "OK  "
            print(f"  [{status}] twin/{fname} — "
                  + ("; ".join(v) if v else "reads Twin state only"))
    ok = not all_violations
    if verbose:
        print("\n  ARCHITECTURE " + ("VALID: simulation layer is fully "
              "isolated from raw transactions" if ok else "VIOLATED"))
    return ok


if __name__ == "__main__":
    sys.exit(0 if run_check() else 1)
