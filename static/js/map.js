// ==================================================================
// SECCIÓN 1: VARIABLES Y CONFIGURACIÓN
// ==================================================================
let map;

// Las variables START_LON, START_LAT, y START_ZOOM
// se toman del index.html (inyectadas por Flask).

// Definición de las fuentes de mapas base
const baseMaps = {
    'osm': { 
        type: 'raster', 
        tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'], 
        tileSize: 256, 
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' 
    },
    'esri-satellite': { 
        type: 'raster', 
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], 
        tileSize: 256, 
        attribution: 'Tiles &copy; Esri' 
    },
    'esri-topo': { 
        type: 'raster', 
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'], 
        tileSize: 256, 
        attribution: 'Tiles &copy; Esri' 
    }
};

// Referencias a los elementos del DOM
const catastroCheckbox = document.getElementById('catastro-checkbox');
const layersToggleBtn = document.getElementById('layers-toggle');
const layersPanel = document.getElementById('layers-panel');
const cameraBtn = document.getElementById('camera-button');
const toggle3DBtn = document.getElementById('toggle-3d');
const buildingsCheckbox = document.getElementById('buildings-3d-checkbox');

// ==========================================================
// NUEVA LÍNEA: Referencia al checkbox de líneas de metro
// ==========================================================
const metroLinesCheckbox = document.getElementById('metro-lines-checkbox');


// ==================================================================
// SECCIÓN 2: FUNCIONES PRINCIPALES DEL MAPA
// ==================================================================

function initializeMap() {
    const blankStyle = {
        'version': 8,
        'name': 'Blank',
        'sources': {},
        'layers': [{
            'id': 'background',
            'type': 'background',
            'paint': { 'background-color': '#f0f0f0' }
        }]
    };

    map = new maplibregl.Map({ 
        container: 'map', 
        style: blankStyle, 
        center: [START_LON, START_LAT], 
        zoom: START_ZOOM, 
        antialias: true 
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
        // --- Mapas Base ---
        Object.keys(baseMaps).forEach(mapId => { 
            map.addSource(mapId, baseMaps[mapId]); 
            map.addLayer({ 
                id: mapId, 
                type: 'raster', 
                source: mapId, 
                layout: { 'visibility': (mapId === 'osm') ? 'visible' : 'none' } 
            }); 
        });

        // --- Capa Catastro (WMS) ---
        map.addSource('catastro-wms', { 
            'type': 'raster', 
            'tiles': ['https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx?bbox={bbox-epsg-3857}&format=image/png&service=WMS&version=1.1.1&request=GetMap&srs=EPSG:3857&width=256&height=256&layers=Catastro&transparent=true'], 
            'tileSize': 256, 
            'attribution': '© DGC' 
        });
        map.addLayer({ 
            'id': 'catastro-layer', 
            'type': 'raster', 
            'source': 'catastro-wms', 
            'layout': { 'visibility': 'none' }
        });

        // --- Capa Edificios 3D (GeoJSON) ---
        map.addSource('barcelona-buildings', {
            'type': 'geojson',
            'data': 'static/data/barcelona_buildings.geojson'
        });
        map.addLayer({
            'id': 'buildings-3d-layer',
            'type': 'fill-extrusion',
            'source': 'barcelona-buildings',
            'layout': { 'visibility': 'visible' },
            'paint': {
                'fill-extrusion-color': '#cccccc',
                'fill-extrusion-opacity': 0.85,
                'fill-extrusion-height': 40,
                'fill-extrusion-base': 0
            }
        });
        
        // ==========================================================
        // NUEVO BLOQUE: Capa de Líneas de Metro (GeoJSON)
        // ==========================================================
        map.addSource('metro-lines', {
            'type': 'geojson',
            'data': 'static/data/barcelona_metro_lines.geojson'
        });
        map.addLayer({
            'id': 'metro-lines-layer',
            'type': 'line',
            'source': 'metro-lines',
            'layout': {
                'visibility': 'none', // Oculta por defecto, se activa con el checkbox
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                // Usamos una expresión para tomar el color de la propiedad 'COLOR_LINIA'
                // y le añadimos el prefijo '#'
                'line-color': ['concat', '#', ['get', 'COLOR_LINIA']],
                'line-width': 3
            }
        });
        
        // --- Ordenar Capas ---
        // Nos aseguramos de que Catastro y las líneas de metro 
        // se dibujen DEBAJO de los edificios 3D
        if (map.getLayer('catastro-layer')) {
            map.moveLayer('catastro-layer', 'buildings-3d-layer');
        }
        if (map.getLayer('metro-lines-layer')) {
            map.moveLayer('metro-lines-layer', 'buildings-3d-layer');
        }
    });
}

/**
 * Cambia la visibilidad de los mapas base.
 * @param {string} selectedMapId - El ID del mapa base a mostrar ('osm', 'esri-satellite', etc.)
 */
function setBaseMap(selectedMapId) {
    if (!map) return;
    Object.keys(baseMaps).forEach(mapId => { 
        if (map.getLayer(mapId)) { 
            map.setLayoutProperty(mapId, 'visibility', (mapId === selectedMapId) ? 'visible' : 'none'); 
        } 
    });
}

// ==================================================================
// SECCIÓN 3: EVENT LISTENERS (Solo controles del mapa)
// ==================================================================

// --- Control del Panel de Capas ---
layersToggleBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    const isVisible = layersPanel.style.display === 'block'; 
    layersPanel.style.display = isVisible ? 'none' : 'block'; 
    
    if (!isVisible) { 
        map.once('click', () => { layersPanel.style.display = 'none'; }); 
    } 
});

layersPanel.addEventListener('click', (e) => { 
    e.stopPropagation(); 
});

// Listener para Mapas Base
document.querySelectorAll('input[name="base-layer"]').forEach(radio => { 
    radio.addEventListener('change', (e) => { 
        if (e.target.checked) setBaseMap(e.target.value); 
    }); 
});

// Listener para Catastro
catastroCheckbox.addEventListener('change', (e) => { 
    map.setLayoutProperty('catastro-layer', 'visibility', e.target.checked ? 'visible' : 'none'); 
});

// Listener para Edificios 3D
buildingsCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('buildings-3d-layer')) return; 
    map.setLayoutProperty('buildings-3d-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});

// ==========================================================
// NUEVO BLOQUE: Listener para las Líneas de Metro
// ==========================================================
metroLinesCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('metro-lines-layer')) return; 
    map.setLayoutProperty('metro-lines-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});


// --- Controles Adicionales del Mapa ---
toggle3DBtn.addEventListener('click', () => { 
    const currentPitch = map.getPitch(); 
    map.easeTo({ 
        pitch: (currentPitch > 0) ? 0 : 60,
        bearing: (currentPitch > 0) ? 0 : -20
    }); 
});

cameraBtn.addEventListener('click', () => { 
    map.once('render', () => { 
        map.getCanvas().toBlob((blob) => { 
            const a = document.createElement('a'); 
            a.href = URL.createObjectURL(blob); 
            a.download = `mapa_${new Date().toISOString().slice(0, 10)}.png`; 
            a.click(); 
            URL.revokeObjectURL(a.href); 
        }); 
    }); 
    map.triggerRepaint();
});

// ==================================================================
// SECCIÓN 4: INICIALIZACIÓN
// ==================================================================
initializeMap();