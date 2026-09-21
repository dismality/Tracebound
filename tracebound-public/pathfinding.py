"""Framework-independent search engine for Tracebound.

Every algorithm returns the same event vocabulary so the browser can animate the
search without knowing how the algorithm works.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from heapq import heappop, heappush
from itertools import count
from time import perf_counter
from typing import Iterable


Position = tuple[int, int]


@dataclass(frozen=True)
class SearchProblem:
    grid: tuple[tuple[str, ...], ...]
    start: Position
    goal: Position
    terrain_cost: int = 5

    @property
    def rows(self) -> int:
        return len(self.grid)

    @property
    def cols(self) -> int:
        return len(self.grid[0])

    def neighbors(self, position: Position) -> Iterable[Position]:
        row, col = position
        for next_position in ((row - 1, col), (row, col + 1), (row + 1, col), (row, col - 1)):
            next_row, next_col = next_position
            if 0 <= next_row < self.rows and 0 <= next_col < self.cols:
                if self.grid[next_row][next_col] != "wall":
                    yield next_position

    def cost(self, position: Position) -> int:
        row, col = position
        return self.terrain_cost if self.grid[row][col] == "weight" else 1


def manhattan(a: Position, b: Position) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def event(position: Position, kind: str, g: int, goal: Position, reason: str) -> dict:
    return {
        "r": position[0],
        "c": position[1],
        "kind": kind,
        "g": g,
        "h": manhattan(position, goal),
        "reason": reason,
    }


def reconstruct(parent: dict[Position, Position | None], end: Position) -> list[Position]:
    path: list[Position] = []
    current: Position | None = end
    while current is not None:
        path.append(current)
        current = parent[current]
    return list(reversed(path))


def serialize_path(path: list[Position]) -> list[dict[str, int]]:
    return [{"r": row, "c": col} for row, col in path]


def finish(problem: SearchProblem, events: list[dict], path: list[Position], expanded: int,
           max_frontier: int, started_at: float, weighted: bool) -> dict:
    path_cost = None
    if path:
        # Report the route's real terrain cost even when the algorithm itself
        # ignores weights. That makes cross-algorithm comparisons honest.
        path_cost = sum(problem.cost(position) for position in path[1:])
    return {
        "events": events,
        "path": serialize_path(path),
        "found": bool(path),
        "expanded": expanded,
        "maxFrontier": max_frontier,
        "pathLength": len(path) - 1 if path else None,
        "pathCost": path_cost,
        "runtime": (perf_counter() - started_at) * 1000,
    }


def uninformed(problem: SearchProblem, depth_first: bool = False) -> dict:
    started_at = perf_counter()
    frontier = deque([problem.start])
    parent: dict[Position, Position | None] = {problem.start: None}
    distance = {problem.start: 0}
    visited: set[Position] = set()
    events: list[dict] = []
    max_frontier = 1

    while frontier:
        current = frontier.pop() if depth_first else frontier.popleft()
        if current in visited:
            continue
        visited.add(current)
        structure = "stack" if depth_first else "queue"
        events.append(event(current, "visited", distance[current], problem.goal,
                            f"Expanded because it was next in the {structure}."))
        if current == problem.goal:
            return finish(problem, events, reconstruct(parent, current), len(visited),
                          max_frontier, started_at, weighted=False)
        next_positions = list(problem.neighbors(current))
        if depth_first:
            next_positions.reverse()
        for next_position in next_positions:
            if next_position not in parent:
                parent[next_position] = current
                distance[next_position] = distance[current] + 1
                frontier.append(next_position)
                row, col = current
                events.append(event(next_position, "frontier", distance[next_position], problem.goal,
                                    f"Discovered from row {row + 1}, column {col + 1}."))
        max_frontier = max(max_frontier, len(frontier))

    return finish(problem, events, [], len(visited), max_frontier, started_at, weighted=False)


def priority_search(problem: SearchProblem, strategy: str) -> dict:
    started_at = perf_counter()
    serial = count()
    frontier: list[tuple[int, int, Position]] = []
    heappush(frontier, (0, next(serial), problem.start))
    parent: dict[Position, Position | None] = {problem.start: None}
    best = {problem.start: 0}
    visited: set[Position] = set()
    events: list[dict] = []
    max_frontier = 1

    while frontier:
        _, _, current = heappop(frontier)
        if current in visited:
            continue
        visited.add(current)
        current_cost = best[current]
        events.append(event(current, "visited", current_cost, problem.goal,
                            "Expanded because it had the lowest current priority."))
        if current == problem.goal:
            weighted = strategy in {"astar", "dijkstra"}
            return finish(problem, events, reconstruct(parent, current), len(visited),
                          max_frontier, started_at, weighted=weighted)
        for next_position in problem.neighbors(current):
            weighted = strategy in {"astar", "dijkstra"}
            next_cost = current_cost + (problem.cost(next_position) if weighted else 1)
            if next_cost >= best.get(next_position, 10**12):
                continue
            best[next_position] = next_cost
            parent[next_position] = current
            estimate = manhattan(next_position, problem.goal)
            if strategy == "dijkstra":
                priority = next_cost
            elif strategy == "astar":
                priority = next_cost + estimate
            else:
                priority = estimate
            heappush(frontier, (priority, next(serial), next_position))
            reason = (f"Added with terrain cost {problem.cost(next_position)}."
                      if weighted and problem.cost(next_position) > 1
                      else f"Added with priority {priority}.")
            events.append(event(next_position, "frontier", next_cost, problem.goal, reason))
        max_frontier = max(max_frontier, len(frontier))

    return finish(problem, events, [], len(visited), max_frontier, started_at,
                  weighted=strategy in {"astar", "dijkstra"})


def bidirectional(problem: SearchProblem) -> dict:
    started_at = perf_counter()
    forward = deque([problem.start])
    backward = deque([problem.goal])
    forward_parent: dict[Position, Position | None] = {problem.start: None}
    backward_parent: dict[Position, Position | None] = {problem.goal: None}
    events: list[dict] = []
    max_frontier = 2
    expanded: set[Position] = set()

    def expand(queue: deque[Position], own: dict[Position, Position | None],
               other: dict[Position, Position | None], side: str) -> Position | None:
        current = queue.popleft()
        expanded.add(current)
        events.append(event(current, "visited", 0, problem.goal, f"Expanded from the {side} side."))
        if current in other:
            return current
        for next_position in problem.neighbors(current):
            if next_position not in own:
                own[next_position] = current
                queue.append(next_position)
                events.append(event(next_position, "frontier", 0, problem.goal,
                                    f"Added to the {side} frontier."))
                if next_position in other:
                    return next_position
        return None

    meeting: Position | None = None
    while forward and backward and meeting is None:
        meeting = expand(forward, forward_parent, backward_parent, "start")
        if meeting is None:
            meeting = expand(backward, backward_parent, forward_parent, "goal")
        max_frontier = max(max_frontier, len(forward) + len(backward))

    path: list[Position] = []
    if meeting is not None:
        path = reconstruct(forward_parent, meeting)
        current = backward_parent[meeting]
        while current is not None:
            path.append(current)
            current = backward_parent[current]
    return finish(problem, events, path, len(expanded), max_frontier, started_at, weighted=False)


def search(problem: SearchProblem, algorithm: str) -> dict:
    if algorithm == "bfs":
        return uninformed(problem)
    if algorithm == "dfs":
        return uninformed(problem, depth_first=True)
    if algorithm in {"dijkstra", "astar", "greedy"}:
        return priority_search(problem, algorithm)
    if algorithm == "bidirectional":
        return bidirectional(problem)
    raise ValueError(f"Unknown algorithm: {algorithm}")
