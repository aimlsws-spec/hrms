"""
Direct test of salary structure manager (no HTTP)
"""

from salary_structure_manager import SalaryStructureManager

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Root@12345',
    'database': 'hrms_complete'
}

def test_direct():
    print("=" * 60)
    print("DIRECT SALARY STRUCTURE TEST")
    print("=" * 60)
    
    manager = SalaryStructureManager(DB_CONFIG)
    
    # Test for Amit Shah
    employee_id = "EMP029"
    annual_ctc = 1200000
    
    print(f"\nCreating salary structure for {employee_id}")
    print(f"Annual CTC: Rs. {annual_ctc:,}")
    
    result = manager.update_salary_structure(
        employee_id=employee_id,
        annual_ctc=annual_ctc,
        template='standard',
        updated_by='Accountant'
    )
    
    if result['success']:
        print("\n[SUCCESS]")
        print(f"Structure ID: {result.get('structure_id')}")
        print(f"Message: {result.get('message')}")
        
        documents = result.get('documents', [])
        if documents:
            print(f"\n[DOCUMENTS] Generated:")
            for doc in documents:
                print(f"  - {doc['type']}: {doc['filename']}")
    else:
        print(f"\n[FAILED]: {result.get('message')}")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    test_direct()
