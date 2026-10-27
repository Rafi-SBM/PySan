#!/usr/bin/env python3
"""Collect installed-package metadata for analysis with PySan.

Writes a JSON report describing every distribution visible to the interpreter
that runs it: name, version, size on disk, file count and declared
dependencies. The dependency data is what lets PySan verify that a package is
safe to remove, so prefer this script over `pip list` or `pip freeze`.

The script reads only package metadata. It never modifies the environment and
never opens a network connection.

Usage
-----
    python pysan_collect.py                       # write to stdout
    python pysan_collect.py -o packages.json      # write to a file
    python pysan_collect.py --no-sizes            # skip size measurement
    python -m pysan_collect --quiet               # no progress output

Run it with the interpreter you want to inspect. Inside a virtual environment
that is the plain `python`; for a specific interpreter use its full path.

Requires Python 3.8 or newer. Standard library only.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import sys
from datetime import datetime, timezone

try:  # Python 3.8 and newer
    from importlib.metadata import Distribution, distributions
except ImportError:  # pragma: no cover - very old interpreters
    try:
        from importlib_metadata import Distribution, distributions  # type: ignore[import-not-found]
    except ImportError:
        sys.stderr.write(
            "error: importlib.metadata is unavailable.\n"
            "       Use Python 3.8 or newer, or install importlib-metadata.\n"
        )
        raise SystemExit(2)

SCHEMA = "pysan/collector/v2"


def distribution_size(dist: "Distribution") -> "tuple[int, int]":
    """Return (bytes, file_count) for a distribution.

    The RECORD file lists every installed file, which is the accurate source.
    When it is absent -- editable installs, some system packages -- fall back
    to walking the distribution directory.
    """
    total = 0
    counted = 0
    seen: "set[str]" = set()

    files = None
    try:
        files = dist.files
    except Exception:
        files = None

    if files:
        for entry in files:
            try:
                path = os.path.realpath(str(dist.locate_file(entry)))
            except Exception:
                continue
            if path in seen:
                continue
            seen.add(path)
            try:
                total += os.path.getsize(path)
                counted += 1
            except OSError:
                continue
        return total, counted

    try:
        root = str(dist.locate_file(""))
    except Exception:
        return 0, 0

    if os.path.isfile(root):
        try:
            return os.path.getsize(root), 1
        except OSError:
            return 0, 0

    if not os.path.isdir(root):
        return 0, 0

    for directory, _subdirs, filenames in os.walk(root):
        for filename in filenames:
            path = os.path.join(directory, filename)
            try:
                total += os.path.getsize(path)
                counted += 1
            except OSError:
                continue

    return total, counted


def metadata_value(dist: "Distribution", key: str, default: str = "") -> str:
    try:
        value = dist.metadata[key]
    except Exception:
        return default
    return value if isinstance(value, str) and value else default


def requires_dist(dist: "Distribution") -> "list[str]":
    try:
        values = dist.metadata.get_all("Requires-Dist") or []
    except Exception:
        values = []
    if not values:
        try:
            values = dist.requires or []
        except Exception:
            values = []
    return [str(value) for value in values if value]


def install_location(dist: "Distribution") -> "tuple[str | None, bool]":
    """Return the install location and whether it is an editable install."""
    location = None
    try:
        location = os.path.dirname(str(dist.locate_file("")))
    except Exception:
        location = None

    editable = False
    try:
        direct_url = dist.read_text("direct_url.json")
        if direct_url:
            payload = json.loads(direct_url)
            editable = bool(payload.get("dir_info", {}).get("editable", False))
            if editable and payload.get("url", "").startswith("file://"):
                location = payload["url"][len("file://") :]
    except Exception:
        editable = False

    return location, editable


def collect(measure_sizes: bool, progress: bool) -> "dict[str, object]":
    dists = list(distributions())
    total = len(dists)
    packages = []

    if progress and total:
        sys.stderr.write("Reading metadata for %d distributions\n" % total)

    for index, dist in enumerate(dists, start=1):
        name = metadata_value(dist, "Name", "")
        if not name:
            continue

        size: "int | None" = None
        files: "int | None" = None
        if measure_sizes:
            size, files = distribution_size(dist)

        location, editable = install_location(dist)

        packages.append(
            {
                "name": name,
                "version": metadata_value(dist, "Version", ""),
                "size": size,
                "files": files,
                "requires": requires_dist(dist),
                "editable": editable,
                "location": location,
            }
        )

        if progress and sys.stderr.isatty():
            sys.stderr.write("\r  %d/%d  %-40.40s" % (index, total, name))

    if progress and sys.stderr.isatty():
        sys.stderr.write("\r" + " " * 60 + "\r")

    packages.sort(key=lambda package: package["name"].lower())

    return {
        "schema": SCHEMA,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "python": {
            "version": platform.python_version(),
            "implementation": platform.python_implementation(),
            "executable": sys.executable,
            "prefix": sys.prefix,
            "platform": platform.platform(),
            "in_virtualenv": sys.prefix != getattr(sys, "base_prefix", sys.prefix),
        },
        "packages": packages,
    }


def main(argv: "list[str] | None" = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pysan_collect",
        description="Collect installed-package metadata for analysis with PySan.",
    )
    parser.add_argument(
        "-o",
        "--output",
        metavar="PATH",
        help="write the report to PATH instead of stdout",
    )
    parser.add_argument(
        "--no-sizes",
        action="store_true",
        help="skip size measurement, which is the slow part on large environments",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        metavar="N",
        help="JSON indentation, 0 for a compact single line (default: 2)",
    )
    parser.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="suppress progress output on stderr",
    )
    args = parser.parse_args(argv)

    report = collect(measure_sizes=not args.no_sizes, progress=not args.quiet)
    packages = report["packages"]
    assert isinstance(packages, list)

    if not packages:
        sys.stderr.write("error: no distributions found for %s\n" % sys.executable)
        return 1

    indent = args.indent if args.indent > 0 else None
    payload = json.dumps(report, indent=indent, sort_keys=False)

    if args.output:
        destination = os.path.abspath(os.path.expanduser(args.output))
        parent = os.path.dirname(destination)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(destination, "w", encoding="utf-8") as handle:
            handle.write(payload)
            handle.write("\n")
        if not args.quiet:
            measured = sum(1 for p in packages if p.get("size"))
            sys.stderr.write(
                "Wrote %d packages to %s (%d measured)\n"
                % (len(packages), destination, measured)
            )
    else:
        sys.stdout.write(payload)
        sys.stdout.write("\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
