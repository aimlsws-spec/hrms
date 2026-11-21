import json
import subprocess
import os
import sys

db_config = {
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'db': os.getenv('DB_NAME', 'hrms')
}

base_cmd = ["mysqldump", "-u", db_config['user'], f"--password={db_config['password']}", "-h", db_config['host'], db_config['db'], "--set-charset", "--default-character-set=utf8mb4"]

def run_dump(args, filename):
    cmd = base_cmd + args
    with open(filename, 'w', encoding='utf-8') as f:
        subprocess.run(cmd, stdout=f, check=True)
    print(f"Generated {filename}")

def main():
    with open('db_metadata.json', 'r') as f:
        metadata = json.load(f)
        
    all_tables = list(metadata.keys())
    
    seed_tables = [
        'accountant_settings', 'company_settings', 'departments', 
        'designations', 'holidays', 'tax_slabs', 'teams', 'wfh_system_config',
        'salary_templates', 'salary_structure'
    ]
    
    # Filter seed tables to only those that exist
    seed_tables = [t for t in seed_tables if t in all_tables]
    data_tables = [t for t in all_tables if t not in seed_tables]
    
    # 1. hrms_schema.sql
    run_dump(["--no-data", "--routines", "--events", "--triggers"], "hrms_schema.sql")
    
    # 2. hrms_seed.sql
    run_dump(["--no-create-info"] + seed_tables, "hrms_seed.sql")
    
    # 3. hrms_data.sql
    run_dump(["--no-create-info"] + data_tables, "hrms_data.sql")
    
    # 4. hrms_full_backup.sql
    run_dump(["--routines", "--events", "--triggers"], "hrms_full_backup.sql")
    
    # 5. DATABASE_DOCUMENTATION.txt
    with open("DATABASE_DOCUMENTATION.txt", "w", encoding='utf-8') as doc:
        doc.write("=========================================================\n")
        doc.write("DATABASE DOCUMENTATION\n")
        doc.write("=========================================================\n\n")
        doc.write(f"Database Name: {db_config['db']}\n")
        doc.write("Character Set: utf8mb4\n")
        doc.write("Collation: utf8mb4_general_ci\n")
        doc.write("MySQL Version: 8.0.x\n\n")
        doc.write("--- TABLE LIST ---\n")
        for t in all_tables:
            doc.write(f"- {t}\n")
            
        doc.write("\n=========================================================\n")
        doc.write("TABLE DETAILS\n")
        doc.write("=========================================================\n\n")
        
        for table, details in metadata.items():
            doc.write(f"Table: {table}\n")
            doc.write(f"Purpose: Stores data for {table.replace('_', ' ')}\n")
            doc.write("\nColumns:\n")
            for col in details['columns']:
                pk_mark = " (PRIMARY KEY)" if col['Key'] == 'PRI' else ""
                doc.write(f"  - {col['Field']} | {col['Type']} | Nullable: {col['Null']}{pk_mark}\n")
            
            if details['indexes']:
                doc.write("\nIndexes:\n")
                for idx in details['indexes']:
                    doc.write(f"  - {idx['Key_name']} on {idx['Column_name']} (Unique: {not bool(idx['Non_unique'])})\n")
            
            if details['fks']:
                doc.write("\nForeign Keys & Relationships:\n")
                for fk in details['fks']:
                    doc.write(f"  - {fk['COLUMN_NAME']} references {fk['REFERENCED_TABLE_NAME']}({fk['REFERENCED_COLUMN_NAME']})\n")
                    
            doc.write("\nModules Using Table:\n")
            doc.write("  - " + table.split('_')[0].capitalize() + " Management\n")
            doc.write("-" * 50 + "\n\n")
            
    print("Generated DATABASE_DOCUMENTATION.txt")
    
    # 6. DATABASE_RESTORE_GUIDE.txt
    with open("DATABASE_RESTORE_GUIDE.txt", "w", encoding='utf-8') as rg:
        rg.write("=========================================================\n")
        rg.write("DATABASE RESTORE GUIDE\n")
        rg.write("=========================================================\n\n")
        
        rg.write("Prerequisites:\n")
        rg.write("- MySQL 8.x installed and running.\n")
        rg.write("- Command line access (mysql and mysqldump commands available).\n\n")
        
        rg.write("Database Creation:\n")
        rg.write("Run the following commands in MySQL:\n")
        rg.write("CREATE DATABASE hrms CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;\n")
        rg.write("USE hrms;\n\n")
        
        rg.write("Import Steps:\n")
        rg.write("To import the full backup (Schema + Seed + Data):\n")
        rg.write("mysql -u root -p hrms < hrms_full_backup.sql\n\n")
        
        rg.write("To import in parts:\n")
        rg.write("1. mysql -u root -p hrms < hrms_schema.sql\n")
        rg.write("2. mysql -u root -p hrms < hrms_seed.sql\n")
        rg.write("3. mysql -u root -p hrms < hrms_data.sql\n\n")
        
        rg.write("Verification Steps:\n")
        rg.write("- Log into MySQL: mysql -u root -p\n")
        rg.write("- Run: USE hrms; SHOW TABLES;\n")
        rg.write("- Check counts: SELECT COUNT(*) FROM employees;\n\n")
        
        rg.write("Troubleshooting:\n")
        rg.write("- ERROR 1046 (3D000): No database selected -> Make sure to specify the db name or use 'USE hrms;' first.\n")
        rg.write("- Foreign key errors -> The full backup orders tables correctly or disables checks during import.\n\n")
        
        rg.write("Rollback Procedure:\n")
        rg.write("- DROP DATABASE hrms;\n")
        rg.write("- Re-create and import from a known good backup file.\n\n")
        
        rg.write("=========================================================\n")
        rg.write("BACKUP COMMANDS (For Future Use)\n")
        rg.write("=========================================================\n\n")
        
        rg.write("Full Backup:\n")
        rg.write("mysqldump -u root -p --routines --events --triggers --set-charset --default-character-set=utf8mb4 hrms > hrms_full_backup.sql\n\n")
        
        rg.write("Schema Only:\n")
        rg.write("mysqldump -u root -p --no-data --routines --events --triggers --set-charset --default-character-set=utf8mb4 hrms > hrms_schema.sql\n\n")
        
        rg.write("Data Only (All tables):\n")
        rg.write("mysqldump -u root -p --no-create-info --set-charset --default-character-set=utf8mb4 hrms > hrms_data_all.sql\n\n")
        
        rg.write("Seed Data Only:\n")
        rg.write(f"mysqldump -u root -p --no-create-info --set-charset --default-character-set=utf8mb4 hrms {' '.join(seed_tables)} > hrms_seed.sql\n")
        
    print("Generated DATABASE_RESTORE_GUIDE.txt")

if __name__ == "__main__":
    main()
