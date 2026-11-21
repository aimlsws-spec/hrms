"""
Conversation patterns and responses for HRMS AI Assistant
"""

HRMS_PATTERNS = {
    'employee_management': {
        'keywords': ['employee', 'employees', 'staff', 'worker', 'personnel', 'team member', 'colleague'],
        'phrases': ['show all employees', 'list employees', 'employee directory', 'staff list', 'team members']
    },
    'attendance_tracking': {
        'keywords': ['attendance', 'present', 'absent', 'check in', 'check out', 'late', 'early'],
        'phrases': ['today attendance', 'attendance report', 'who is present', 'attendance summary']
    },
    'leave_management': {
        'keywords': ['leave', 'vacation', 'holiday', 'sick leave', 'casual leave', 'time off'],
        'phrases': ['apply for leave', 'leave request', 'leave balance', 'pending leaves']
    },
    'payroll_salary': {
        'keywords': ['salary', 'payroll', 'pay', 'wages', 'compensation', 'bonus', 'deduction'],
        'phrases': ['salary slip', 'pay details', 'payroll report', 'salary certificate']
    },
    'performance_review': {
        'keywords': ['performance', 'review', 'appraisal', 'rating', 'evaluation', 'feedback'],
        'phrases': ['performance review', 'employee rating', 'appraisal report']
    },
    'training_development': {
        'keywords': ['training', 'development', 'course', 'skill', 'learning', 'certification'],
        'phrases': ['training programs', 'skill development', 'course enrollment']
    },
    'document_generation': {
        'keywords': ['document', 'certificate', 'letter', 'report', 'generate', 'create', 'offer', 'appointment', 'experience', 'salary slip', 'payslip'],
        'phrases': ['experience certificate', 'salary certificate', 'employment letter', 'offer letter', 'appointment letter', 'job offer', 'generate offer', 'create offer letter', 'salary slip', 'pay slip', 'payslip']
    },
    'reports_analytics': {
        'keywords': ['report', 'analytics', 'statistics', 'data', 'metrics', 'dashboard'],
        'phrases': ['monthly report', 'attendance report', 'department analytics']
    },
    'user_management': {
        'keywords': ['user', 'users', 'account', 'login', 'credentials', 'access'],
        'phrases': ['show users', 'user list', 'manage users', 'user accounts']
    },
    'system_portal': {
        'keywords': ['system', 'portal', 'hrms', 'dashboard', 'platform', 'features'],
        'phrases': ['system features', 'portal capabilities', 'hrms overview']
    }
}

CONVERSATION_STARTERS = {
    'greetings': ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'namaste', 'how are you'],
    'farewells': ['bye', 'goodbye', 'see you', 'take care', 'farewell', 'exit', 'quit'],
    'help_requests': ['help', 'assist', 'support', 'guide', 'what can you do', 'features']
}

CONTEXTUAL_RESPONSES = {
    'morning': "Good morning! Ready to start the day with some HR tasks?",
    'afternoon': "Good afternoon! How can I help you with HRMS today?",
    'evening': "Good evening! What HR assistance do you need?"
}

SMART_SUGGESTIONS = {
    'admin_user': [
        "View system analytics",
        "Manage user accounts", 
        "Generate compliance reports",
        "Review pending approvals",
        "Check system health"
    ],
    'hr_user': [
        "Process leave requests",
        "Generate employee reports",
        "Create employment documents",
        "Review attendance patterns",
        "Manage employee onboarding"
    ],
    'employee_user': [
        "Check my attendance",
        "View leave balance",
        "Apply for leave",
        "Download salary slip",
        "Update personal details"
    ]
}

FALLBACK_RESPONSES = [
    "I'm here to help with HRMS tasks! Try asking about employees, attendance, or leave management.",
    "Not sure what you mean? I can help with HR queries like 'show all employees' or 'check attendance'.",
    "Let me help you with HRMS! Ask me about employees, leaves, payroll, or any HR-related topic.",
    "I specialize in HR assistance! Try queries like 'employee list', 'attendance report', or 'apply for leave'.",
    "I'm your HRMS assistant! I can help with employee management, attendance tracking, and much more."
]

MULTILINGUAL_PATTERNS = {
    'hindi': {
        'greetings': ['namaste', 'namaskar', 'aap kaise hain'],
        'employee': ['karmchari', 'staff', 'team member'],
        'attendance': ['haaziri', 'upasthiti']
    },
    'gujarati': {
        'greetings': ['kem cho', 'namaste', 'aap kem cho'],
        'employee': ['karmchari', 'nokri karta', 'team member'],
        'attendance': ['haaziri', 'upasthiti']
    }
}