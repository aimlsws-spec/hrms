"""
Clean up all overtime widgets and add only ONE in the correct place
"""

with open('enterprise_portal.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove ALL instances of the overtime widget
# Find all occurrences of the widget marker
marker = "<!-- Employee Overtime Widget"
count = 0

while marker in content:
    start_idx = content.find(marker)
    if start_idx == -1:
        break
    
    # Find the end of this widget instance (look for the closing script tag)
    end_idx = content.find("</script>", start_idx)
    if end_idx == -1:
        break
    
    # Find the next line after </script>
    end_idx = content.find("\n", end_idx) + 1
    
    # Remove this instance
    content = content[:start_idx] + content[end_idx:]
    count += 1
    print(f"[INFO] Removed widget instance {count}")

print(f"[OK] Removed {count} widget instances")

# Now add ONE widget in the correct place
# Find the employee-analytics-view section and add it at the end (before closing </div>)
search_text = '''                    <div class="card">
                        <div class="card-header">
                            <div class="card-title">Your Statistics</div>
                        </div>
                        <div class="card-content" id="employeeDashboardContent">
                            <p style="color: #64748b;">Loading your dashboard...</p>
                        </div>
                    </div>
                </div>'''

insert_idx = content.find(search_text)
if insert_idx == -1:
    print("[ERROR] Could not find insertion point")
    exit(1)

# Find the end of the "Your Statistics" card
card_end = insert_idx + len(search_text)

# Create the widget (inline styles, no separate CSS)
widget = '''
                    
                    <!-- Employee Overtime Widget -->
                    <div class="card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-top: 20px;">
                        <div class="card-header" style="border-bottom: 1px solid rgba(255,255,255,0.2);">
                            <div class="card-title" style="color: white;">
                                <i class="fas fa-clock"></i> My Overtime Hours
                            </div>
                        </div>
                        <div class="card-content">
                            <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                                <select id="empOvertimeMonth" style="padding: 8px 12px; border-radius: 6px; border: none;">
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
                                <select id="empOvertimeYear" style="padding: 8px 12px; border-radius: 6px; border: none;">
                                    <option value="2024">2024</option>
                                    <option value="2025">2025</option>
                                </select>
                                <button onclick="loadMyOvertime()" style="background: rgba(255,255,255,0.3); border: none; padding: 8px 16px; border-radius: 6px; color: white; cursor: pointer;">
                                    <i class="fas fa-sync-alt"></i> Refresh
                                </button>
                            </div>
                            
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: 600;" id="empTotalHours">--</div>
                                    <div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">Total Hours</div>
                                </div>
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: 600;" id="empOvertimeHours">--</div>
                                    <div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">Overtime Hours</div>
                                </div>
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: 600;" id="empOvertimeAmount">--</div>
                                    <div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">Overtime Amount</div>
                                </div>
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; text-align: center;">
                                    <div style="font-size: 24px; font-weight: 600;" id="empDaysPresent">--</div>
                                    <div style="font-size: 12px; opacity: 0.9; margin-top: 5px;">Days Present</div>
                                </div>
                            </div>
                            
                            <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 12px;">
                                <i class="fas fa-info-circle"></i> Standard: 8 hrs/day × 22 days = 176 hrs/month | OT Rate: 1.5×
                            </div>
                        </div>
                    </div>
'''

# Insert the widget
content = content[:card_end] + widget + content[card_end:]

# Write back
with open('enterprise_portal.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("[OK] Added ONE overtime widget in Analytics section")
print("[OK] Widget will only show for employees in Analytics section")
print("[OK] Refresh your browser to see the changes")
