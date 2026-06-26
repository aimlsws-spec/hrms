import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // CHANGE THIS TO YOUR COMPUTER'S IP ADDRESS
  static const String baseUrl = 'http://192.168.1.33:8000';
  
  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('token') ?? '';
    final userId = prefs.getString('user_id') ?? '';
    final userRole = prefs.getString('user_role') ?? '';
    
    return {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-user-role': userRole,
      'Authorization': 'Bearer $token',
    };
  }

  // ==================== AUTHENTICATION ====================
  static Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'password': password}),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> verifyOtp(String username, String otp) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/verify-otp'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username, 'otp': otp}),
    );
    return jsonDecode(response.body);
  }

  // ==================== DASHBOARD ====================
  static Future<Map<String, dynamic>> getDashboardStats() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/dashboard/stats'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getAnalyticsOverview() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/analytics/overview'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  // ==================== EMPLOYEES ====================
  static Future<List<dynamic>> getAllEmployees() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/employees/all'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['data'] ?? data['employees'] ?? [];
  }

  static Future<List<dynamic>> searchEmployees(String query) async {
    final response = await http.get(
      Uri.parse('$baseUrl/employees/search?q=$query'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['results'] ?? [];
  }

  static Future<Map<String, dynamic>> getEmployeesByDepartment() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/employees/by-department'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  // ==================== ATTENDANCE ====================
  static Future<Map<String, dynamic>> gpsCheckIn(String employeeId, double lat, double lng, String? location) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/attendance/gps/checkin'),
      headers: await _getHeaders(),
      body: jsonEncode({
        'employee_id': employeeId,
        'latitude': lat,
        'longitude': lng,
        'location': location
      }),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> gpsCheckOut(String employeeId, double lat, double lng, String? location) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/attendance/gps/checkout'),
      headers: await _getHeaders(),
      body: jsonEncode({
        'employee_id': employeeId,
        'latitude': lat,
        'longitude': lng,
        'location': location
      }),
    );
    return jsonDecode(response.body);
  }

  static Future<List<dynamic>> getAttendanceHistory(String employeeId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/attendance/gps/employee/$employeeId'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['records'] ?? [];
  }

  static Future<List<dynamic>> getAllGPSAttendance() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/attendance/gps/all'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['records'] ?? [];
  }

  // ==================== LEAVE MANAGEMENT ====================
  static Future<Map<String, dynamic>> applyLeave(Map<String, dynamic> leaveData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/leave/apply'),
      headers: await _getHeaders(),
      body: jsonEncode(leaveData),
    );
    return jsonDecode(response.body);
  }

  static Future<List<dynamic>> getMyLeaves(String employeeId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/leave-requests/my?user_id=$employeeId'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['requests'] ?? data['leave_requests'] ?? [];
  }

  static Future<List<dynamic>> getAllLeaves() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/leave-requests'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['requests'] ?? data['leave_requests'] ?? [];
  }

  static Future<List<dynamic>> getPendingLeaves() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/leave-requests/pending'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['requests'] ?? data['leave_requests'] ?? [];
  }

  static Future<Map<String, dynamic>> approveLeave(int requestId, String approvedBy, String? comments) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/leave_requests/$requestId/approve'),
      headers: await _getHeaders(),
      body: jsonEncode({'approved_by': approvedBy, 'comments': comments}),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> rejectLeave(int requestId, String rejectedBy, String? comments) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/leave_requests/$requestId/reject'),
      headers: await _getHeaders(),
      body: jsonEncode({'rejected_by': rejectedBy, 'comments': comments}),
    );
    return jsonDecode(response.body);
  }

  // ==================== REGULARIZATION ====================
  static Future<Map<String, dynamic>> requestRegularization(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/attendance/regularization/request'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  static Future<List<dynamic>> getMyRegularizations(String employeeId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/attendance/regularization/employee/$employeeId'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['requests'] ?? [];
  }

  static Future<List<dynamic>> getPendingRegularizations() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/attendance/regularization/pending'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['requests'] ?? [];
  }

  static Future<Map<String, dynamic>> approveRegularization(int requestId, String approvedBy, String? comments) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/attendance/regularization/approve/$requestId'),
      headers: await _getHeaders(),
      body: jsonEncode({'approved_by': approvedBy, 'comments': comments}),
    );
    return jsonDecode(response.body);
  }

  // ==================== TASKS ====================
  static Future<List<dynamic>> getMyTasks(String userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/tasks/user/$userId'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['tasks'] ?? [];
  }

  static Future<List<dynamic>> getAllTasks() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/tasks'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['tasks'] ?? [];
  }

  static Future<Map<String, dynamic>> createTask(Map<String, dynamic> taskData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/tasks'),
      headers: await _getHeaders(),
      body: jsonEncode(taskData),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> updateTask(String taskId, Map<String, dynamic> taskData) async {
    final response = await http.put(
      Uri.parse('$baseUrl/api/tasks/$taskId'),
      headers: await _getHeaders(),
      body: jsonEncode(taskData),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> deleteTask(String taskId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/api/tasks/$taskId'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  // ==================== SALARY & PAYROLL ====================
  static Future<List<dynamic>> getAllSalaryStructures() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/salary/structures/all'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['structures'] ?? [];
  }

  static Future<Map<String, dynamic>> getSalaryStructure(int structureId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/salary/structure/$structureId'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> createSalaryStructure(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/salary/structure/create'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> approveSalaryStructure(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/salary/structure/approve'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getPendingSalaryCount() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/salary/structures/pending'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getActiveSalaryCount() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/salary/structures/active/count'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getTotalPayroll() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/salary/structures/total-payroll'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  // ==================== SHIFTS ====================
  static Future<List<dynamic>> getAllShifts() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/shifts/all'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['shifts'] ?? [];
  }

  static Future<Map<String, dynamic>> getEmployeeShift(String employeeId, String? date) async {
    final url = date != null 
        ? '$baseUrl/api/shifts/employee/$employeeId?date=$date'
        : '$baseUrl/api/shifts/employee/$employeeId';
    final response = await http.get(
      Uri.parse(url),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> createShift(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/shifts/create'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> assignShift(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/shifts/assign'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  // ==================== ANNOUNCEMENTS ====================
  static Future<List<dynamic>> getAnnouncements() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/announcements'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['announcements'] ?? [];
  }

  static Future<Map<String, dynamic>> createAnnouncement(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/announcements'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  // ==================== TICKETS (SUPPORT) ====================
  static Future<List<dynamic>> getTickets(String userId, String userRole) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/tickets?user_id=$userId&user_role=$userRole'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['tickets'] ?? [];
  }

  static Future<Map<String, dynamic>> createTicket(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/tickets'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> updateTicketStatus(String ticketId, Map<String, dynamic> data) async {
    final response = await http.put(
      Uri.parse('$baseUrl/api/tickets/$ticketId/status'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> assignTicket(String ticketId, Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/tickets/$ticketId/assign'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  // ==================== DOCUMENTS ====================
  static String getSalarySlipUrl(String employeeId) {
    return '$baseUrl/api/documents/my-salary-slip?user_id=$employeeId';
  }

  static String getExperienceLetterUrl(String employeeId) {
    return '$baseUrl/api/documents/my-experience-letter?user_id=$employeeId';
  }

  static Future<Map<String, dynamic>> generateSalarySlip(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/documents/generate_salary_slip'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> generateOfferLetter(Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/documents/generate_offer_letter'),
      headers: await _getHeaders(),
      body: jsonEncode(data),
    );
    return jsonDecode(response.body);
  }

  // ==================== AI ASSISTANT ====================
  static Future<Map<String, dynamic>> chatWithAI(String userId, String message) async {
    final response = await http.post(
      Uri.parse('$baseUrl/chat'),
      headers: await _getHeaders(),
      body: jsonEncode({'user_id': userId, 'message': message}),
    );
    return jsonDecode(response.body);
  }

  // ==================== REPORTS ====================
  static Future<Map<String, dynamic>> getEmployeeSummaryReport() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/reports/employee_summary'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getDepartmentReport() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/reports/department_report'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getPayrollReport() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/reports/payroll_report'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getPerformanceReport() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/reports/performance_report'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  // ==================== AUDIT LOGS ====================
  static Future<Map<String, dynamic>> getAdminLogs(int limit) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/audit/admin-logs?limit=$limit'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getEmployeeLogs(int limit, String? employeeId) async {
    final url = employeeId != null
        ? '$baseUrl/api/audit/employee-logs?limit=$limit&employee_id=$employeeId'
        : '$baseUrl/api/audit/employee-logs?limit=$limit';
    final response = await http.get(
      Uri.parse(url),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getLoginHistory(int limit, String? userId) async {
    final url = userId != null
        ? '$baseUrl/api/audit/login-history?limit=$limit&user_id=$userId'
        : '$baseUrl/api/audit/login-history?limit=$limit';
    final response = await http.get(
      Uri.parse(url),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }

  static Future<Map<String, dynamic>> getAuditSummary() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/audit/summary'),
      headers: await _getHeaders(),
    );
    return jsonDecode(response.body);
  }
}
