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
const metroLinesCheckbox = document.getElementById('metro-lines-checkbox');
const metroStopsCheckbox = document.getElementById('metro-stops-checkbox');
const populationPointsCheckbox = document.getElementById('population-points-checkbox');

// ==========================================================
// NUEVAS LÍNEAS: Referencias para el Mapa de Calor y sus sliders
// ==========================================================
const populationHeatmapCheckbox = document.getElementById('population-heatmap-checkbox');
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
                'line-width': 3
            }
        });
        
        // --- Capa Paradas de Metro (GeoJSON) ---
        map.addSource('metro-stops', {
            'type': 'geojson',
            'data': 'static/data/barcelona_metro_stops.geojson'
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
        
        // --- Capa de Puntos de Población (GeoJSON) ---
        // (Usamos la misma fuente para el heatmap y los puntos)
        map.addSource('population-points', {
            'type': 'geojson',
            'data': 'static/data/barcelona_population_points.geojson'
        });
        
        map.addLayer({
            'id': 'population-points-layer',
            'type': 'circle',
            'source': 'population-points',
            'layout': { 'visibility': 'none' },
            'paint': {
                // ==========================================================
                // CAMBIO: Tus nuevos valores de radio (más pequeños)
                // ==========================================================
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'poblacion_estimada'],
                    0, 1,   // Si 0 persones -> 1px radi
                    10, 1.5,  // Si 10 persones -> 1.5px radi
                    50, 3,  // Si 50 persones -> 3px radi
                    100, 5 // Si 100+ persones -> 5px radi
                ],
                'circle-color': [
                    'interpolate', ['linear'], ['get', 'poblacion_estimada'],
                    0, '#ffffcc', 25, '#fd8d3c', 50, '#e31a1c', 100, '#800026'
                ],
                'circle-opacity': 0.75,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 0.5
            }
        });
        
        // ==========================================================
        // NUEVO BLOQUE: Capa de Mapa de Calor de Población
        // ==========================================================
        map.addLayer({
            'id': 'population-heatmap-layer',
            'type': 'heatmap',
            'source': 'population-points', // Reutilizamos la misma fuente
            'layout': {
                'visibility': 'none' // Oculta por defecto
            },
            'paint': {
                // Pondera cada punto según la población estimada
                // (0 población = 0 peso, 100+ población = peso 1)
                'heatmap-weight': [
                    'interpolate', ['linear'], ['get', 'poblacion_estimada'],
                    0, 0,
                    100, 1 
                ],
                // Intensidad controlada por el slider (default 1)
                'heatmap-intensity': 0.4, // Abans era 1
                'heatmap-radius': 15,     // Abans era 30
                // Rampa de color (azul -> verde -> amarillo -> rojo)
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(33,102,172,0)',
                    0.2, 'rgb(103,169,207)',
                    0.4, 'rgb(209,229,240)',
                    0.6, 'rgb(253,219,199)',
                    0.8, 'rgb(239,138,98)',
                    1, 'rgb(178,24,43)'
                ],
                // Opacidad general de la capa
                'heatmap-opacity': 0.8
            }
        });

        // --- Ordenar Capas ---
        const layersToMove = ['catastro-layer', 'metro-lines-layer', 'metro-stops-layer', 'population-points-layer', 'population-heatmap-layer'];
        layersToMove.forEach(layerId => {
            if (map.getLayer(layerId)) {
                // Mueve todas las capas debajo de los edificios 3D
                map.moveLayer(layerId, 'buildings-3d-layer');
            }
        });
    });
}

/**
 * Cambia la visibilidad de los mapas base.
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
// SECCIÓN 3: EVENT LISTENERS (Controles del mapa)
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

// Listener para Líneas de Metro
metroLinesCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('metro-lines-layer')) return; 
    map.setLayoutProperty('metro-lines-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});

// Listener para las Paradas de Metro
metroStopsCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('metro-stops-layer')) return; 
    map.setLayoutProperty('metro-stops-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});

// Listener para los Puntos de Población
populationPointsCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('population-points-layer')) return; 
    map.setLayoutProperty('population-points-layer', 'visibility', e.target.checked ? 'visible' : 'none');
});

// ==========================================================
// NUEVOS LISTENERS: Para el Mapa de Calor y sus Sliders
// ==========================================================

// 1. Listener para el CHECKBOX del mapa de calor
populationHeatmapCheckbox.addEventListener('change', (e) => {
    if (!map || !map.getLayer('population-heatmap-layer')) return; 
    
    const isVisible = e.target.checked;
    
    // Muestra/oculta la capa en el mapa
    map.setLayoutProperty('population-heatmap-layer', 'visibility', isVisible ? 'visible' : 'none');
    
    // Muestra/oculta el contenedor de los sliders
    heatmapSliderContainer.style.display = isVisible ? 'flex' : 'none';
});

// 2. Listener para el SLIDER de RADIO
heatmapRadiusSlider.addEventListener('input', (e) => {
    if (!map || !map.getLayer('population-heatmap-layer')) return;
    
    // Obtenemos el valor (número) del slider
    const radius = parseFloat(e.target.value);
    
    // Actualizamos la propiedad 'heatmap-radius' en el mapa
    map.setPaintProperty('population-heatmap-layer', 'heatmap-radius', radius);
});

// 3. Listener para el SLIDER de INTENSIDAD
heatmapIntensitySlider.addEventListener('input', (e) => {
    if (!map || !map.getLayer('population-heatmap-layer')) return;
    
    // Obtenemos el valor (número) del slider
    const intensity = parseFloat(e.target.value);
    
    // Actualizamos la propiedad 'heatmap-intensity' en el mapa
    map.setPaintProperty('population-heatmap-layer', 'heatmap-intensity', intensity);
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