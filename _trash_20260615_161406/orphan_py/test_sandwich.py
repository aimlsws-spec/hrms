from sandwich_leave_policy import check_sandwich_leave
import json

# Test with Monday after weekend
result = check_sandwich_leave('2025-01-27', '2025-01-27')  # Monday
print("Test 1 - Monday after weekend:")
print(json.dumps(result, indent=2))
print()

# Test with Friday before weekend
result2 = check_sandwich_leave('2025-01-24', '2025-01-24')  # Friday
print("Test 2 - Friday before weekend:")
print(json.dumps(result2, indent=2))
