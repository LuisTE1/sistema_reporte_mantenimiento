import pandas as pd
import json
import sys

try:
    df = pd.read_excel('EJEMPLO.xlsx', sheet_name='INFO PARA UNIDADES')
    data = df.to_dict(orient='records')
    print(json.dumps(data, indent=2, ensure_ascii=False))
except Exception as e:
    print("Error:", e)
