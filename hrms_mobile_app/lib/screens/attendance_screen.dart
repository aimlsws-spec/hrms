import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class AttendanceScreen extends StatefulWidget {
  final String userId;
  const AttendanceScreen({super.key, required this.userId});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  bool _isLoading = false;
  bool _isCheckedIn = false;
  List<dynamic> _attendanceHistory = [];
  Map<String, dynamic>? _todayAttendance;
  Position? _currentPosition;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final history = await ApiService.getAttendanceHistory(widget.userId);
      setState(() {
        _attendanceHistory = history;
        _checkTodayStatus();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      _showError('Failed to load attendance: $e');
    }
  }

  void _checkTodayStatus() {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    _todayAttendance = _attendanceHistory.firstWhere(
      (a) => a['attendance_date'].toString().startsWith(today),
      orElse: () => null,
    );
    _isCheckedIn = _todayAttendance != null && 
                   _todayAttendance!['check_out_time'] == null;
  }

  Future<void> _getCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _showError('Location services are disabled');
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _showError('Location permission denied');
          return;
        }
      }

      _currentPosition = await Geolocator.getCurrentPosition();
    } catch (e) {
      _showError('Failed to get location: $e');
    }
  }

  Future<void> _handleCheckIn() async {
    setState(() => _isLoading = true);
    await _getCurrentLocation();
    
    if (_currentPosition == null) {
      setState(() => _isLoading = false);
      return;
    }

    try {
      final result = await ApiService.gpsCheckIn(
        widget.userId,
        _currentPosition!.latitude,
        _currentPosition!.longitude,
        'Mobile App',
      );

      if (result['success'] == true) {
        _showSuccess('Checked in successfully!');
        await _loadData();
      } else {
        _showError(result['message'] ?? 'Check-in failed');
      }
    } catch (e) {
      _showError('Check-in failed: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleCheckOut() async {
    setState(() => _isLoading = true);
    await _getCurrentLocation();
    
    if (_currentPosition == null) {
      setState(() => _isLoading = false);
      return;
    }

    try {
      final result = await ApiService.gpsCheckOut(
        widget.userId,
        _currentPosition!.latitude,
        _currentPosition!.longitude,
        'Mobile App',
      );

      if (result['success'] == true) {
        _showSuccess('Checked out successfully!');
        await _loadData();
      } else {
        _showError(result['message'] ?? 'Check-out failed');
      }
    } catch (e) {
      _showError('Check-out failed: $e');
    } finally {
      setState(() => _isLoading = false);
    }
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
        title: const Text('Attendance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildTodayCard(),
                    const SizedBox(height: 20),
                    _buildCheckInOutButtons(),
                    const SizedBox(height: 20),
                    _buildMonthlyStats(),
                    const SizedBox(height: 20),
                    _buildAttendanceHistory(),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildTodayCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _isCheckedIn ? Icons.check_circle : Icons.schedule,
                  color: _isCheckedIn ? Colors.green : Colors.orange,
                ),
                const SizedBox(width: 8),
                Text(
                  'Today\'s Status',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_todayAttendance != null) ...[
              _buildStatusRow(
                'Check-in',
                _todayAttendance!['check_in_time']?.toString() ?? 'N/A',
                Icons.login,
              ),
              const SizedBox(height: 8),
              _buildStatusRow(
                'Check-out',
                _todayAttendance!['check_out_time']?.toString() ?? 'Not yet',
                Icons.logout,
              ),
            ] else
              const Text('No attendance marked today'),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusRow(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.grey[600]),
        const SizedBox(width: 8),
        Text('$label: ', style: const TextStyle(fontWeight: FontWeight.w500)),
        Text(value),
      ],
    );
  }

  Widget _buildCheckInOutButtons() {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: _isCheckedIn ? null : _handleCheckIn,
            icon: const Icon(Icons.login),
            label: const Text('Check In'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: _isCheckedIn ? _handleCheckOut : null,
            icon: const Icon(Icons.logout),
            label: const Text('Check Out'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orange,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMonthlyStats() {
    final thisMonth = _attendanceHistory.where((a) {
      final date = DateTime.parse(a['attendance_date'].toString());
      final now = DateTime.now();
      return date.month == now.month && date.year == now.year;
    }).toList();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'This Month',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStatItem('Present', thisMonth.length.toString(), Colors.green),
                _buildStatItem('Working Days', '22', Colors.blue),
                _buildStatItem('Attendance', '${((thisMonth.length / 22) * 100).toStringAsFixed(0)}%', Colors.orange),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(label, style: TextStyle(color: Colors.grey[600])),
      ],
    );
  }

  Widget _buildAttendanceHistory() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Attendance History',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        if (_attendanceHistory.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: Center(child: Text('No attendance records')),
            ),
          )
        else
          ..._attendanceHistory.take(10).map((record) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: record['check_out_time'] != null
                        ? Colors.green
                        : Colors.orange,
                    child: Icon(
                      record['check_out_time'] != null
                          ? Icons.check
                          : Icons.schedule,
                      color: Colors.white,
                    ),
                  ),
                  title: Text(
                    DateFormat('dd MMM yyyy').format(
                      DateTime.parse(record['attendance_date'].toString()),
                    ),
                  ),
                  subtitle: Text(
                    'In: ${record['check_in_time'] ?? 'N/A'} | Out: ${record['check_out_time'] ?? 'N/A'}',
                  ),
                  trailing: record['is_within_geofence'] == true
                      ? const Icon(Icons.location_on, color: Colors.green)
                      : const Icon(Icons.location_off, color: Colors.red),
                ),
              )),
      ],
    );
  }
}
