import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class EnhancedApiService {
  static const String baseUrl = 'http://192.168.1.33:8000';
  
  static Future<Map<String, String>> _getHeaders() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'Content-Type': 'application/json',
      'x-user-id': prefs.getString('user_id') ?? '',
      'x-user-role': prefs.getString('user_role') ?? '',
      'Authorization': 'Bearer ${prefs.getString('token') ?? ''}',
    };
  }

  // Dashboard Stats
  static Future<Map<String, dynamic>> getDashboardStats() async {
    final response = await http.get(Uri.parse('$baseUrl/api/employees/count'), headers: await _getHeaders());
    final empCount = jsonDecode(response.body);
    
    final leaveResp = await http.get(Uri.parse('$baseUrl/api/leave-requests/pending/count'), headers: await _getHeaders());
    final leaveCount = jsonDecode(leaveResp.body);
    
    return {'employeeCount': empCount['count'] ?? 0, 'pendingLeaves': leaveCount['count'] ?? 0};
  }

  // Employee Directory
  static Future<List<dynamic>> getAllEmployees() async {
    final response = await http.get(Uri.parse('$baseUrl/api/employees/all'), headers: await _getHeaders());
    final data = jsonDecode(response.body);
    return data['employees'] ?? [];
  }

  static Future<Map<String, dynamic>> getEmployeeDetails(String empId) async {
    final response = await http.get(Uri.parse('$baseUrl/api/employees/$empId'), headers: await _getHeaders());
    return jsonDecode(response.body);
  }

  // Attendance History
  static Future<List<dynamic>> getAttendanceHistory(String empId, {String? month, String? year}) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/attendance/gps/employee/$empId'),
      headers: await _getHeaders(),
    );
    final data = jsonDecode(response.body);
    return data['records'] ?? [];
  }

  // Profile Management
  static Future<Map<String, dynamic>> updateProfile(String empId, Map<String, dynamic> profileData) async {
    final response = await http.put(
      Uri.parse('$baseUrl/api/employees/$empId'),
      headers: await _getHeaders(),
      body: jsonEncode(profileData),
    );
    return jsonDecode(response.body);
  }

  // AI Assistant
  static Future<Map<String, dynamic>> sendAIMessage(String message, String userId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/ai/chat'),
      headers: await _getHeaders(),
      body: jsonEncode({'message': message, 'user_id': userId}),
    );
    return jsonDecode(response.body);
  }

  // Announcements
  static Future<List<dynamic>> getAnnouncements() async {
    final response = await http.get(Uri.parse('$baseUrl/api/announcements'), headers: await _getHeaders());
    final data = jsonDecode(response.body);
    return data['announcements'] ?? [];
  }

  // Documents
  static Future<String> downloadDocument(String docType, String empId) async {
    return '$baseUrl/api/documents/download/$docType/$empId';
  }
}
