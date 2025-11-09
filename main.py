from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi import Form, Request
from fastapi.responses import RedirectResponse
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()
MAPTILER_API_KEY = os.getenv("MAPTILER_API_KEY")

if not MAPTILER_API_KEY:
    print("ALERTA: No s'ha trobat la MAPTILER_API_KEY al fitxer .env.")
    MAPTILER_API_KEY = ""

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

START_LAT = 41.3874
START_LON = 2.1686
START_ZOOM = 12

@app.get("/")
def index(request: Request):

    return templates.TemplateResponse("index.html", {
        "request": request,
        "start_lat": START_LAT,
        "start_lon": START_LON,
        "start_zoom": START_ZOOM,
        "maptiler_api_key": MAPTILER_API_KEY
    })


@app.get("/ampliacions")
def map_view(request: Request):

    return templates.TemplateResponse("ampliacions.html", {
        "request": request
    }) 


@app.get("/dashboard")
def dashboard_view(request: Request):

    return templates.TemplateResponse("dashboard.html", {
        "request": request
    })


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)