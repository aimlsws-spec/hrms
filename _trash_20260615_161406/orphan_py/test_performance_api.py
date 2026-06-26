#!/usr/bin/env python3
"""
Test script for the new performance API endpoints
"""

import requests
import json

BASE_URL = "http://localhost:8002"

def test_my_task_performance():
    """Test the my task performance endpoint"""
    print("Testing /api/performance/my-tasks/{employee_id}")
    
    # Test with a sample employee ID
    employee_id = "EMP001"
    url = f"{BASE_URL}/api/performance/my-tasks/{employee_id}"
    
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response:", json.dumps(data, indent=2))
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Error: {e}")

def test_all_performance_reports():
    """Test the all performance reports endpoint"""
    print("\nTesting /api/performance/reports/all")
    
    url = f"{BASE_URL}/api/performance/reports/all"
    
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response:", json.dumps(data, indent=2))
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Error: {e}")

def test_employee_detailed_report():
    """Test the employee detailed report endpoint"""
    print("\nTesting /api/performance/reports/employee/{employee_id}")
    
    # Test with a sample employee ID
    employee_id = "EMP001"
    url = f"{BASE_URL}/api/performance/reports/employee/{employee_id}"
    
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response:", json.dumps(data, indent=2))
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Error: {e}")

def test_department_performance_report():
    """Test the department performance report endpoint"""
    print("\nTesting /api/performance/reports/department/{department}")
    
    # Test with a sample department
    department = "IT"
    url = f"{BASE_URL}/api/performance/reports/department/{department}"
    
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response:", json.dumps(data, indent=2))
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Testing Performance API Endpoints")
    print("=" * 50)
    
    test_my_task_performance()
    test_all_performance_reports()
    test_employee_detailed_report()
    test_department_performance_report()
    
    print("\n" + "=" * 50)
    print("Testing completed!")