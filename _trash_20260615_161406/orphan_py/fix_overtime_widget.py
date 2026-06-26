"""
Fix Overtime Widget - Remove from wrong location and fix JavaScript
"""

# Read the enterprise portal
with open('enterprise_portal.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and remove the widget that was added (it's between line 1160-1340 approximately)
# We'll search for the comment marker
start_marker = "                <!-- Employee Overtime Widget -->"
end_marker = "</script>"

# Find the widget section
start_idx = content.find(start_marker)
if start_idx == -1:
    print("[ERROR] Widget not found")
    exit(1)

# Find the end of the widget (after the closing script tag)
end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print("[ERROR] Widget end not found")
    exit(1)

# Include the closing script tag
end_idx = end_idx + len(end_marker) + 1

# Remove the widget
content_before = content[:start_idx]
content_after = content[end_idx:]

# Now add it back in the correct location - inside employee-analytics-view div
# Find the employee-analytics-view section
analytics_marker = '<div id="employee-analytics-view" style="display: none;">'
analytics_idx = content_before.find(analytics_marker)

if analytics_idx == -1:
    print("[ERROR] Employee analytics view not found")
    exit(1)

# Find the end of employee-analytics-view (before the closing </div></div>)
# Look for the card with employeeDashboardContent
dashboard_card_end = content_before.find('</div>\n                    </div>\n                </div>\n            </div>\n\n            <!-- Reports Section -->')

if dashboard_card_end == -1:
    print("[ERROR] Dashboard card end not found")
    exit(1)

# Create the fixed widget with proper scoping
fixed_widget = '''
                    <!-- Employee Overtime Widget -->
                    <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-top: 20px;">
                        <div class="card-header" style="border-bottom: 1px solid rgba(255,255,255,0.2);">
                            <div class="card-title" style="color: white;">
                                <i class="fas fa-clock"></i> My Overtime Hours
                            </div>
                        </div>
                        <div class="card-content">
                            <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                                <select id="empOvertimeMonth" style="padding: 8px 12px; border-radius: 6px; border: none; font-size: 14px;">
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10">October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                </select>
                                <select id="empOvertimeYear" style="padding: 8px 12px; border-radius: 6px; border: none; font-size: 14px;">
                                    <option value="2024">2024</option>
                                    <option value="2025">2025</option>
                                </select>
                                <button onclick="loadMyOvertime()" style="background: rgba(255,255,255,0.3); border: none; padding: 8px 16px; border-radius: 6px; color: white; cursor: pointer; font-weight: 500;">
                                    <i class="fas fa-sync-alt"></i> Refresh
                                </button>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: 600; margin-bottom: 5px;" id="empTotalHours">--</div>
                                    <div style="font-size: 12px; opacity: 0.9;">Total Hours</div>
                                </div>
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: 600; margin-bottom: 5px;" id="empOvertimeHours">--</div>
                                    <div style="font-size: 12px; opacity: 0.9;">Overtime Hours</div>
                                </div>
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: 600; margin-bottom: 5px;" id="empOvertimeAmount">--</div>
                                    <div style="font-size: 12px; opacity: 0.9;">Overtime Amount</div>
                                </div>
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: 600; margin-bottom: 5px;" id="empDaysPresent">--</div>
                                    <div style="font-size: 12px; opacity: 0.9;">Days Present</div>
                                </div>
                            </div>
                            
                            <div style="margin-top: 15px; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 13px;">
                                <i class="fas fa-info-circle"></i> 
                                Standard: 8 hours/day × 22 days = 176 hours/month | Overtime Rate: 1.5×
                            </div>
                        </div>
                    </div>
'''

# Insert the widget before the closing of employee-analytics-view
new_content = content_before[:dashboard_card_end] + fixed_widget + content_before[dashboard_card_end:] + content_after

# Write back
with open('enterprise_portal.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("[OK] Overtime widget fixed and moved to Analytics section only")
print("[OK] Widget will only appear for employees in Analytics section")
print("[OK] JavaScript will be called from existing loadEmployeeAnalytics() function")
