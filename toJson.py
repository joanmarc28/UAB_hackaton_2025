import os
import json
import pandas as pd

BASE_DIR = "Data"
RAW_DIR = os.path.join(BASE_DIR, "rawData")
PROCESSED_DIR = os.path.join(BASE_DIR, "processedData")
METADATA_PATH = os.path.join(RAW_DIR, "metadata.txt")

def asegurar_carpeta(path):
    if not os.path.exists(path):
        os.makedirs(path)

def convertir_xlsx_a_json(input_file, output_file):
    """Convierte un Excel con todas sus hojas a un JSON estructurado."""
    hojas = pd.read_excel(input_file, sheet_name=None)
    datos = {nombre: df.to_dict(orient="records") for nombre, df in hojas.items()}

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)

def encontrar_fichero(nombre):
    """Busca un fichero dentro de rawData de manera recursiva."""
    for root, dirs, files in os.walk(RAW_DIR):
        if nombre in files:
            return os.path.join(root, nombre)
    return None

def procesar_metadata():
    """Procesa metadata.txt y genera los JSON en processedData."""
    asegurar_carpeta(PROCESSED_DIR)

    # Leer el metadata.txt
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        lista_ficheros = [line.strip() for line in f.readlines() if line.strip()]

    print("\n Ficheros en metadata.txt:")
    for f_line in lista_ficheros:
        print("  •", f_line)

    print("\nBuscando y convirtiendo archivos...\n")

    for nombre_fichero in lista_ficheros:
        ruta_origen = encontrar_fichero(nombre_fichero)

        if not ruta_origen:
            print(f" No se encontró el archivo: {nombre_fichero}")
            continue

        nombre_sin_ext = os.path.splitext(nombre_fichero)[0]
        ruta_salida = os.path.join(PROCESSED_DIR, f"{nombre_sin_ext}.json")

        print(f" Convirtiendo: {nombre_fichero}")
        convertir_xlsx_a_json(ruta_origen, ruta_salida)
        print(f"   → Guardado en: {ruta_salida}\n")

    print("Conversión completada")

if __name__ == "__main__":
    procesar_metadata()
