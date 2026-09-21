import unittest

from pathfinding import SearchProblem, search


class PathfindingTests(unittest.TestCase):
    def test_bfs_returns_shortest_unweighted_path(self):
        problem = SearchProblem(
            grid=(("empty", "empty", "empty"), ("wall", "wall", "empty"), ("empty", "empty", "empty")),
            start=(0, 0), goal=(2, 2)
        )
        self.assertEqual(search(problem, "bfs")["pathLength"], 4)

    def test_astar_and_dijkstra_agree_on_weighted_cost(self):
        problem = SearchProblem(
            grid=(("empty", "weight", "empty"), ("empty", "empty", "empty")),
            start=(0, 0), goal=(0, 2)
        )
        self.assertEqual(search(problem, "astar")["pathCost"], 4)
        self.assertEqual(search(problem, "astar")["pathCost"], search(problem, "dijkstra")["pathCost"])

    def test_unreachable_goal_returns_cleanly(self):
        problem = SearchProblem(
            grid=(("empty", "wall", "empty"), ("empty", "wall", "empty")),
            start=(0, 0), goal=(0, 2)
        )
        self.assertFalse(search(problem, "bfs")["found"])

    def test_bfs_reports_real_cost_even_though_it_ignores_weights(self):
        problem = SearchProblem(
            grid=(("empty", "weight", "empty"),),
            start=(0, 0), goal=(0, 2)
        )
        result = search(problem, "bfs")
        self.assertEqual(result["pathLength"], 2)
        self.assertEqual(result["pathCost"], 6)

    def test_objective_can_change_weighted_terrain_cost(self):
        problem = SearchProblem(
            grid=(("empty", "weight", "empty"),),
            start=(0, 0), goal=(0, 2), terrain_cost=10
        )
        self.assertEqual(search(problem, "dijkstra")["pathCost"], 11)

    def test_all_returned_path_cells_are_traversable(self):
        grid = (("empty", "wall", "empty"), ("empty", "empty", "empty"))
        problem = SearchProblem(grid=grid, start=(0, 0), goal=(0, 2))
        for algorithm in ("bfs", "dfs", "greedy", "dijkstra", "astar", "bidirectional"):
            result = search(problem, algorithm)
            self.assertTrue(result["found"])
            self.assertTrue(all(grid[cell["r"]][cell["c"]] != "wall" for cell in result["path"]))


if __name__ == "__main__":
    unittest.main()
