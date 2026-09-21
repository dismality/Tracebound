from __future__ import annotations

from flask import Flask, jsonify, request

from pathfinding import SearchProblem, search


app = Flask(__name__, static_folder="dist", static_url_path="")


@app.get("/")
def index():
    return app.send_static_file("index.html")


@app.post("/api/search")
def api_search():
    payload = request.get_json(silent=True) or {}
    try:
        algorithm = str(payload["algorithm"])
        raw_grid = payload["grid"]
        grid = tuple(tuple(str(cell) for cell in row) for row in raw_grid)
        start = (int(payload["start"]["r"]), int(payload["start"]["c"]))
        goal = (int(payload["goal"]["r"]), int(payload["goal"]["c"]))
        terrain_cost = max(1, min(100, int(payload.get("terrainCost", 5))))
        if not grid or not grid[0] or any(len(row) != len(grid[0]) for row in grid):
            raise ValueError("The grid must be rectangular.")
        if len(grid) > 100 or len(grid[0]) > 100:
            raise ValueError("The grid is too large.")
        if not (0 <= start[0] < len(grid) and 0 <= start[1] < len(grid[0])):
            raise ValueError("The start is outside the grid.")
        if not (0 <= goal[0] < len(grid) and 0 <= goal[1] < len(grid[0])):
            raise ValueError("The goal is outside the grid.")
        return jsonify(search(SearchProblem(grid=grid, start=start, goal=goal, terrain_cost=terrain_cost), algorithm))
    except (KeyError, TypeError, ValueError) as error:
        return jsonify({"error": str(error)}), 400


if __name__ == "__main__":
    app.run(debug=True, port=4173)
