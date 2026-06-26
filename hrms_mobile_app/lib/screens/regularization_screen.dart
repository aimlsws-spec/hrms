import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class RegularizationScreen extends StatefulWidget {
  final bool isHR;
  const RegularizationScreen({super.key, this.isHR = false});

  @override
  State<RegularizationScreen> createState() => _RegularizationScreenState();
}

class _RegularizationScreenState extends State<RegularizationScreen> {
  List<dynamic> _requests = [];
  bool _isLoading = true;
  String _userId = '';

  DateTime _selectedDate = DateTime.now();
  final _checkInController = TextEditingController(text: '09:00');
  final _checkOutController = TextEditingController(text: '18:00');
  final _reasonController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    final prefs = await SharedPreferences.getInstance();
    _userId = prefs.getString('user_id') ?? '';
    
    setState(() => _isLoading = true);
    
    try {
      final requests = widget.isHR
          ? await ApiService.getPendingRegularizations()
          : await ApiService.getMyLeaves(_userId); // Reuse for now
      
      setState(() {
        _requests = requests;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      _showError('Failed to load requests: $e');
    }
  }

  Future<void> _requestRegularization() async {
    if (_reasonController.text.isEmpty) {
      _showError('Please enter reason');
      return;
    }

    try {
      final result = await ApiService.requestRegularization({
        'employee_id': _userId,
        'attendance_date': DateFormat('yyyy-MM-dd').format(_selectedDate),
        'requested_check_in': _checkInController.text,
        'requested_check_out': _checkOutController.text,
        'reason': _reasonController.text,
      });

      if (result['success'] == true) {
        _showSuccess('Regularization request submitted!');
        _reasonController.clear();
        _loadRequests();
        Navigator.pop(context);
      } else {
        _showError(result['message'] ?? 'Failed to submit request');
      }
    } catch (e) {
      _showError('Error: $e');
    }
  }

  Future<void> _approveRequest(int requestId) async {
    try {
      final result = await ApiService.approveRegularization(requestId, _userId, null);
      
      if (result['success'] == true) {
        _showSuccess('Request approved successfully!');
        _loadRequests();
      } else {
        _showError(result['message'] ?? 'Failed to approve');
      }
    } catch (e) {
      _showError('Error: $e');
    }
  }

  void _showRequestDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Request Regularization'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: const Text('Date'),
                subtitle: Text(DateFormat('dd MMM yyyy').format(_selectedDate)),
                trailing: const Icon(Icons.calendar_today),
                onTap: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: _selectedDate,
                    firstDate: DateTime.now().subtract(const Duration(days: 30)),
                    lastDate: DateTime.now(),
                  );
                  if (date != null) setState(() => _selectedDate = date);
                },
              ),
              TextField(
                controller: _checkInController,
                decoration: const InputDecoration(
                  labelText: 'Check-in Time (HH:MM)',
                  prefixIcon: Icon(Icons.login),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _checkOutController,
                decoration: const InputDecoration(
                  labelText: 'Check-out Time (HH:MM)',
                  prefixIcon: Icon(Icons.logout),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _reasonController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Reason',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: _requestRegularization,
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isHR ? 'Approve Regularizations' : 'My Regularizations'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _requests.isEmpty
              ? const Center(child: Text('No requests found'))
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _requests.length,
                  itemBuilder: (context, index) {
                    final request = _requests[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        title: Text(request['attendance_date'] ?? 'Date'),
                        subtitle: Text(
                          'In: ${request['requested_check_in']} | Out: ${request['requested_check_out']}\n${request['reason']}',
                        ),
                        trailing: widget.isHR
                            ? ElevatedButton(
                                onPressed: () => _approveRequest(request['id']),
                                child: const Text('Approve'),
                              )
                            : Chip(
                                label: Text(request['status'] ?? 'Pending'),
                                backgroundColor: _getStatusColor(request['status']),
                              ),
                      ),
                    );
                  },
                ),
      floatingActionButton: widget.isHR
          ? null
          : FloatingActionButton.extended(
              onPressed: _showRequestDialog,
              icon: const Icon(Icons.add),
              label: const Text('Request'),
            ),
    );
  }

  Color _getStatusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'approved':
        return Colors.green.shade100;
      case 'rejected':
        return Colors.red.shade100;
      default:
        return Colors.orange.shade100;
    }
  }
}
