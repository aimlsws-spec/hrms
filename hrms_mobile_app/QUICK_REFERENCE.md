# 📋 HRMS Mobile App - Quick Reference Card

## 🚀 Quick Start (30 seconds)
```bash
# 1. Update IP in lib/services/api_service.dart line 7
# 2. Run:
flutter pub get && flutter run
```

## 📁 Key Files

| File | Purpose | Status |
|------|---------|--------|
| `lib/services/api_service.dart` | All API calls | ✅ Complete |
| `lib/main.dart` | App entry & theme | ✅ Complete |
| `lib/screens/login_screen.dart` | Login & OTP | ✅ Complete |
| `lib/screens/dashboards/employee_dashboard.dart` | Employee dashboard | ✅ Complete |
| `lib/screens/dashboards/admin_dashboard.dart` | Admin dashboard | 🔨 Template |
| `lib/screens/dashboards/hr_dashboard.dart` | HR dashboard | 🔨 Template |
| `lib/screens/dashboards/accountant_dashboard.dart` | Accountant dashboard | 🔨 Template |
| `lib/screens/dashboards/support_dashboard.dart` | Support dashboard | 🔨 Template |
| `lib/utils/constants.dart` | All constants | ✅ Complete |

## 🎨 Customization Quick Guide

### Change Logo (3 places)
```dart
// 1. lib/main.dart line 95
// 2. lib/screens/login_screen.dart line 135
// 3. All dashboard headers
Icon(Icons.business_center) → Image.asset('assets/images/logo.png')
```

### Change Colors
```dart
// lib/utils/constants.dart lines 12-16
static const Color primaryColor = Color(0xFFYOURCOLOR);
```

### Change API URL
```dart
// lib/services/api_service.dart line 7
static const String baseUrl = 'http://YOUR_IP:8000';
```

## 🔧 Common API Calls

```dart
// Authentication
await ApiService.login(username, password);
await ApiService.verifyOtp(username, otp);

// Dashboard
await ApiService.getDashboardStats();
await ApiService.getAnalyticsOverview();

// Employees
await ApiService.getAllEmployees();
await ApiService.searchEmployees(query);

// Attendance
await ApiService.gpsCheckIn(employeeId, lat, lng, location);
await ApiService.gpsCheckOut(employeeId, lat, lng, location);
await ApiService.getAttendanceHistory(employeeId);

// Leave
await ApiService.applyLeave(leaveData);
await ApiService.getMyLeaves(employeeId);
await ApiService.getPendingLeaves();
await ApiService.approveLeave(requestId, approvedBy, comments);
await ApiService.rejectLeave(requestId, rejectedBy, comments);

// Tasks
await ApiService.getMyTasks(userId);
await ApiService.getAllTasks();
await ApiService.createTask(taskData);
await ApiService.updateTask(taskId, taskData);

// Salary
await ApiService.getAllSalaryStructures();
await ApiService.createSalaryStructure(data);
await ApiService.approveSalaryStructure(data);

// Documents
ApiService.getSalarySlipUrl(employeeId);
ApiService.getExperienceLetterUrl(employeeId);

// Announcements
await ApiService.getAnnouncements();
await ApiService.createAnnouncement(data);

// Reports
await ApiService.getEmployeeSummaryReport();
await ApiService.getDepartmentReport();
await ApiService.getPayrollReport();
```

## 🎯 Development Pattern

### 1. Create State Variables
```dart
String _userName = '';
bool _isLoading = true;
List<dynamic> _data = [];
```

### 2. Load Data in initState
```dart
@override
void initState() {
  super.initState();
  _loadData();
}
```

### 3. Implement Load Function
```dart
Future<void> _loadData() async {
  setState(() => _isLoading = true);
  try {
    final data = await ApiService.someCall();
    setState(() {
      _data = data;
      _isLoading = false;
    });
  } catch (e) {
    setState(() => _isLoading = false);
    _showError('Failed: $e');
  }
}
```

### 4. Build UI with Loading State
```dart
@override
Widget build(BuildContext context) {
  return Scaffold(
    appBar: AppBar(title: Text('Screen')),
    body: RefreshIndicator(
      onRefresh: _loadData,
      child: _isLoading
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Column(children: [
                // Your content
              ]),
            ),
    ),
  );
}
```

## 🎨 UI Components

### Stat Card
```dart
Widget _buildStatCard(String title, String value, IconData icon, Color color) {
  return Card(
    child: Padding(
      padding: EdgeInsets.all(16),
      child: Column(
        children: [
          Icon(icon, color: color, size: 32),
          SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          Text(title, style: TextStyle(fontSize: 12, color: Colors.grey[600])),
        ],
      ),
    ),
  );
}
```

### Action Card
```dart
Widget _buildActionCard(String title, IconData icon, Color color, VoidCallback onTap) {
  return Card(
    child: InkWell(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 32, color: color),
          SizedBox(height: 8),
          Text(title, textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}
```

### List Item
```dart
Widget _buildListItem(Map item) {
  return Card(
    child: ListTile(
      leading: CircleAvatar(child: Icon(Icons.person)),
      title: Text(item['title'] ?? ''),
      subtitle: Text(item['subtitle'] ?? ''),
      trailing: Icon(Icons.arrow_forward_ios, size: 16),
      onTap: () {
        // Handle tap
      },
    ),
  );
}
```

## 🔍 Debugging

### View Logs
```bash
flutter logs
```

### Hot Reload
```bash
# In terminal while app is running:
r  # Hot reload
R  # Hot restart
```

### Check Devices
```bash
flutter devices
```

### Clean Build
```bash
flutter clean
flutter pub get
flutter run
```

## 📦 Build Commands

### Debug APK
```bash
flutter build apk --debug
```

### Release APK
```bash
flutter build apk --release
```

### App Bundle
```bash
flutter build appbundle --release
```

### iOS
```bash
flutter build ios --release
```

## 🎯 Testing Checklist

### Quick Test
- [ ] Login works
- [ ] Dashboard loads
- [ ] Data shows from MySQL
- [ ] Navigation works
- [ ] Logout works

### Full Test
- [ ] All roles login
- [ ] All dashboards work
- [ ] GPS check-in/out
- [ ] Leave application
- [ ] Task viewing
- [ ] Documents download
- [ ] Announcements show

## 💡 Pro Tips

1. **Always use RefreshIndicator** for pull-to-refresh
2. **Always show loading states** with CircularProgressIndicator
3. **Always handle errors** with try-catch
4. **Always use constants** from constants.dart
5. **Always test on real device** for GPS features

## 🚨 Common Errors & Fixes

### "Connection refused"
- Check IP address in api_service.dart
- Ensure backend is running
- Check same WiFi network

### "GPS not working"
- Add permissions in AndroidManifest.xml
- Test on real device, not emulator

### "Build failed"
- Run: `flutter clean && flutter pub get`
- Check Flutter version: `flutter doctor`

### "Hot reload not working"
- Press `R` for hot restart
- Or stop and run again

## 📊 Project Stats

- **Total Files Created:** 15+
- **API Endpoints:** 50+
- **Completion:** 60%
- **Time to Complete:** 4-6 days
- **Lines of Code:** 5000+

## 🎯 Next Steps

1. ✅ Setup complete
2. 🔨 Complete dashboards (use employee_dashboard.dart as template)
3. 🔨 Enhance feature screens
4. 🔨 Add your logo
5. 🔨 Test thoroughly
6. 🔨 Build & deploy

## 📞 Quick Links

- **Flutter Docs:** https://flutter.dev/docs
- **Dart Docs:** https://dart.dev/guides
- **Material Design:** https://material.io/design
- **Your Backend:** http://YOUR_IP:8000

---

**Keep this card handy while developing!** 📌

**Version:** 2.0.0  
**Status:** Ready for development  
**Estimated completion:** 4-6 days  

**Happy coding! 🚀**
