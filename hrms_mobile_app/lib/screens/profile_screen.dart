import 'package:flutter/material.dart';
import '../services/enhanced_api_service.dart';

class ProfileScreen extends StatefulWidget {
  final String userId;
  const ProfileScreen({super.key, required this.userId});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic> _profile = {};
  bool _loading = true;
  bool _editing = false;
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await EnhancedApiService.getEmployeeDetails(widget.userId);
      setState(() {
        _profile = profile['employee'] ?? {};
        _phoneController.text = _profile['phone'] ?? '';
        _addressController.text = _profile['address'] ?? '';
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  Future<void> _saveProfile() async {
    try {
      await EnhancedApiService.updateProfile(widget.userId, {
        'phone': _phoneController.text,
        'address': _addressController.text,
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated successfully'), backgroundColor: Colors.green),
      );
      setState(() => _editing = false);
      _loadProfile();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Profile'),
        actions: [
          IconButton(
            icon: Icon(_editing ? Icons.save : Icons.edit),
            onPressed: _editing ? _saveProfile : () => setState(() => _editing = true),
          ),
        ],
      ),
      body: _loading ? const Center(child: CircularProgressIndicator()) : SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            CircleAvatar(
              radius: 50,
              child: Text(_profile['first_name']?[0] ?? 'U', style: const TextStyle(fontSize: 40)),
            ),
            const SizedBox(height: 16),
            Text('${_profile['first_name']} ${_profile['last_name']}', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            Text(_profile['employee_id'] ?? '', style: TextStyle(color: Colors.grey[600])),
            const SizedBox(height: 24),
            _infoCard('Email', _profile['email'] ?? 'N/A', Icons.email),
            _infoCard('Department', _profile['department'] ?? 'N/A', Icons.business),
            _infoCard('Position', _profile['position'] ?? 'N/A', Icons.work),
            _infoCard('Join Date', _profile['date_of_joining'] ?? 'N/A', Icons.calendar_today),
            if (_editing) ...[
              const SizedBox(height: 16),
              TextField(
                controller: _phoneController,
                decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _addressController,
                decoration: const InputDecoration(labelText: 'Address', border: OutlineInputBorder()),
                maxLines: 3,
              ),
            ] else ...[
              _infoCard('Phone', _profile['phone'] ?? 'N/A', Icons.phone),
              _infoCard('Address', _profile['address'] ?? 'N/A', Icons.location_on),
            ],
          ],
        ),
      ),
    );
  }

  Widget _infoCard(String label, String value, IconData icon) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, color: Colors.blue),
        title: Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
        subtitle: Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500)),
      ),
    );
  }
}
