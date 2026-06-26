import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class LeaveScreen extends StatefulWidget {
  const LeaveScreen({super.key});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = false;
  String _userId = '';
  String _userRole = '';
  List<dynamic> _myLeaves = [];
  List<dynamic> _pendingLeaves = [];
  
  final _formKey = GlobalKey<FormState>();
  String _selectedLeaveType = 'Casual Leave';
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  final _reasonController = TextEditingController();

  final List<String> _leaveTypes = [
    'Casual Leave',
    'Sick Leave',
    'Earned Leave',
    'Maternity Leave',
    'Paternity Leave',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadUserData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _loadUserData() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userId = prefs.getString('user_id') ?? '';
      _userRole = prefs.getString('user_role') ?? '';
    });
    await _loadLeaves();
  }

  Future<void> _loadLeaves() async {
    setState(() => _isLoading = true);
    try {
      final myLeaves = await ApiService.getMyLeaves(_userId);
      setState(() => _myLeaves = myLeaves);

      if (_userRole == 'admin' || _userRole == 'hr') {
        final pending = await ApiService.getPendingLeaves();
        setState(() => _pendingLeaves = pending);
      }
    } catch (e) {
      _showError('Failed to load leaves: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _applyLeave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      final result = await ApiService.applyLeave({
        'employee_id': _userId,
        'leave_type': _selectedLeaveType,
        'start_date': DateFormat('yyyy-MM-dd').format(_startDate),
        'end_date': DateFormat('yyyy-MM-dd').format(_endDate),
        'reason': _reasonController.text,
      });

      if (result['success'] == true) {
        _showSuccess('Leave application submitted successfully');
        _reasonController.clear();
        await _loadLeaves();
        Navigator.pop(context);
      } else {
        _showError(result['message'] ?? 'Failed to apply leave');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _approveLeave(int requestId) async {
    setState(() => _isLoading = true);
    try {
      final result = await ApiService.approveLeave(requestId, _userId, 'Approved');
      if (result['success'] == true) {
        _showSuccess('Leave approved successfully');
        await _loadLeaves();
      } else {
        _showError(result['message'] ?? 'Failed to approve');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _rejectLeave(int requestId) async {
    setState(() => _isLoading = true);
    try {
      final result = await ApiService.rejectLeave(requestId, _userId, 'Rejected');
      if (result['success'] == true) {
        _showSuccess('Leave rejected');
        await _loadLeaves();
      } else {
        _showError(result['message'] ?? 'Failed to reject');
      }
    } catch (e) {
      _showError('Error: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showApplyLeaveDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Apply Leave'),
        content: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: _selectedLeaveType,
                  decoration: const InputDecoration(labelText: 'Leave Type'),
                  items: _leaveTypes.map((type) => DropdownMenuItem(
                    value: type,
                    child: Text(type),
                  )).toList(),
                  onChanged: (value) => setState(() => _selectedLeaveType = value!),
                ),
                const SizedBox(height: 16),
                ListTile(
                  title: const Text('Start Date'),
                  subtitle: Text(DateFormat('dd MMM yyyy').format(_startDate)),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _startDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (date != null) setState(() => _startDate = date);
                  },
                ),
                ListTile(
                  title: const Text('End Date'),
                  subtitle: Text(DateFormat('dd MMM yyyy').format(_endDate)),
                  trailing: const Icon(Icons.calendar_today),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _endDate,
                      firstDate: _startDate,
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (date != null) setState(() => _endDate = date);
                  },
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _reasonController,
                  decoration: const InputDecoration(
                    labelText: 'Reason',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                  validator: (value) => value?.isEmpty ?? true ? 'Required' : null,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: _applyLeave,
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
        title: const Text('Leave Management'),
        bottom: (_userRole == 'admin' || _userRole == 'hr')
            ? TabBar(
                controller: _tabController,
                tabs: const [
                  Tab(text: 'My Leaves'),
                  Tab(text: 'Pending Approvals'),
                ],
              )
            : null,
      ),
      body: (_userRole == 'admin' || _userRole == 'hr')
          ? TabBarView(
              controller: _tabController,
              children: [
                _buildMyLeavesTab(),
                _buildPendingApprovalsTab(),
              ],
            )
          : _buildMyLeavesTab(),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showApplyLeaveDialog,
        icon: const Icon(Icons.add),
        label: const Text('Apply Leave'),
      ),
    );
  }

  Widget _buildMyLeavesTab() {
    return RefreshIndicator(
      onRefresh: _loadLeaves,
      child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildLeaveBalance(),
                  const SizedBox(height: 20),
                  const Text(
                    'My Leave Requests',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  if (_myLeaves.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: Center(child: Text('No leave requests')),
                      ),
                    )
                  else
                    ..._myLeaves.map((leave) => _buildLeaveCard(leave, false)),
                ],
              ),
            ),
    );
  }

  Widget _buildPendingApprovalsTab() {
    return RefreshIndicator(
      onRefresh: _loadLeaves,
      child: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Pending Approvals (${_pendingLeaves.length})',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  if (_pendingLeaves.isEmpty)
                    const Card(
                      child: Padding(
                        padding: EdgeInsets.all(20),
                        child: Center(child: Text('No pending approvals')),
                      ),
                    )
                  else
                    ..._pendingLeaves.map((leave) => _buildLeaveCard(leave, true)),
                ],
              ),
            ),
    );
  }

  Widget _buildLeaveBalance() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Leave Balance',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildBalanceItem('Casual', '12', Colors.blue),
                _buildBalanceItem('Sick', '7', Colors.orange),
                _buildBalanceItem('Earned', '15', Colors.green),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBalanceItem(String type, String count, Color color) {
    return Column(
      children: [
        Text(
          count,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(type, style: TextStyle(color: Colors.grey[600])),
      ],
    );
  }

  Widget _buildLeaveCard(Map leave, bool showActions) {
    final status = leave['status'] ?? 'Pending';
    final statusColor = status == 'Approved'
        ? Colors.green
        : status == 'Rejected'
            ? Colors.red
            : Colors.orange;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  leave['leave_type'] ?? 'Leave',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: statusColor),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(color: statusColor, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (showActions)
              Text(
                'Employee: ${leave['employee_name'] ?? leave['employee_id']}',
                style: TextStyle(color: Colors.grey[600]),
              ),
            Text(
              'From: ${leave['start_date']} To: ${leave['end_date']}',
              style: TextStyle(color: Colors.grey[600]),
            ),
            if (leave['reason'] != null) ...[
              const SizedBox(height: 4),
              Text('Reason: ${leave['reason']}'),
            ],
            if (showActions && status == 'Pending') ...[
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton.icon(
                    onPressed: () => _rejectLeave(leave['id']),
                    icon: const Icon(Icons.close, color: Colors.red),
                    label: const Text('Reject', style: TextStyle(color: Colors.red)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    onPressed: () => _approveLeave(leave['id']),
                    icon: const Icon(Icons.check),
                    label: const Text('Approve'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
