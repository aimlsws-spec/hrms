import 'package:flutter/material.dart';

/// App Constants - Customize your app here
class AppConstants {
  // App Information
  static const String appName = 'HRMS Mobile';
  static const String appVersion = '2.0.0';
  static const String companyName = 'Your Company Name';
  
  // API Configuration
  // IMPORTANT: Change this to your computer's IP address
  static const String apiBaseUrl = 'http://192.168.1.33:8000';
  
  // App Colors
  static const Color primaryColor = Color(0xFF2196F3);
  static const Color primaryDark = Color(0xFF1976D2);
  static const Color accentColor = Color(0xFF0D47A1);
  static const Color backgroundColor = Color(0xFFF5F7FA);
  
  // Status Colors
  static const Color successColor = Colors.green;
  static const Color warningColor = Colors.orange;
  static const Color errorColor = Colors.red;
  static const Color infoColor = Colors.blue;
  
  // Text Sizes
  static const double headingSize = 24.0;
  static const double subheadingSize = 18.0;
  static const double bodySize = 14.0;
  static const double captionSize = 12.0;
  
  // Spacing
  static const double paddingSmall = 8.0;
  static const double paddingMedium = 16.0;
  static const double paddingLarge = 24.0;
  
  // Border Radius
  static const double borderRadiusSmall = 8.0;
  static const double borderRadiusMedium = 12.0;
  static const double borderRadiusLarge = 16.0;
  
  // Animation Durations
  static const Duration shortDuration = Duration(milliseconds: 200);
  static const Duration mediumDuration = Duration(milliseconds: 300);
  static const Duration longDuration = Duration(milliseconds: 500);
  
  // API Timeouts
  static const Duration apiTimeout = Duration(seconds: 30);
  static const Duration connectionTimeout = Duration(seconds: 10);
  
  // Pagination
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;
  
  // Date Formats
  static const String dateFormat = 'dd MMM yyyy';
  static const String timeFormat = 'hh:mm a';
  static const String dateTimeFormat = 'dd MMM yyyy, hh:mm a';
  
  // Validation
  static const int minPasswordLength = 6;
  static const int maxPasswordLength = 20;
  static const int otpLength = 6;
  
  // GPS
  static const double geofenceRadius = 100.0; // meters
  static const double locationAccuracy = 10.0; // meters
  
  // File Upload
  static const int maxFileSize = 10 * 1024 * 1024; // 10 MB
  static const List<String> allowedImageTypes = ['jpg', 'jpeg', 'png'];
  static const List<String> allowedDocTypes = ['pdf', 'doc', 'docx'];
  
  // Cache
  static const Duration cacheExpiry = Duration(hours: 24);
  static const int maxCacheSize = 50 * 1024 * 1024; // 50 MB
  
  // Roles
  static const String roleAdmin = 'admin';
  static const String roleHR = 'hr';
  static const String roleAccountant = 'accountant';
  static const String roleSupport = 'support';
  static const String roleEmployee = 'employee';
  
  // Leave Types
  static const List<String> leaveTypes = [
    'Casual Leave',
    'Sick Leave',
    'Earned Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Unpaid Leave',
  ];
  
  // Task Priorities
  static const List<String> taskPriorities = ['Low', 'Medium', 'High'];
  
  // Task Statuses
  static const List<String> taskStatuses = [
    'To Do',
    'In Progress',
    'Completed',
  ];
  
  // Ticket Categories
  static const List<String> ticketCategories = [
    'Technical',
    'HR',
    'Payroll',
    'Leave',
    'Attendance',
    'Other',
  ];
  
  // Ticket Priorities
  static const List<String> ticketPriorities = ['Low', 'Medium', 'High', 'Critical'];
  
  // Shift Types
  static const List<String> shiftTypes = [
    'General',
    'Morning',
    'Evening',
    'Night',
    'Rotational',
  ];
}

/// App Theme
class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      primaryColor: AppConstants.primaryColor,
      scaffoldBackgroundColor: AppConstants.backgroundColor,
      useMaterial3: true,
      fontFamily: 'Poppins',
      
      // AppBar Theme
      appBarTheme: const AppBarTheme(
        elevation: 0,
        centerTitle: true,
        backgroundColor: AppConstants.primaryColor,
        foregroundColor: Colors.white,
      ),
      
      // Card Theme
      cardTheme: CardTheme(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppConstants.borderRadiusMedium),
        ),
      ),
      
      // Button Theme
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          padding: const EdgeInsets.symmetric(
            horizontal: 32,
            vertical: 16,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppConstants.borderRadiusMedium),
          ),
        ),
      ),
      
      // Input Decoration Theme
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppConstants.borderRadiusMedium),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppConstants.borderRadiusMedium),
          borderSide: BorderSide(color: Colors.grey.shade300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppConstants.borderRadiusMedium),
          borderSide: const BorderSide(
            color: AppConstants.primaryColor,
            width: 2,
          ),
        ),
      ),
      
      // Color Scheme
      colorScheme: const ColorScheme.light(
        primary: AppConstants.primaryColor,
        secondary: AppConstants.accentColor,
        error: AppConstants.errorColor,
        background: AppConstants.backgroundColor,
      ),
    );
  }
}

/// App Strings
class AppStrings {
  // Common
  static const String ok = 'OK';
  static const String cancel = 'Cancel';
  static const String save = 'Save';
  static const String delete = 'Delete';
  static const String edit = 'Edit';
  static const String submit = 'Submit';
  static const String loading = 'Loading...';
  static const String noData = 'No data available';
  static const String error = 'Error';
  static const String success = 'Success';
  
  // Auth
  static const String login = 'Login';
  static const String logout = 'Logout';
  static const String username = 'Username';
  static const String password = 'Password';
  static const String otp = 'OTP';
  static const String verifyOtp = 'Verify OTP';
  static const String welcomeBack = 'Welcome Back';
  static const String signInToContinue = 'Sign in to continue';
  
  // Dashboard
  static const String dashboard = 'Dashboard';
  static const String quickActions = 'Quick Actions';
  static const String announcements = 'Announcements';
  static const String myTasks = 'My Tasks';
  static const String viewAll = 'View All';
  
  // Attendance
  static const String attendance = 'Attendance';
  static const String checkIn = 'Check In';
  static const String checkOut = 'Check Out';
  static const String attendanceHistory = 'Attendance History';
  
  // Leave
  static const String leave = 'Leave';
  static const String applyLeave = 'Apply Leave';
  static const String leaveBalance = 'Leave Balance';
  static const String leaveHistory = 'Leave History';
  static const String pendingLeaves = 'Pending Leaves';
  
  // Tasks
  static const String tasks = 'Tasks';
  static const String createTask = 'Create Task';
  static const String taskDetails = 'Task Details';
  static const String assignTask = 'Assign Task';
  
  // Profile
  static const String profile = 'My Profile';
  static const String personalInfo = 'Personal Information';
  static const String documents = 'Documents';
  static const String salaryInfo = 'Salary Information';
  
  // Errors
  static const String connectionError = 'Connection error. Please check your internet.';
  static const String serverError = 'Server error. Please try again later.';
  static const String invalidCredentials = 'Invalid username or password';
  static const String sessionExpired = 'Session expired. Please login again.';
}

/// App Assets
class AppAssets {
  // Images
  static const String logo = 'assets/images/logo.png';
  static const String placeholder = 'assets/images/placeholder.png';
  
  // Icons
  static const String iconAttendance = 'assets/icons/attendance.png';
  static const String iconLeave = 'assets/icons/leave.png';
  static const String iconTasks = 'assets/icons/tasks.png';
  static const String iconProfile = 'assets/icons/profile.png';
}

/// Helper Functions
class AppHelpers {
  /// Format date
  static String formatDate(DateTime date) {
    return '${date.day} ${_getMonthName(date.month)} ${date.year}';
  }
  
  /// Format time
  static String formatTime(DateTime time) {
    final hour = time.hour > 12 ? time.hour - 12 : time.hour;
    final minute = time.minute.toString().padLeft(2, '0');
    final period = time.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }
  
  /// Get month name
  static String _getMonthName(int month) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return months[month - 1];
  }
  
  /// Get status color
  static Color getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'completed':
      case 'active':
        return AppConstants.successColor;
      case 'pending':
      case 'in progress':
        return AppConstants.warningColor;
      case 'rejected':
      case 'cancelled':
      case 'inactive':
        return AppConstants.errorColor;
      default:
        return AppConstants.infoColor;
    }
  }
  
  /// Get priority color
  static Color getPriorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'high':
      case 'critical':
        return AppConstants.errorColor;
      case 'medium':
        return AppConstants.warningColor;
      case 'low':
        return AppConstants.successColor;
      default:
        return AppConstants.infoColor;
    }
  }
  
  /// Validate email
  static bool isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }
  
  /// Validate phone
  static bool isValidPhone(String phone) {
    return RegExp(r'^\d{10}$').hasMatch(phone);
  }
  
  /// Show snackbar
  static void showSnackBar(BuildContext context, String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppConstants.errorColor : AppConstants.successColor,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
  
  /// Show loading dialog
  static void showLoadingDialog(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
  
  /// Hide loading dialog
  static void hideLoadingDialog(BuildContext context) {
    Navigator.of(context).pop();
  }
}
