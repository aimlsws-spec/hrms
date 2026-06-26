import 'package:flutter/material.dart';
import '../services/enhanced_api_service.dart';

class EmployeeDirectoryScreen extends StatefulWidget {
  const EmployeeDirectoryScreen({super.key});

  @override
  State<EmployeeDirectoryScreen> createState() => _EmployeeDirectoryScreenState();
}

class _EmployeeDirectoryScreenState extends State<EmployeeDirectoryScreen> {
  List<dynamic> _employees = [];
  List<dynamic> _filtered = [];
  bool _loading = true;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadEmployees();
  }

  Future<void> _loadEmployees() async {
    try {
      final employees = await EnhancedApiService.getAllEmployees();
      setState(() {
        _employees = employees;
        _filtered = employees;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  void _filterEmployees(String query) {
    setState(() {
      _filtered = _employees.where((emp) {
        final name = '${emp['first_name']} ${emp['last_name']}'.toLowerCase();
        final empId = emp['employee_id'].toString().toLowerCase();
        return name.contains(query.toLowerCase()) || empId.contains(query.toLowerCase());
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Employee Directory')),
      body: _loading ? const Center(child: CircularProgressIndicator()) : Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                hintText: 'Search by name or ID...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: _filterEmployees,
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _filtered.length,
              itemBuilder: (context, index) {
                final emp = _filtered[index];
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: ListTile(
                    leading: CircleAvatar(child: Text(emp['first_name'][0])),
                    title: Text('${emp['first_name']} ${emp['last_name']}'),
                    subtitle: Text('${emp['employee_id']} • ${emp['department'] ?? 'N/A'}'),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                    onTap: () => _showEmployeeDetails(emp),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showEmployeeDetails(Map<String, dynamic> emp) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${emp['first_name']} ${emp['last_name']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('ID: ${emp['employee_id']}'),
            Text('Email: ${emp['email'] ?? 'N/A'}'),
            Text('Phone: ${emp['phone'] ?? 'N/A'}'),
            Text('Department: ${emp['department'] ?? 'N/A'}'),
            Text('Position: ${emp['position'] ?? 'N/A'}'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        ],
      ),
    );
  }
}
