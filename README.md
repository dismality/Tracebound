# Tracebound

Tracebound is an interactive pathfinding game and search-algorithm laboratory. It lets learners design a grid, add walls and weighted terrain, inspect algorithm state step by step, and compare strategies on an identical scenario.

## Search strategies

- Breadth-First Search
- Depth-First Search
- Greedy Best-First Search
- Dijkstra's algorithm
- A* Search
- Bidirectional BFS

## Architecture

The Python engine in `pathfinding.py` is independent from Flask and emits a shared event format for every algorithm. `app.py` exposes those events through a small JSON API. The browser code draws and animates the events without implementing the Python search logic.

For the static hosted showcase, the browser includes an equivalent local fallback so the game remains playable without a Python process. Local development uses the Flask API as the authoritative engine.

## Run locally

```bash
python -m pip install -r requirements.txt
python app.py
```

Then open `http://127.0.0.1:4173`.

## Verify correctness

```bash
python -m unittest -v test_pathfinding.py
```
