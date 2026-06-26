import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/api_service.dart';
import '../login_screen.dart';

class HRDashboard extends StatefulWidget {
  const HRDashboard({super.key});

  @override
  State<HRDashboard> createState() => _HRDashboardState();
}

class _HRDashboardState extends State<HRDashboard> {
  String _userName = '';
  bool _isLoading = true;
  List<dynamic> _pendingLeaves = [];
  List<dynamic> _pendingRegularizations = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() => _userName = prefs.getString('full_name') ?? 'HR');
    
    try {
      final leaves = await ApiService.getPendingLeaves();
      final regularizations = await ApiService.getPendingRegularizations();
      setState(() {
        _pendingLeaves = leaves;
        _pendingRegularizations = regularizations;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('HR Dashboard'),
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: () async {
            final prefs = await SharedPreferences.getInstance();
            await prefs.clear();
            if (!mounted) return;
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (_) => const LoginScreen()),
            );
          }),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Welcome, $_userName',
                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 20),
                    _buildPendingSection('Leave Requests', _pendingLeaves, Icons.event_available),
                    const SizedBox(height: 20),
                    _buildPendingSection('Regularizations', _pendingRegularizations, Icons.edit_calendar),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildPendingSection(String title, List items, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        if (items.isEmpty)
          const Card(child: Padding(padding: EdgeInsets.all(20), child: Text('No pending requests')))
        else
          ...items.map((item) => Card(
                child: ListTile(
                  leading: CircleAvatar(child: Icon(icon)),
                  title: Text(item['employee_name'] ?? 'Employee'),
                  subtitle: Text(item['reason'] ?? item['leave_type'] ?? ''),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.check, color: Colors.green),
                        onPressed: () => _approveRequest(item),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.red),
                        onPressed: () => _rejectRequest(item),
                      ),
                    ],
                  ),
                ),
              )),
      ],
    );
  }

  Future<void> _approveRequest(Map item) async {
    // Implement approval logic
  }

  Future<void> _rejectRequest(Map item) async {
    // Implement rejection logic
  }
}
