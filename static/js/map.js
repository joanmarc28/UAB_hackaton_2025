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
// ==========================================================
// CANVI 1: Afegeixo la referència al nou checkbox del DTM
// ==========================================================
const terrain3DCheckbox = document.getElementById('terrain-3d-checkbox');

const catastroCheckbox = document.getElementById('catastro-checkbox');
const layersToggleBtn = document.getElementById('layers-toggle');
const layersPanel = document.getElementById('layers-panel');
const cameraBtn = document.getElementById('camera-button');
const toggle3DBtn = document.getElementById('toggle-3d');
const buildingsCheckbox = document.getElementById('buildings-3d-checkbox');
const metroLinesCheckbox = document.getElementById('metro-lines-checkbox');
const metroStopsCheckbox = document.getElementById('metro-stops-checkbox');
const populationHeatmapCheckbox = document.getElementById('population-heatmap-checkbox');
const stationDemandCheckbox = document.getElementById('station-demand-checkbox');
const ampliacioL1Checkbox = document.getElementById('ampliacio-l1-checkbox');
const l12Checkbox = document.getElementById('l12-checkbox');


// Referencias a los sliders del mapa de calor
const heatmapSliderContainer = document.getElementById('heatmap-slider-container');
const heatmapRadiusSlider = document.getElementById('heatmap-radius-slider');
const heatmapIntensitySlider = document.getElementById('heatmap-intensity-slider');


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
        antialias: true,
        maxPitch: 85
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {

        // ==========================================================
        // BLOC TERRENY 3D (DTM) DE MAPTILER
        // ==========================================================
        
        // 1. Afegir la font de dades (Això està bé)
        map.addSource('maptiler-terrain', {
            'type': 'raster-dem',
            'tiles': [
                `https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}`
            ],
            'tileSize': 512,
            'maxzoom': 14
        });

        // ==========================================================
        // CANVI 2: Hem eliminat 'map.setTerrain' d'aquí
        // Ara el terreny està APAGAT per defecte.
        // ==========================================================

        // 3. (Opcional) Afegir llum (Això està bé, ajuda als edificis 3D)
        map.setLight({anchor: 'viewport', color: '#ffffff', intensity: 0.4});
        // ==========================================================

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
            'data': 'static/data/buildings.geojson'
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
        
        // --- Capa Líneas de Metro (GeoJSON) ---
        map.addSource('metro-lines', {
            'type': 'geojson',
            'data': 'static/data/barcelona_metro_lines.geojson'
        });
        map.addLayer({
            'id': 'metro-lines-layer',
            'type': 'line',
            'source': 'metro-lines',
            'layout': { 'visibility': 'none', 'line-join': 'round', 'line-cap': 'round' },
            'paint': {
                'line-color': ['concat', '#', ['get', 'COLOR_LINIA']],
                'line-width': 5
            }
        });
        
        // --- Capa Paradas de Metro (Puntos Rojos Simples) ---
        map.addSource('metro-stops', {
            'type': 'geojson',
            'data': 'static/data/estacions.geojson'
        });
        map.addLayer({
            'id': 'metro-stops-layer',
            'type': 'circle',
            'source': 'metro-stops',
            'layout': { 'visibility': 'none' },
            'paint': {
                'circle-radius': 6,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-color': '#FF0000'
            }
        });
        
        // --- Fuente de Datos de Población (Puntos) ---
        map.addSource('population-points', {
            'type': 'geojson',
            'data': 'static/data/population_points.geojson'
        });
        
        // --- Capa Mapa de Calor de Población (Heatmap) ---
        map.addLayer({
            'id': 'population-heatmap-layer',
            'type': 'heatmap',
            'source': 'population-points', 
            'layout': { 'visibility': 'none' },
            'paint': {
                'heatmap-weight': [
                    'interpolate', ['linear'], ['get', 'poblacion_estimada'],
                    0, 0, 100, 1 
                ],
                'heatmap-intensity': 0.4, 
                'heatmap-radius': 15,
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(33,102,172,0)', 0.2, 'rgb(103,169,207)', 0.4, 'rgb(209,229,240)',
                    0.6, 'rgb(253,219,199)', 0.8, 'rgb(239,138,98)', 1, 'rgb(178,24,43)'
                ],
                'heatmap-opacity': 0.8
            }
        });

        // --- Capa de Demanda d'Estacions (Persones) ---
        map.addSource('station-demand-source', {
            'type': 'geojson',
            'data': 'static/data/estacions.geojson'
        });
        map.addLayer({
            'id': 'station-demand-layer',
            'type': 'circle',
            'source': 'station-demand-source',
            'layout': { 'visibility': 'none' },
            'paint': {
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'PERSONA'],
                    1000000, 3, 3000000, 6, 5000000, 10, 8000000, 15
                ],
                'circle-color': [
                    'interpolate', ['linear'], ['get', 'PERSONA'],
                    1000000, '#ffffcc', 3000000, '#fd8d3c', 5000000, '#e31a1c', 8000000, '#800026'
                ],
                'circle-opacity': 0.8,
                'circle-stroke-color': 'white',
                'circle-stroke-width': 1
            }
        });

        // --- Capa de Ampliación L1 ---
        map.addSource('ampliacio-l1-source', {
            'type': 'geojson',
            'data': 'static/data/ampliacio_l1.geojson'
        });
        map.addLayer({
            'id': 'ampliacio-l1-layer',
            'type': 'line',
            'source': 'ampliacio-l1-source',
            'layout': { 'visibility': 'none' },
            'paint': {
                'line-color': '#CE1126',
                'line-width': 5,
                'line-dasharray': [2, 2]
            }
        });

        // --- Capa L12 ---
        map.addSource('l12-source', {
            'type': 'geojson',
            'data': 'static/data/L12.geojson'
        });
        map.addLayer({
            'id': 'l12-layer',
            'type': 'line',
            'source': 'l12-source',
            'layout': { 'visibility': 'none' },
            'paint': {
                'line-color': '#48918dff',
                'line-width': 5,
                'line-dasharray': [2, 2]
            }
        });


        // --- Ordenar Capes ---
        const layersToMove = [
            'catastro-layer', 'population-heatmap-layer', 'metro-lines-layer', 'ampliacio-l1-layer', 'l12-layer', 
            'metro-stops-layer', 'station-demand-layer'
        ];
        layersToMove.forEach(layerId => {
            if (map.getLayer(layerId)) {
                // He trobat la primera capa de símbols (etiquetes de carrer)
                const firstSymbolLayer = map.getStyle().layers.find(l => l.type === 'symbol');
                const beforeLayer = firstSymbolLayer ? firstSymbolLayer.id : 'buildings-3d-layer';
                // Movem les nostres capes just abans de les etiquetes
                map.moveLayer(layerId, beforeLayer);
            }
        });
        // Movem els edificis 3D al final (per sobre de tot)
        if (map.getLayer('buildings-3d-layer')) {
             map.moveLayer('buildings-3d-layer');
        }

        // --- Interacció del Mapa (Popups i Cursos) ---
        
        // Popups per a la Demanda d'Estacions
        map.on('click', 'station-demand-layer', (e) => {
            if (e.features.length > 0) {
                const feature = e.features[0];
                const coordinates = feature.geometry.coordinates.slice();
                const stationName = feature.properties.NOM_ESTACIO;
                const passengerCount = feature.properties.PERSONA;
                
                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                }
                const formattedCount = Math.round(passengerCount).toLocaleString('ca-ES');
                const htmlContent = `
                    <div style="font-family: Arial, sans-serif; font-size: 14px; max-width: 200px;">
                        <strong style="color: #333; font-size: 1.1em;">${stationName}</strong>
                        <hr style="border: 0; border-top: 1px solid #ccc; margin: 4px 0;">
                        Passatgers: <strong style="color: #c00;">${formattedCount}</strong>
                    </div>
                `;
                new maplibregl.Popup({ closeButton: false, offset: 15 })
                    .setLngLat(coordinates).setHTML(htmlContent).addTo(map);
            }
        });

    }); // Fi de map.on('load')
}

/**
 * Canvia la visibilitat dels mapes base.
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
// SECCIÓN 3: EVENT LISTENERS (Controls del mapa)
// ==================================================================

// --- Control del Panell de Capes ---
layersToggleBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    const isVisible = layersPanel.style.display === 'block'; 
    layersPanel.style.display = isVisible ? 'none' : 'block'; 
    if (!isVisible) { map.once('click', () => { layersPanel.style.display = 'none'; }); } 
});

layersPanel.addEventListener('click', (e) => { e.stopPropagation(); });

// Listener per a Mapes Base
// FIX: Corregit 'name-layer' a 'name'
document.querySelectorAll('input[name="base-layer"]').forEach(radio => { 
    radio.addEventListener('change', (e) => { 
        if (e.target.checked) setBaseMap(e.target.value); 
    }); 
});

// ==========================================================
// CANVI 3: Afegeixo el listener per al checkbox del DTM
// ==========================================================
terrain3DCheckbox.addEventListener('change', (e) => {
    if (!map) return;
    if (e.target.checked) {
        // Activa el terreny
        map.setTerrain({
            'source': 'maptiler-terrain',
            'exaggeration': 1.5 
        });
    } else {
        // Desactiva el terreny
        map.setTerrain(null);
    }
});

// Listener per a Catastro
catastroCheckbox.addEventListener('change', (e) => { 
    if (!map || !map.getLayer('catastro-layer')) return;
    map.setLayoutProperty('catastro-layer', 'visibility', e.target.checked ? 'visible' : 'none'); 
});

// Listener per a Edificis 3D
buildingsCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('buildings-3d-layer')) return; 
    map.setLayoutProperty('buildings-3d-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});

// Listener per a Línies de Metro
metroLinesCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('metro-lines-layer')) return; 
    map.setLayoutProperty('metro-lines-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});

// Listener per a les Parades de Metro
metroStopsCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('metro-stops-layer')) return; 
    map.setLayoutProperty('metro-stops-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});

// --- Listeners per al Mapa de Calor de Població ---
populationHeatmapCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('population-heatmap-layer')) return; 
    const isVisible = e.target.checked;
    map.setLayoutProperty('population-heatmap-layer', 'visibility', isVisible ? 'visible' : 'none');
    heatmapSliderContainer.style.display = isVisible ? 'flex' : 'none';
});

heatmapRadiusSlider.addEventListener('input', (e) => {
    if (!map || !map.getLayer('population-heatmap-layer')) return;
    map.setPaintProperty('population-heatmap-layer', 'heatmap-radius', parseFloat(e.target.value));
});

heatmapIntensitySlider.addEventListener('input', (e) => {
    if (!map || !map.getLayer('population-heatmap-layer')) return;
    map.setPaintProperty('population-heatmap-layer', 'heatmap-intensity', parseFloat(e.target.value));
});

// --- Listener per a la Demanda d'Estacions ---
stationDemandCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('station-demand-layer')) return; 
    map.setLayoutProperty('station-demand-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});

// --- Listener per a la Ampliació L1 ---
ampliacioL1Checkbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('ampliacio-l1-layer')) return; 
    map.setLayoutProperty('ampliacio-l1-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});

// --- Listener per a la L12 ---
l12Checkbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('l12-layer')) return; 
    map.setLayoutProperty('l12-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});


// --- Controls Addicionals del Mapa ---
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
// SECCIÓ 4: INICIALITZACIÓ
// ==================================================================
initializeMap();