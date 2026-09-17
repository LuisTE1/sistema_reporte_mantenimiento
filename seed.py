import pandas as pd
import json
import requests
import math

SUPABASE_URL = 'https://vbbrhzclzrpwzlbqmsvk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiYnJoemNsenJwd3psYnFtc3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzMDk2MTUsImV4cCI6MjEwMzg4NTYxNX0.AMF8Lwb2GkrsF6gvF_rkMItF_-GmXLB5A9aIg7m6K4M'

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def clean_val(v):
    if isinstance(v, float) and math.isnan(v):
        return None
    return v

def insert_data():
    df = pd.read_excel('EJEMPLO.xlsx', sheet_name='INFO PARA UNIDADES')
    data = df.to_dict(orient='records')
    
    tractos = set()
    carretas = set()
    mantenimientos = set()
    inventario = []

    for row in data:
        t = clean_val(row.get('TRACTOS'))
        if t: tractos.add(str(t).strip().upper())
        
        c = clean_val(row.get('CARRETA'))
        if c: carretas.add(str(c).strip().upper())
        
        m = clean_val(row.get(' Tipos de Mantenimiento'))
        if m: mantenimientos.add(str(m).strip().upper())
        
        p = clean_val(row.get('PRODUCTO'))
        s = clean_val(row.get('STOCK '))
        if p:
            inventario.append({
                "modulo": "unidades",
                "estacion": "UNIDADES",
                "nombre": str(p).strip().upper(),
                "stock": int(s) if s else 0,
                "creado_por": "Script"
            })
            
    print(f"Encontrados: {len(tractos)} tractos, {len(carretas)} carretas, {len(mantenimientos)} mantenimientos, {len(inventario)} inventario")

    # Insert Tractos
    for t in tractos:
        res = requests.post(f"{SUPABASE_URL}/rest/v1/unidades_tractos", headers=headers, json={"placa": t})
        if res.status_code not in (201, 200, 409):
            print("Error Tracto:", res.text)
            
    # Insert Carretas
    for c in carretas:
        res = requests.post(f"{SUPABASE_URL}/rest/v1/unidades_carretas", headers=headers, json={"placa": c})
        if res.status_code not in (201, 200, 409):
            print("Error Carreta:", res.text)
            
    # Insert Mantenimientos
    for m in mantenimientos:
        res = requests.post(f"{SUPABASE_URL}/rest/v1/mantenimiento_tipos", headers=headers, json={"nombre": m, "modulo": "unidades"})
        if res.status_code not in (201, 200, 409):
            print("Error Mantenimiento (Puede que la columna modulo falte):", res.text)

    # Insert Inventario
    for i in inventario:
        res = requests.post(f"{SUPABASE_URL}/rest/v1/inventario", headers=headers, json=i)
        if res.status_code not in (201, 200, 409):
            print("Error Inventario:", res.text)
            
    print("Migración de Excel a Supabase finalizada.")

if __name__ == '__main__':
    insert_data()
