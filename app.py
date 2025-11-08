# ==========================================================================
# SECCIÓN 1: IMPORTACIONES ESENCIALES
# ==========================================================================
from flask import Flask, render_template

# (Hemos eliminado os, io, uuid, request, jsonify, pandas, geopandas, etc.)
# (ya que no se procesan archivos en esta versión limpia)

# ==========================================================================
# SECCIÓN 2: CONFIGURACIÓN BÁSICA DE LA APLICACIÓN
# ==========================================================================
app = Flask(__name__)
# El 'secret_key' no es estrictamente necesario para esta app simple, 
# pero es buena práctica mantenerlo.
app.config['SECRET_KEY'] = "a-static-secret-key-for-the-new-app"

# ==========================================================================
# SECCIÓN 3: RUTA PRINCIPAL DE LA APLICACIÓN
# ==========================================================================

@app.route('/')
def index():
    """
    Ruta principal que carga el visor de mapa limpio.
    """
    
    # Define las coordenadas y el zoom iniciales que se pasarán al template.
    # Puedes cambiar estos valores (Ej: centro de Madrid, España)
    START_LAT = 41.3874
    START_LON = 2.1686
    START_ZOOM = 12


    # Renderiza el template 'index.html' y le inyecta las variables
    return render_template(
        'index.html', 
        start_lat=START_LAT, 
        start_lon=START_LON, 
        start_zoom=START_ZOOM
    )

# ==========================================================================
# SECCIÓN 4: INICIAR LA APLICACIÓN
# ==========================================================================
if __name__ == '__main__':
    app.run(debug=True)