import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/enhanced_api_service.dart';
import 'attendance_screen.dart';
import 'employee_directory_screen.dart';
import 'profile_screen.dart';
import 'ai_assistant_screen.dart';
import 'login_screen.dart';

class EnhancedHomeScreen extends StatefulWidget {
  const EnhancedHomeScreen({super.key});

  @override
  State<EnhancedHomeScreen> createState() => _EnhancedHomeScreenState();
}

class _EnhancedHomeScreenState extends State<EnhancedHomeScreen> {
  String _userName = '';
  String _userRole = '';
  String _userId = '';
  int _empCount = 0;
  int _pendingLeaves = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userName = prefs.getString('full_name') ?? 'User';
      _userRole = prefs.getString('user_role') ?? 'employee';
      _userId = prefs.getString('user_id') ?? '';
    });

    if (_userRole == 'admin' || _userRole == 'hr') {
      final stats = await EnhancedApiService.getDashboardStats();
      setState(() {
        _empCount = stats['employeeCount'] ?? 0;
        _pendingLeaves = stats['pendingLeaves'] ?? 0;
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('HRMS Dashboard'),
        actions: [
          IconButton(icon: const Icon(Icons.chat), onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AIAssistantScreen()))),
          IconButton(icon: const Icon(Icons.logout), onPressed: _logout),
        ],
      ),
      body: _loading ? const Center(child: CircularProgressIndicator()) : SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              color: Colors.blue[50],
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(radius: 30, child: Text(_userName[0].toUpperCase(), style: const TextStyle(fontSize: 24))),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(_userName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                          Text(_userRole.toUpperCase(), style: TextStyle(color: Colors.grey[700])),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_userRole == 'admin' || _userRole == 'hr') ...[
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(child: _statCard('Employees', _empCount.toString(), Icons.people, Colors.blue)),
                  const SizedBox(width: 12),
                  Expanded(child: _statCard('Pending Leaves', _pendingLeaves.toString(), Icons.pending_actions, Colors.orange)),
                ],
              ),
            ],
            const SizedBox(height: 20),
            const Text('Quick Access', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _menuItem('My Attendance', Icons.access_time, () => Navigator.push(context, MaterialPageRoute(builder: (_) => AttendanceScreen(userId: _userId)))),
            _menuItem('My Profile', Icons.person, () => Navigator.push(context, MaterialPageRoute(builder: (_) => ProfileScreen(userId: _userId)))),
            if (_userRole == 'admin' || _userRole == 'hr')
              _menuItem('Employee Directory', Icons.contacts, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EmployeeDirectoryScreen()))),
            _menuItem('AI Assistant', Icons.smart_toy, () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AIAssistantScreen()))),
          ],
        ),
      ),
    );
  }

  Widget _statCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Icon(icon, size: 32, color: color),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
            Text(title, style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _menuItem(String title, IconData icon, VoidCallback onTap) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: Colors.blue),
        title: Text(title),
        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
        onTap: onTap,
      ),
    );
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    if (!mounted) return;
    Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
  }
}
