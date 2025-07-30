import sys
import os

# Add the current directory to Python path so we can import from app.py
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the filter functions from app.py
from app import parse_filter_condition, apply_filter_to_data

# Test data
test_data = [
    {"Store": "1", "Dept": "1", "Date": "2010-02-05", "Weekly_Sales": "24924.5", "IsHoliday": "FALSE"},
    {"Store": "1", "Dept": "1", "Date": "2010-02-12", "Weekly_Sales": "46039.49", "IsHoliday": "TRUE"},
    {"Store": "1", "Dept": "1", "Date": "2010-02-19", "Weekly_Sales": "41595.55", "IsHoliday": "FALSE"},
    {"Store": "1", "Dept": "1", "Date": "2010-02-26", "Weekly_Sales": "19403.54", "IsHoliday": "FALSE"},
    {"Store": "1", "Dept": "1", "Date": "2010-03-05", "Weekly_Sales": "21827.9", "IsHoliday": "FALSE"}
]

print("Testing filter parsing...")
filter_condition = "Weekly_Sales > 2000"
parsed_filter = parse_filter_condition(filter_condition)

print(f"Original condition: {filter_condition}")
print(f"Parsed filter: {parsed_filter}")

if parsed_filter:
    print("\nTesting filter application...")
    filtered_data = apply_filter_to_data(test_data, parsed_filter)
    print(f"Original rows: {len(test_data)}")
    print(f"Filtered rows: {len(filtered_data)}")
    
    if filtered_data:
        print("First few filtered rows:")
        for i, row in enumerate(filtered_data[:3]):
            print(f"  Row {i}: {row}")
    else:
        print("No rows matched the filter!")
else:
    print("Failed to parse filter condition!") 