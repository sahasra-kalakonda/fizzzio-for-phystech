# Fizzzio

#### Video Demo: <https://www.youtube.com/watch?v=dgn19WHoI4M>

Fizzzio is a fitness tracking app that watches how you move, not just how much. Log workouts, stretches, and casual movement against a personal streak and weekly goals, and get real-time form feedback from **Fizz Coach** ~ an on-device AI posture guide that uses your webcam to check squat depth, hip alignment, and core stability and tells you what to fix in the moment. It's a full-stack app with a vanilla JavaScript frontend and a Flask/SQLite backend.

## Getting Started

These instructions will guide you on how to set up and run Fizzzio locally for development and testing purposes.

### Prerequisites

To run Fizzzio, you will need:

* Python 3.10+ and pip for the backend
* A modern browser with webcam access for the Posture AI Guide (no Node.js or build step needed ~ the frontend is plain HTML/CSS/JS)

### Installing

Follow these steps to get your development environment running:

#### Backend
 
1. Clone the repository and navigate to the backend directory:
```
cd backend
```
 
2. Create and activate a virtual environment:
```
python -m venv venv
source venv/bin/activate        # macOS / Linux
.\venv\Scripts\activate         # Windows
```
 
3. Install dependencies:
```
pip install -r requirements.txt
```
 
4. Start the Flask backend:
```
python app.py
```
 
This starts the API on `http://localhost:5000`.
 
#### Frontend
 
1. `index.html` hardcodes the production API URL on this line:
```html
window.FIZZZIO_API_BASE = 'https://fizzzio-backend-zym7.onrender.com/api';
```
 
For local development, comment this line out (or delete it) so the frontend falls back to `api.js`'s default of `http://localhost:5000/api` and talks to your local backend instead of the deployed one on Render:
 
```html
<!-- window.FIZZZIO_API_BASE = 'https://fizzzio-backend-zym7.onrender.com/api'; -->
```
 
Remember to restore it before deploying again.
 
2. From the project root, start the local static file server:
```
python server.py
```
 
3. Open `http://localhost:8080` in your browser.
Make sure the backend (step above) is running at the same time, since the frontend has no functionality without it.
 
## Configuration
 
Fizzzio's backend reads its configuration from environment variables (see `render.yaml` for the production values used on Render):
 
```
FIZZZIO_SECRET_KEY=your_secret_key_here     # signs session cookies — required
FIZZZIO_HTTPS=0                             # set to "1" in production for Secure cookies
FIZZZIO_ALLOWED_ORIGINS=http://localhost:8080  # comma-separated CORS allow-list
```
 
For local development, `FIZZZIO_HTTPS=0` keeps cookies working over plain HTTP. In production, the frontend and backend live on different origins (Netlify and Render), so `FIZZZIO_HTTPS=1` and `SameSite=None; Secure` cookies are required for the session to cross origins.
 
No external API keys are needed — posture detection runs entirely on-device.
 
## Live App
 
* **Frontend:** <https://dulcet-fairy-d1c5f7.netlify.app/>
* **Backend API:** <https://fizzzio-backend-zym7.onrender.com/api>

## Built With

* **Frontend:** Vanilla JavaScript (ES modules), HTML5, CSS3 — no framework or build tool
* **Charts:** Hand-written Canvas API rendering with Bézier curve math
* **AI / Computer Vision:** Google MediaPipe Tasks-Vision ~ Pose Landmarker (BlazePose), running on-device via WebAssembly
* **Backend:** Flask, Werkzeug, Gunicorn (Python)
* **Database:** SQLite
* **Fonts:** Google Fonts (Inter)
* **Infrastructure & Hosting:** Render (backend, deployed via `render.yaml` Blueprint), Netlify (frontend)

## Contributing

If you're interested in contributing to Fizzzio, please read through the project files and reach out to the team to see how you can help.

## Main Authors

* [sahasra-kalakonda Sahasra Kalakonda](https://github.com/sahasra-kalakonda)
* [tanvi-s-a](https://github.com/tanvi-s-a)
* [Striderzimmerman-wq](https://github.com/Striderzimmerman-wq)

## Acknowledgments

* Thanks to Google for the MediaPipe Pose Landmarker model powering Fizz Coach.
* Thanks to the open-source contributors behind Flask and MediaPipe.
