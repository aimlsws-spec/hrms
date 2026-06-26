
// Safe Global Fetch Interceptor for Production
(function() {
    if (window.__fetchInterceptorAttached) return;
    const originalFetch = window.fetch;
    window.fetch = function(resource, config) {
        if (typeof resource === 'string' && resource.startsWith('/api/') && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
            resource = 'https://hrmsapi.seawindsolution.com' + resource;
        }
        return originalFetch(resource, config);
    };
    window.__fetchInterceptorAttached = true;
})();
// Complete HRMS Portal Translation System
const fullTranslations = {
    en: {
        // Navigation
        'Main': 'Main',
        'Dashboard': 'Dashboard',
        'Employees': 'Employees',
        'Leave Management': 'Leave Management',
        'Shift Management': 'Shift Management',
        'Documents': 'Documents',
        'Task Manager': 'Task Manager',
        'Support Tickets': 'Support Tickets',
        'Remarks': 'Remarks',
        'Attendance': 'Attendance',
        'GPS Attendance': 'GPS Attendance',
        'Attendance Regularization': 'Attendance Regularization',
        'Analytics': 'Analytics',
        'Reports': 'Reports',
        'Settings': 'Settings',
        'Administration': 'Administration',
        'User Management': 'User Management',
        'HR Management': 'HR Management',
        'Preferences': 'Preferences',
        'Logout': 'Logout',
        
        // Dashboard
        'Good Morning': 'Good Morning',
        'Good Afternoon': 'Good Afternoon',
        'Good Evening': 'Good Evening',
        'Welcome to Seawind HRMS - Manage your organization efficiently': 'Welcome to Seawind HRMS - Manage your organization efficiently',
        'Total Employees': 'Total Employees',
        'Leave Balance': 'Leave Balance',
        'Pending Approvals': 'Pending Approvals',
        'Attendance Rate': 'Attendance Rate',
        'Days available': 'Days available',
        'Awaiting action': 'Awaiting action',
        'This month': 'This month',
        'from last month': 'from last month',
        'Recent Employees': 'Recent Employees',
        'Announcements': 'Announcements',
        'Pending Leave Requests': 'Pending Leave Requests',
        'Quick Actions': 'Quick Actions',
        'Apply for Leave': 'Apply for Leave',
        'Mark Attendance': 'Mark Attendance',
        'View Payslip': 'View Payslip',
        'View Reports': 'View Reports',
        'My Leave Balance': 'My Leave Balance',
        'Leave Calendar': 'Leave Calendar',
        'Profile Picture': 'Profile Picture',
        'Upcoming Holidays': 'Upcoming Holidays',
        
        // Common
        'Loading...': 'Loading...',
        'View All': 'View All',
        'Employee': 'Employee',
        'Department': 'Department',
        'Status': 'Status',
        'Loading announcements...': 'Loading announcements...',
        'Loading recent employees...': 'Loading recent employees...',
        'No pending requests': 'No pending requests',
        'Submit new request': 'Submit new request',
        'Check in/out with GPS': 'Check in/out with GPS',
        'Download documents': 'Download documents',
        'Analytics & insights': 'Analytics & insights',
        'totalEmployees': 'Total Employees',
        'leaveBalance': 'Leave Balance',
        'pendingApprovals': 'Pending Approvals',
        'attendanceRate': 'Attendance Rate',
        'daysAvailable': 'Days available',
        'awaitingAction': 'Awaiting action',
        'thisMonth': 'This month',
        'recentEmployees': 'Recent Employees',
        'viewAll': 'View All',
        'employee': 'Employee',
        'department': 'Department',
        'status': 'Status',
        'attendance': 'Attendance',
        'announcements': 'Announcements',
        'pendingLeaveRequests': 'Pending Leave Requests',
        'shiftManagement': 'Shift Management',
        'remarks': 'Remarks',
        'gpsAttendance': 'GPS Attendance',
        'attendanceRegularization': 'Attendance Regularization',
        'Shift Management': 'Shift Management',
        'Remarks': 'Remarks',
        'GPS Attendance': 'GPS Attendance',
        'Attendance Regularization': 'Attendance Regularization',
        'Attendance': 'Attendance',
        'Main': 'Main',
        'Preferences': 'Preferences',
        'dashboard': 'Dashboard',
        'employees': 'Employees',
        'leaves': 'Leave Management',
        'documents': 'Documents',
        'tasks': 'Task Manager',
        'tickets': 'Support Tickets'
    },
    hi: {
        // Navigation
        'Main': 'मुख्य',
        'Dashboard': 'डैशबोर्ड',
        'Employees': 'कर्मचारी',
        'Leave Management': 'छुट्टी प्रबंधन',
        'Shift Management': 'शिफ्ट प्रबंधन',
        'Documents': 'दस्तावेज़',
        'Task Manager': 'कार्य प्रबंधक',
        'Support Tickets': 'सहायता टिकट',
        'Remarks': 'टिप्पणियाँ',
        'Attendance': 'उपस्थिति',
        'GPS Attendance': 'जीपीएस उपस्थिति',
        'Attendance Regularization': 'उपस्थिति नियमितीकरण',
        'Analytics': 'विश्लेषण',
        'Reports': 'रिपोर्ट',
        'Settings': 'सेटिंग्स',
        'Administration': 'प्रशासन',
        'User Management': 'उपयोगकर्ता प्रबंधन',
        'HR Management': 'एचआर प्रबंधन',
        'Preferences': 'प्राथमिकताएं',
        'Logout': 'लॉग आउट',
        
        // Dashboard
        'Good Morning': 'सुप्रभात',
        'Good Afternoon': 'शुभ दोपहर',
        'Good Evening': 'शुभ संध्या',
        'Welcome to Seawind HRMS - Manage your organization efficiently': 'सीविंड एचआरएमएस में आपका स्वागत है - अपने संगठन को कुशलता से प्रबंधित करें',
        'Total Employees': 'कुल कर्मचारी',
        'Leave Balance': 'छुट्टी शेष',
        'Pending Approvals': 'लंबित अनुमोदन',
        'Attendance Rate': 'उपस्थिति दर',
        'Days available': 'दिन उपलब्ध',
        'Awaiting action': 'कार्रवाई की प्रतीक्षा',
        'This month': 'इस महीने',
        'from last month': 'पिछले महीने से',
        'Recent Employees': 'हाल के कर्मचारी',
        'Announcements': 'घोषणाएं',
        'Pending Leave Requests': 'लंबित छुट्टी अनुरोध',
        'Quick Actions': 'त्वरित कार्य',
        'Apply for Leave': 'छुट्टी के लिए आवेदन करें',
        'Mark Attendance': 'उपस्थिति चिह्नित करें',
        'View Payslip': 'वेतन पर्ची देखें',
        'View Reports': 'रिपोर्ट देखें',
        'My Leave Balance': 'मेरी छुट्टी शेष',
        'Leave Calendar': 'छुट्टी कैलेंडर',
        'Profile Picture': 'प्रोफ़ाइल चित्र',
        'Upcoming Holidays': 'आगामी छुट्टियां',
        
        // Common
        'Loading...': 'लोड हो रहा है...',
        'View All': 'सभी देखें',
        'Employee': 'कर्मचारी',
        'Department': 'विभाग',
        'Status': 'स्थिति',
        'Loading announcements...': 'घोषणाएं लोड हो रही हैं...',
        'Loading recent employees...': 'हाल के कर्मचारी लोड हो रहे हैं...',
        'No pending requests': 'कोई लंबित अनुरोध नहीं',
        'Submit new request': 'नया अनुरोध जमा करें',
        'Check in/out with GPS': 'जीपीएस के साथ चेक इन/आउट',
        'Download documents': 'दस्तावेज़ डाउनलोड करें',
        'Analytics & insights': 'विश्लेषण और अंतर्दृष्टि',
        'totalEmployees': 'कुल कर्मचारी',
        'leaveBalance': 'छुट्टी शेष',
        'pendingApprovals': 'लंबित अनुमोदन',
        'attendanceRate': 'उपस्थिति दर',
        'daysAvailable': 'दिन उपलब्ध',
        'awaitingAction': 'कार्रवाई की प्रतीक्षा',
        'thisMonth': 'इस महीने',
        'recentEmployees': 'हाल के कर्मचारी',
        'viewAll': 'सभी देखें',
        'employee': 'कर्मचारी',
        'department': 'विभाग',
        'status': 'स्थिति',
        'attendance': 'उपस्थिति',
        'announcements': 'घोषणाएं',
        'pendingLeaveRequests': 'लंबित छुट्टी अनुरोध',
        'shiftManagement': 'शिफ्ट प्रबंधन',
        'remarks': 'टिप्पणियाँ',
        'gpsAttendance': 'जीपीएस उपस्थिति',
        'attendanceRegularization': 'उपस्थिति नियमितीकरण',
        'Shift Management': 'शिफ्ट प्रबंधन',
        'Remarks': 'टिप्पणियाँ',
        'GPS Attendance': 'जीपीएस उपस्थिति',
        'Attendance Regularization': 'उपस्थिति नियमितीकरण',
        'Attendance': 'उपस्थिति',
        'Main': 'मुख्य',
        'Preferences': 'प्राथमिकताएं',
        'dashboard': 'डैशबोर्ड',
        'employees': 'कर्मचारी',
        'leaves': 'छुट्टी प्रबंधन',
        'documents': 'दस्तावेज़',
        'tasks': 'कार्य प्रबंधक',
        'tickets': 'सहायता टिकट'
    },
    gu: {
        // Navigation
        'Main': 'મુખ્ય',
        'Dashboard': 'ડેશબોર્ડ',
        'Employees': 'કર્મચારીઓ',
        'Leave Management': 'રજા વ્યવસ્થાપન',
        'Shift Management': 'શિફ્ટ વ્યવસ્થાપન',
        'Documents': 'દસ્તાવેજો',
        'Task Manager': 'કાર્ય વ્યવસ્થાપક',
        'Support Tickets': 'સહાય ટિકિટ',
        'Remarks': 'ટિપ્પણીઓ',
        'Attendance': 'હાજરી',
        'GPS Attendance': 'જીપીએસ હાજરી',
        'Attendance Regularization': 'હાજરી નિયમિતીકરણ',
        'Analytics': 'વિશ્લેષણ',
        'Reports': 'અહેવાલ',
        'Settings': 'સેટિંગ્સ',
        'Administration': 'વહીવટ',
        'User Management': 'વપરાશકર્તા વ્યવસ્થાપન',
        'HR Management': 'એચઆર વ્યવસ્થાપન',
        'Preferences': 'પસંદગીઓ',
        'Logout': 'લોગ આઉટ',
        
        // Dashboard
        'Good Morning': 'સુપ્રભાત',
        'Good Afternoon': 'શુભ બપોર',
        'Good Evening': 'શુભ સાંજ',
        'Welcome to Seawind HRMS - Manage your organization efficiently': 'સીવિન્ડ એચઆરએમએસમાં આપનું સ્વાગત છે - તમારી સંસ્થાને કુશળતાપૂર્વક સંચાલિત કરો',
        'Total Employees': 'કુલ કર્મચારીઓ',
        'Leave Balance': 'રજા બાકી',
        'Pending Approvals': 'બાકી મંજૂરીઓ',
        'Attendance Rate': 'હાજરી દર',
        'Days available': 'દિવસો ઉપલબ્ધ',
        'Awaiting action': 'કાર્યવાહીની રાહ',
        'This month': 'આ મહિને',
        'from last month': 'ગયા મહિનાથી',
        'Recent Employees': 'તાજેતરના કર્મચારીઓ',
        'Announcements': 'જાહેરાતો',
        'Pending Leave Requests': 'બાકી રજા વિનંતીઓ',
        'Quick Actions': 'ઝડપી ક્રિયાઓ',
        'Apply for Leave': 'રજા માટે અરજી કરો',
        'Mark Attendance': 'હાજરી ચિહ્નિત કરો',
        'View Payslip': 'પગાર પર્ચી જુઓ',
        'View Reports': 'અહેવાલ જુઓ',
        'My Leave Balance': 'મારી રજા બાકી',
        'Leave Calendar': 'રજા કેલેન્ડર',
        'Profile Picture': 'પ્રોફાઇલ ચિત્ર',
        'Upcoming Holidays': 'આગામી રજાઓ',
        
        // Common
        'Loading...': 'લોડ થઈ રહ્યું છે...',
        'View All': 'બધા જુઓ',
        'Employee': 'કર્મચારી',
        'Department': 'વિભાગ',
        'Status': 'સ્થિતિ',
        'Loading announcements...': 'જાહેરાતો લોડ થઈ રહી છે...',
        'Loading recent employees...': 'તાજેતરના કર્મચારીઓ લોડ થઈ રહ્યા છે...',
        'No pending requests': 'કોઈ બાકી વિનંતીઓ નથી',
        'Submit new request': 'નવી વિનંતી સબમિટ કરો',
        'Check in/out with GPS': 'જીપીએસ સાથે ચેક ઇન/આઉટ',
        'Download documents': 'દસ્તાવેજો ડાઉનલોડ કરો',
        'Analytics & insights': 'વિશ્લેષણ અને આંતરદૃષ્ટિ',
        'totalEmployees': 'કુલ કર્મચારીઓ',
        'leaveBalance': 'રજા બાકી',
        'pendingApprovals': 'બાકી મંજૂરીઓ',
        'attendanceRate': 'હાજરી દર',
        'daysAvailable': 'દિવસો ઉપલબ્ધ',
        'awaitingAction': 'કાર્યવાહીની રાહ',
        'thisMonth': 'આ મહિને',
        'recentEmployees': 'તાજેતરના કર્મચારીઓ',
        'viewAll': 'બધા જુઓ',
        'employee': 'કર્મચારી',
        'department': 'વિભાગ',
        'status': 'સ્થિતિ',
        'attendance': 'હાજરી',
        'announcements': 'જાહેરાતો',
        'pendingLeaveRequests': 'બાકી રજા વિનંતીઓ',
        'shiftManagement': 'શિફ્ટ વ્યવસ્થાપન',
        'remarks': 'ટિપ્પણીઓ',
        'gpsAttendance': 'જીપીએસ હાજરી',
        'attendanceRegularization': 'હાજરી નિયમિતીકરણ',
        'Shift Management': 'શિફ્ટ વ્યવસ્થાપન',
        'Remarks': 'ટિપ્પણીઓ',
        'GPS Attendance': 'જીપીએસ હાજરી',
        'Attendance Regularization': 'હાજરી નિયમિતીકરણ',
        'Attendance': 'હાજરી',
        'Main': 'મુખ્ય',
        'Preferences': 'પસંદગીઓ',
        'dashboard': 'ડેશબોર્ડ',
        'employees': 'કર્મચારીઓ',
        'leaves': 'રજા વ્યવસ્થાપન',
        'documents': 'દસ્તાવેજો',
        'tasks': 'કાર્ય વ્યવસ્થાપક',
        'tickets': 'સહાય ટિકિટ'
    }
};

// Auto-translate function
function translatePage(lang) {
    console.log('translatePage called with language:', lang);
    if (!fullTranslations[lang]) {
        console.error('No translations found for language:', lang);
        return;
    }
    
    const trans = fullTranslations[lang];
    console.log('Translation keys available:', Object.keys(trans).length);
    
    // Translate elements with data-translate attribute (these have the original keys)
    const elements = document.querySelectorAll('[data-translate]');
    console.log('Found elements with data-translate:', elements.length);
    
    elements.forEach(el => {
        const key = el.getAttribute('data-translate');
        if (trans[key]) {
            console.log('Translating:', key, '->', trans[key]);
            el.textContent = trans[key];
        } else {
            console.warn('No translation for key:', key);
        }
    });
    
    console.log('Translation complete');
}

// Change language function
function changeLanguage(lang) {
    console.log('changeLanguage called with:', lang);
    localStorage.setItem('hrms_language', lang);
    translatePage(lang);
    
    // Update the select dropdown
    const select = document.getElementById('languageSelect');
    if (select) {
        select.value = lang;
    }
}

// Export
window.fullTranslations = fullTranslations;
window.translatePage = translatePage;
window.changeLanguage = changeLanguage;

// Auto-translate on load if language is saved
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        const savedLang = localStorage.getItem('hrms_language') || 'en';
        console.log('Saved language:', savedLang);
        
        // Set the dropdown to saved language
        const select = document.getElementById('languageSelect');
        if (select) {
            select.value = savedLang;
        }
        
        if (savedLang && savedLang !== 'en') {
            console.log('Auto-translating to saved language:', savedLang);
            setTimeout(() => translatePage(savedLang), 1000);
        }
    });
}
