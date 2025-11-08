import json
import os
try:
    # Shapely es necesario para calcular los centroides
    from shapely.geometry import shape, mapping
except ImportError:
    print("Error: La biblioteca 'shapely' no está instalada.")
    print("Por favor, instálala ejecutando: pip install shapely")
    exit()

# --- 1. Configuración ---
input_file = os.path.join("static", "data", "barcelona_buildings.geojson")
output_file = os.path.join("static", "data", "barcelona_population_points.geojson")

# Población de Barcelona (Municipio) para 2024, según Idescat.
POBLACION_BARCELONA = 1686208 

print(f"Iniciando análisis de población (con salida de PUNTOS).")
print(f"Archivo de entrada: {input_file}")
print(f"Archivo de salida: {output_file}")
print(f"Población total de Barcelona (2024): {POBLACION_BARCELONA}")

try:
    # --- 2. Cargar el archivo GeoJSON ---
    print(f"\nCargando {input_file}...")
    original_geojson = None
    with open(input_file, 'r', encoding='utf-8') as f:
        original_geojson = json.load(f)
    
    all_features = original_geojson.get('features', [])
    print(f"Total de edificios cargados: {len(all_features)}")

    # --- 3. (Paso 1) Filtrar por uso residencial ---
    residential_features = []
    for feature in all_features:
        properties = feature.get('properties', {})
        if properties.get('currentUse') == '1_residential':
            # Hacemos una copia para no modificar el original en memoria
            residential_features.append(feature.copy()) 
            
    print(f"Edificios filtrados por '1_residential': {len(residential_features)}")

    if not residential_features:
        print("No se encontraron edificios residenciales.")
    else:
        # --- 4. (Paso 2) Calcular viviendas totales ---
        total_viviendas = 0
        for feature in residential_features:
            dwellings = 0
            # Obtenemos el n.º de viviendas (puede ser None, str, int)
            raw_dwellings = feature.get('properties', {}).get('numberOfDwellings')
            
            # Limpiamos el dato
            if isinstance(raw_dwellings, (int, float)):
                dwellings = int(raw_dwellings)
            elif isinstance(raw_dwellings, str):
                try:
                    dwellings = int(raw_dwellings)
                except (ValueError, TypeError):
                    dwellings = 0
            
            total_viviendas += dwellings
            # Guardamos el valor limpio para usarlo después
            feature['properties']['numberOfDwellings_clean'] = dwellings

        print(f"Número total de viviendas (numberOfDwellings): {total_viviendas}")

        # --- 5. (Paso 3) Calcular el índice ---
        if total_viviendas == 0:
            print("Error: El total de viviendas es 0. No se puede calcular el índice.")
        else:
            habitantes_por_vivienda = POBLACION_BARCELONA / float(total_viviendas)
            
            print(f"\n--- Resultados del Cálculo ---")
            print(f"Índice calculado (habitantes por vivienda): {habitantes_por_vivienda:.4f}")

            # --- 6. (Paso 4 y 5) Calcular población, centroide y FILTRAR PROPIEDADES ---
            print("Calculando población, centroides y filtrando propiedades...")
            
            final_features = [] # Esta será nuestra lista de features finales
            
            for feature in residential_features:
                
                # --- Asignar población ---
                dwellings_clean = feature['properties'].get('numberOfDwellings_clean', 0)
                estimated_pop = dwellings_clean * habitantes_por_vivienda
                
                # --- Convertir geometría a Punto (Centroide) ---
                try:
                    original_geom = shape(feature['geometry'])
                    centroid_point = original_geom.representative_point()
                    
                    # --- (NUEVO) Crear el diccionario de propiedades filtradas ---
                    old_props = feature.get('properties', {})
                    
                    new_props = {
                        # Mapeamos los nombres originales a los que pediste
                        "referencia_catastral": old_props.get('reference'),
                        "metros_cuadrados": old_props.get('value'),
                        "viviendas": dwellings_clean,
                        "poblacion_estimada": estimated_pop
                    }

                    # --- (NUEVO) Crear la 'feature' final ---
                    final_feature = {
                        "type": "Feature",
                        "geometry": mapping(centroid_point), # Geometría de punto
                        "properties": new_props              # Solo las propiedades filtradas
                    }
                    
                    final_features.append(final_feature) # Añadir la nueva feature
                    
                except Exception as e:
                    gml_id = feature.get('properties', {}).get('gml_id', 'ID_DESCONOCIDO')
                    print(f"Advertencia: No se pudo procesar {gml_id}. Omitiendo. Error: {e}")

            print(f"Total de {len(final_features)} edificios convertidos a puntos.")

            # --- 7. Guardar el nuevo GeoJSON ---
            new_geojson = {
                "type": "FeatureCollection",
                "name": "barcelona_population_points",
                "features": final_features # Usamos la nueva lista de features filtradas
            }
            if 'crs' in original_geojson:
                new_geojson['crs'] = original_geojson['crs']

            print(f"\nGuardando resultados en: {output_file}")
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(new_geojson, f, indent=2)
                
            print("¡Análisis completado y archivo guardado!")

except FileNotFoundError:
    print(f"Error: No se encontró el archivo de entrada: {input_file}")
except Exception as e:
    print(f"Ha ocurrido un error inesperado: {e}")