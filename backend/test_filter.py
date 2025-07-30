import requests
import json

# Test data matching the CSV format
test_data = [
    {"Store": "1", "Dept": "1", "Date": "2010-02-05", "Weekly_Sales": "24924.5", "IsHoliday": "FALSE"},
    {"Store": "1", "Dept": "1", "Date": "2010-02-12", "Weekly_Sales": "46039.49", "IsHoliday": "TRUE"},
    {"Store": "1", "Dept": "1", "Date": "2010-02-19", "Weekly_Sales": "41595.55", "IsHoliday": "FALSE"},
    {"Store": "1", "Dept": "1", "Date": "2010-02-26", "Weekly_Sales": "19403.54", "IsHoliday": "FALSE"},
    {"Store": "1", "Dept": "1", "Date": "2010-03-05", "Weekly_Sales": "21827.9", "IsHoliday": "FALSE"}
]

# Test payload
payload = {
    "filter_condition": "Weekly_Sales > 2000",
    "file_data": test_data,
    "filename": "test.csv"
}

print("Testing filter with data:")
for i, row in enumerate(test_data):
    print(f"Row {i}: {row}")

print(f"\nFilter condition: {payload['filter_condition']}")

# Make the request
try:
    response = requests.post('http://localhost:5000/api/apply-sql-filter', 
                           json=payload,
                           headers={'Content-Type': 'application/json'})
    
    print(f"\nResponse status: {response.status_code}")
    print(f"Response headers: {response.headers}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"Success! Result: {json.dumps(result, indent=2)}")
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Request failed: {e}") 