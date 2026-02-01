"""Aggregation functions for player analytics (stdlib only)."""

from typing import Any


def compute_path_stats(entries: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Compute path statistics from logged events.

    Args:
        entries: Array of log entries

    Returns:
        Dict with totalChoices, uniqueSessions, pathDistribution
    """
    choices = [e for e in entries if e.get("type") == "choice"]

    # Group by knotPath -> choiceIndex -> { count, text }
    by_path: dict[str, dict[int, dict[str, Any]]] = {}
    sessions: set[str] = set()

    for c in choices:
        sessions.add(c.get("sessionId", ""))

        payload = c.get("payload") or {}
        path = payload.get("knotPath", "unknown")
        choice_index = payload.get("choiceIndex", -1)

        if path not in by_path:
            by_path[path] = {}
        if choice_index not in by_path[path]:
            by_path[path][choice_index] = {
                "count": 0,
                "text": payload.get("choiceText", ""),
            }
        by_path[path][choice_index]["count"] += 1

    # Convert int keys to strings for JSON compatibility
    path_distribution = {
        path: {str(idx): data for idx, data in choices_map.items()}
        for path, choices_map in by_path.items()
    }

    return {
        "totalChoices": len(choices),
        "uniqueSessions": len(sessions),
        "pathDistribution": path_distribution,
    }


def compute_session_summaries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Compute session summaries.

    Args:
        entries: Array of log entries

    Returns:
        List of session summaries
    """
    sessions: dict[str, dict[str, Any]] = {}

    for entry in entries:
        sid = entry.get("sessionId", "")
        timestamp = entry.get("timestamp", 0)

        if sid not in sessions:
            sessions[sid] = {
                "sessionId": sid,
                "startTime": timestamp,
                "endTime": timestamp,
                "choiceCount": 0,
                "paths": set(),
            }

        s = sessions[sid]
        s["startTime"] = min(s["startTime"], timestamp)
        s["endTime"] = max(s["endTime"], timestamp)

        if entry.get("type") == "choice":
            s["choiceCount"] += 1
            payload = entry.get("payload") or {}
            knot_path = payload.get("knotPath")
            if knot_path:
                s["paths"].add(knot_path)

    return [
        {
            "sessionId": s["sessionId"],
            "startTime": s["startTime"],
            "endTime": s["endTime"],
            "choiceCount": s["choiceCount"],
            "paths": list(s["paths"]),
            "durationMs": s["endTime"] - s["startTime"],
        }
        for s in sessions.values()
    ]


def top_paths(entries: list[dict[str, Any]], limit: int = 10) -> list[dict[str, Any]]:
    """
    Find most common choice paths.

    Args:
        entries: Array of log entries
        limit: Number of top paths to return

    Returns:
        Top paths by frequency
    """
    choices = [e for e in entries if e.get("type") == "choice"]
    path_counts: dict[str, int] = {}

    for c in choices:
        payload = c.get("payload") or {}
        path = payload.get("knotPath", "unknown")
        path_counts[path] = path_counts.get(path, 0) + 1

    sorted_paths = sorted(path_counts.items(), key=lambda x: x[1], reverse=True)

    return [{"path": path, "count": count} for path, count in sorted_paths[:limit]]


def compute_choice_stats(
    entries: list[dict[str, Any]], choice_ids: list[str]
) -> dict[str, Any]:
    """
    Compute statistics for specific choice IDs (Telltale-style).

    Choice ID format: "knotName:choiceIndex" (e.g., "interrogation:0")

    Args:
        entries: Array of log entries
        choice_ids: List of choice IDs to query

    Returns:
        Dict with choices mapping to total and percentage
    """
    choices = [e for e in entries if e.get("type") == "choice"]

    # Count totals per knot for percentage calculation
    knot_totals: dict[str, int] = {}
    choice_counts: dict[str, dict[str, Any]] = {}

    for c in choices:
        payload = c.get("payload") or {}
        context = c.get("context") or {}
        knot = payload.get("knotPath") or context.get("knot") or "unknown"
        idx = payload.get("choiceIndex", -1)
        key = f"{knot}:{idx}"

        # Count per knot
        knot_totals[knot] = knot_totals.get(knot, 0) + 1

        # Count per choice
        if key not in choice_counts:
            choice_counts[key] = {"count": 0, "knot": knot}
        choice_counts[key]["count"] += 1

    # Build response for requested choice IDs
    result: dict[str, dict[str, int]] = {}
    for choice_id in choice_ids:
        knot = choice_id.split(":")[0] if ":" in choice_id else choice_id
        data = choice_counts.get(choice_id)

        if data:
            total = knot_totals.get(knot, 1)
            result[choice_id] = {
                "total": data["count"],
                "percentage": round((data["count"] / total) * 100),
            }
        else:
            result[choice_id] = {"total": 0, "percentage": 0}

    return {"choices": result}
