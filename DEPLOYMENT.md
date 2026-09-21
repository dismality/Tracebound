# Publish Tracebound

This bundle is prepared for a public Python deployment on Render.

## Test locally

1. Install Python 3.11 or newer.
2. Open a terminal in this folder.
3. Run `python -m pip install -r requirements.txt`.
4. Run `python app.py`.
5. Visit `http://127.0.0.1:4173`.
6. Run `python -m unittest -v test_pathfinding.py` to verify the algorithms.

## Put the source on GitHub

1. Create an empty GitHub repository.
2. Extract this ZIP before uploading it.
3. Upload the contents of the extracted `tracebound-public` folder to the repository root.
4. Confirm that `app.py`, `requirements.txt`, `render.yaml`, and the `dist` folder appear at the top level.

## Deploy publicly with Render

1. Sign in to Render and connect your GitHub account.
2. Choose **New → Blueprint**.
3. Select the GitHub repository containing Tracebound.
4. Render will read `render.yaml` and display the Tracebound web service.
5. Review the free plan selection and choose **Deploy Blueprint**.
6. Wait for the deployment to finish, then open the generated `onrender.com` address.

Every later push to the connected GitHub branch triggers a new deployment automatically.

## Manual Render settings

If you create a Web Service instead of using the Blueprint, use:

- Language: Python 3
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`
- Health check path: `/`

## Confirm the Python backend is live

Open the browser developer tools, run an algorithm, and inspect the Network panel. A request to `POST /api/search` should return status `200` and JSON. That confirms the browser is using the deployed Flask and Python search engine instead of the JavaScript fallback.
