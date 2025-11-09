from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import uvicorn

import pandas as pd
import os
from dotenv import load_dotenv

# 🔹 Nou: dependències per al chatbot
import requests
from pydantic import BaseModel

load_dotenv()

MAPTILER_API_KEY = os.getenv("MAPTILER_API_KEY")
if not MAPTILER_API_KEY:
    print("ALERTA: No s'ha trobat la MAPTILER_API_KEY al fitxer .env.")
    MAPTILER_API_KEY = ""

# 🔹 Nou: API KEY PublicAI per al chatbot
PUBLICAI_API_KEY = os.getenv("PUBLICAI_API_KEY")
if not PUBLICAI_API_KEY:
    print("ALERTA: No s'ha trobat PUBLICAI_API_KEY al .env. L'endpoint /chat no funcionarà.")

PUBLICAI_BASE_URL = "https://api.publicai.co/v1/chat/completions"
PUBLICAI_MODEL = "BSC-LT/salamandra-7b-instruct-tools-16k"

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

START_LAT = 41.3874
START_LON = 2.1686
START_ZOOM = 12


def process_data():
    df = pd.read_csv("static/data/estacions.csv")

    # Tipus
    df["DATA"] = pd.to_datetime(df["DATA"], errors="coerce")
    df["PERSONA"] = pd.to_numeric(df["PERSONA"], errors="coerce")
    df["lon"] = pd.to_numeric(df["lon"], errors="coerce")
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")

    # Neteja mínima
    df = df.dropna(subset=["NOM_ESTACIO", "PERSONA", "lon", "lat"]).reset_index(drop=True)

    # Línies des de PICTO (L1, L3, L9S...)
    df["PICTO"] = df["PICTO"].fillna("").astype(str)
    df["LINIES"] = df["PICTO"].str.findall(r"L\d+S?")
    df["LINIES"] = df["LINIES"].apply(lambda xs: xs if xs and len(xs) > 0 else [])

    # Explosió línies per càlcul de mètriques
    df_linies = df.explode("LINIES").rename(columns={"LINIES": "LINIA"})
    df_linies = df_linies[df_linies["LINIA"].notna() & (df_linies["LINIA"] != "")]
    df_linies = df_linies.reset_index(drop=True)

    all_lines = sorted(df_linies["LINIA"].unique().tolist())

    # Top 10 estacions per volum total
    top_estacions = (
        df.groupby("NOM_ESTACIO")
        .agg(total_persones=("PERSONA", "sum"))
        .sort_values("total_persones", ascending=False)
        .head(10)
        .reset_index()
    )

    # Intercanviadors: estacions amb més d'una línia
    intercanviadors = (
        df.groupby("NOM_ESTACIO")
        .agg(
            total_persones=("PERSONA", "sum"),
            linies=("LINIES", lambda x: sorted(set(l for sub in x for l in sub)))
        )
        .reset_index()
    )

    intercanviadors["num_linies"] = intercanviadors["linies"].apply(len)
    intercanviadors = intercanviadors[intercanviadors["num_linies"] > 1].copy()
    intercanviadors["linies"] = intercanviadors["linies"].apply(lambda xs: ", ".join(xs))
    intercanviadors = intercanviadors.sort_values("total_persones", ascending=False).reset_index(drop=True)

    return df, df_linies, all_lines, top_estacions, intercanviadors


def compute_line_metrics(df_linies: pd.DataFrame) -> pd.DataFrame:
    line_stats = (
        df_linies
        .groupby("LINIA")
        .agg(
            num_parades=("NOM_ESTACIO", "nunique"),
            total_persones=("PERSONA", "sum"),
        )
        .reset_index()
    )

    line_stats["mitjana_per_parada"] = (
        line_stats["total_persones"] / line_stats["num_parades"]
    )

    return line_stats.sort_values("total_persones", ascending=False)


# Pre-càlcul global
DF, DF_LINIES, ALL_LINES, TOP_ESTACIONS_DF, INTERCANVIADORS_DF = process_data()
LINE_STATS_DF = compute_line_metrics(DF_LINIES)

# KPIs globals
TOTAL_PASSATGERS = int(DF["PERSONA"].sum())
MITJANA_PASSATGERS = float(DF["PERSONA"].mean())
NUM_ESTACIONS = int(DF["NOM_ESTACIO"].nunique())
NUM_LINIES = len(ALL_LINES)

# Per Jinja
LINE_STATS = LINE_STATS_DF.to_dict(orient="records")
TOP_ESTACIONS = TOP_ESTACIONS_DF.to_dict(orient="records")
INTERCANVIADORS = INTERCANVIADORS_DF.to_dict(orient="records")

# Nou: CSV com a context per al chatbot
# Si és molt gran, el limitem una mica per no rebentar tokens.
CSV_FOR_BOT = DF.to_csv(index=False)

# Opcional: si vols ser paranoic amb el límit de tokens:
MAX_CHARS = 15000
if len(CSV_FOR_BOT) > MAX_CHARS:
    # Mostra totes les columnes però només una mostra d’estacions
    CSV_FOR_BOT = DF.sample(n=min(len(DF), 200), random_state=42).to_csv(index=False)


# =========================
# RUTES EXISTENTS
# =========================

@app.get("/")
def index(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "start_lat": START_LAT,
            "start_lon": START_LON,
            "start_zoom": START_ZOOM,
            "maptiler_api_key": MAPTILER_API_KEY,
        },
    )


@app.get("/map")
def map_view(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "start_lat": START_LAT,
            "start_lon": START_LON,
            "start_zoom": START_ZOOM,
            "maptiler_api_key": MAPTILER_API_KEY,
        },
    )


@app.get("/ampliacions")
def ampliacions_view(request: Request):
    return templates.TemplateResponse(
        "ampliacions.html",
        {
            "request": request,
        },
    )


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard_view(request: Request):
    line_labels = [row["LINIA"] for row in LINE_STATS]
    line_totals = [int(row["total_persones"]) for row in LINE_STATS]

    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "total_passatgers": TOTAL_PASSATGERS,
            "mitjana_passatgers": MITJANA_PASSATGERS,
            "num_estacions": NUM_ESTACIONS,
            "num_linies": NUM_LINIES,
            "line_stats": LINE_STATS,
            "line_labels": line_labels,
            "line_totals": line_totals,
            "top_estacions": TOP_ESTACIONS,
            "intercanviadors": INTERCANVIADORS,
        },
    )


# =========================
# 🔹 PART NOVA: CHATBOT
# =========================

class ChatRequest(BaseModel):
    message: str
    history: list[dict] | None = None  # [{ "role": "user"/"assistant", "content": "..." }]


def ask_salamandra(messages, max_tokens: int = 512, temperature: float = 0.7) -> str:
    """
    Envia els missatges directament al model Salamandra via PublicAI.
    'messages' ha de ser una llista amb rols: system / user / assistant.
    """
    if not PUBLICAI_API_KEY:
        return "Error de configuració: falta la PUBLICAI_API_KEY al servidor."

    headers = {
        "Authorization": f"Bearer {PUBLICAI_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "UAB-THE-HACK/1.0",
    }

    payload = {
        "model": PUBLICAI_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    try:
        resp = requests.post(PUBLICAI_BASE_URL, headers=headers, json=payload, timeout=30)

        if resp.status_code == 200:
            data = resp.json()
            return data["choices"][0]["message"]["content"]

        # Debug útil al terminal
        print("PublicAI ERROR:", resp.status_code, resp.text)

        if resp.status_code == 401:
            return "❌ Error: API key invàlida o no autoritzada."
        if resp.status_code == 429:
            return "⚠️ Límit d'ús assolit per aquesta API key. Redueix peticions o fes servir una clau diferent."
        return f"❌ Error {resp.status_code}: {resp.text[:200]}"

    except requests.exceptions.Timeout:
        return "⏱️ Timeout: el model triga massa a respondre."
    except Exception as e:
        print("Error amb PublicAI:", e)
        return "Hi ha hagut un error en comunicar amb el model."

@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    """
    Endpoint REST perquè el front demani respostes del chatbot.
    Construeix un 'messages' vàlid per PublicAI:
    - Primer 'system' amb el CSV
    - Historial alternant rols (user/assistant), fusionant consecutius
    - Finalment el missatge actual com a 'user' (fusionat si cal)
    """

    system_prompt = (
        "Ets l'assistent SmartMetro, un xatbot especialitzat en la xarxa de metro de Barcelona. "
        "Respon SEMPRE en català i en llenguatge natural, amb un to clar, entenedor i informatiu.\n\n"
        " DADES I CONTEXT DISPONIBLES:\n"
        "1️ Xarxa actual de metro de Barcelona (provinent del fitxer estacions.csv del projecte SmartMetro):\n"
        "- Cada estació conté: NOM_ESTACIO, DATA, PERSONA (nombre de passatgers registrats), PICTO (línies associades), "
        "i coordenades lon/lat.\n"
        "- Pots deduir quines són les estacions més transitades, els principals intercanviadors i el volum de persones per línia.\n"
        "- Les línies actuals inclouen: L1, L2, L3, L4, L5, L9S, L10S, entre altres.\n\n"
        "2️ Nova Línia 12 (fitxer actualitzat 'L12.geojson'):\n"
        "- Representa una línia de metro **projectada pel projecte SmartMetro**, anomenada 'Línia 12' o 'L12'.\n"
        "- El recorregut real proposat comença a l’estació **Marina** (enllaç amb L1) i avança cap a **El Clot**, "
        "segueix per **Virrei Amat** i **La Sagrera**, travessa cap a **Cerdanyola**, i finalitza a la Universitat Autònoma de Barcelona, "
        "amb dues estacions universitàries: **UAB Renfe** i **UAB SAF**.\n"
        "- Té un paper estratègic, ja que connecta el centre de Barcelona amb el campus universitari de la UAB "
        "i amb la zona nord metropolitana, millorant la connexió directa entre zones residencials i educatives.\n"
        "- Enllaços clau amb altres línies:\n"
        "   · L1 a Marina\n"
        "   · L2 i L5 a El Clot\n"
        "   · L5 i L9 a La Sagrera\n"
        "   · Rodalies a Cerdanyola i UAB Renfe\n"
        "- Objectius principals:\n"
        "   · Oferir un eix de connexió directe entre Barcelona i la UAB.\n"
        "   · Descongestionar línies centrals (L1 i L3).\n"
        "   · Reduir temps de desplaçament entre la ciutat i el campus.\n"
        "   · Potenciar l’ús del transport públic per a estudiants i treballadors de la UAB.\n\n"
        "3️ Ampliació de la L1 cap a Badalona (fitxer 'ampliacio_l1.geojson'):\n"
        "- Aquesta ampliació allarga la L1 des del seu tram final a **Fondo** fins a noves estacions dins del municipi de **Badalona**.\n"
        "- El traçat projectat va aproximadament des de lon 2.2209, lat 41.4524 fins a lon 2.2585, lat 41.4546.\n"
        "- Objectius:\n"
        "   · Millorar la cobertura territorial al Barcelonès Nord.\n"
        "   · Afavorir la connexió amb altres línies (L2, L9 Nord) i nous intercanviadors.\n"
        "   · Reduir la dependència de trajectes per carretera i millorar l’accessibilitat de la població de Badalona.\n\n"
        " OBJECTIU DE L’ASSISTENT:\n"
        "- Ajudar l’usuari a comprendre i explorar la xarxa de metro de Barcelona combinant:\n"
        "  · La xarxa actual (segons les dades del CSV d’estacions i línies).\n"
        "  · La línia dissenyada L12 (de Marina a UAB SAF).\n"
        "  · L’ampliació de la L1 cap a Badalona.\n"
        "- Millorar l’experiència d’usuari i l’accessibilitat a la informació, responent preguntes com:\n"
        "  · Quina és l’estació més transitada?\n"
        "  · On hi ha intercanviadors?\n"
        "  · Quina línia transporta més passatgers?\n"
        "  · Quines noves connexions aporta la L12?\n"
        "  · Com beneficia la L1 ampliada la zona de Badalona?\n"
        "  · Quin recorregut permet arribar a la UAB amb metro?\n\n"
        " INSTRUCCIONS DE COMPORTAMENT:\n"
        "- Respon sempre en català i amb un to proper però precís.\n"
        "- Basat en les dades, pots parlar d’estacions, línies i ampliacions del projecte.\n"
        "- Quan parlis de la L12 o l’ampliació de la L1, recorda que són **propostes del projecte SmartMetro**: "
        "descriu-ne la seva utilitat i impacte positiu sobre la mobilitat.\n"
        "- No inventis dades concretes (horaris, freqüències, temps de viatge) si no existeixen. "
        "Si l’usuari pregunta per informació inexistent, indica-ho amb claredat i dona una resposta conceptual o qualitativa.\n"
        "- Si l’usuari demana com arribar d’un punt a un altre, pots descriure un recorregut orientatiu fent servir les línies existents "
        "i la L12 o l’ampliació de la L1, especificant que és una simulació basada en el model SmartMetro.\n"
    )


    messages = [
        {"role": "system", "content": system_prompt}
    ]

    last_role = "system"

    # 1) Netegem i afegim historial, garantint que no hi ha rols consecutius iguals
    if req.history:
        for m in req.history:
            role = m.get("role")
            content = (m.get("content") or "").strip()
            if role not in ("user", "assistant") or not content:
                continue

            if role == last_role:
                # Si hi ha dos del mateix rol seguits, els unim
                messages[-1]["content"] += "\n" + content
            else:
                messages.append({"role": role, "content": content})
                last_role = role

    # 2) Afegim el missatge actual com a 'user'
    new_content = (req.message or "").strip()
    if new_content:
        if last_role == "user":
            # Evitem dos 'user' seguits: unim el nou amb l'últim
            messages[-1]["content"] += "\n" + new_content
        else:
            messages.append({"role": "user", "content": new_content})

    reply = ask_salamandra(messages)
    return {"reply": reply}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
