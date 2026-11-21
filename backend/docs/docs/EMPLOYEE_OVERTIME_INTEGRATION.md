# Employee Overtime Widget - Integration Guide

## 📋 What Employees Can See

### ✅ Employees CAN:
- View their **own** overtime hours
- See their **own** overtime amount
- Check their attendance days
- Select different months to view history
- See total hours worked

### ❌ Employees CANNOT:
- Process payroll (Admin only)
- See other employees' overtime
- See company-wide summaries
- Access accountant dashboard

## 🚀 How to Integrate

### Option 1: Copy-Paste into Enterprise Portal

1. Open `enterprise_portal.html`
2. Find a good location (e.g., in the dashboard section)
3. Copy the entire content from `employee_overtime_widget.html`
4. Paste it where you want the widget to appear

### Option 2: Add as a Card in Dashboard

Add this code to your employee dashboard section:

```html
<!-- In enterprise_portal.html, find the dashboard cards section -->

<!-- Add this overtime card -->
<div class="dashboard-card">
    <div class="overtime-widget" id="employeeOvertimeWidget">
        <!-- Copy content from employee_overtime_widget.html here -->
    </div>
</div>
```

### Option 3: Add as a New Tab

If you have tabs in the employee portal:

```html
<!-- Add tab button -->
<button class="tab" onclick="showTab('overtime')">My Overtime</button>

<!-- Add tab content -->
<div id="overtime" class="tab-content">
    <!-- Copy content from employee_overtime_widget.html here -->
</div>
```

## 🔒 Security Features

### Automatic User Detection
The widget automatically:
- Gets the logged-in user's ID from `localStorage`
- Only fetches **their own** data
- Cannot access other employees' data

### API Endpoint Used
```javascript
GET /api/payroll/overtime/{employee_id}?month=12&year=2024
```

The backend already validates that users can only see their own data.

## 🎨 Widget Features

### Visual Display
- **Purple gradient background** - Matches HRMS theme
- **4 metric cards** showing:
  1. Total Hours Worked
  2. Overtime Hours
  3. Overtime Amount (₹)
  4. Days Present
- **Month/Year selector** - View historical data
- **Refresh button** - Update data
- **Info footer** - Shows calculation formula

### Responsive Design
- Works on desktop and mobile
- Grid layout adapts to screen size
- Clean, modern interface

## 📊 What Data is Shown

### Example Display:
```
My Overtime Hours
[December] [2025] [Refresh]

┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 192.5        │ 16.5         │ ₹3,750       │ 22           │
│ Total Hours  │ Overtime Hrs │ OT Amount    │ Days Present │
└──────────────┴──────────────┴──────────────┴──────────────┘

ℹ Standard: 8 hours/day × 22 days = 176 hours/month | OT Rate: 1.5×
```

## 🔧 Customization Options

### Change Colors
```css
.overtime-widget {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    /* Change to your preferred gradient */
}
```

### Change Layout
```css
.overtime-stats {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    /* Adjust minmax values for different card sizes */
}
```

### Hide Specific Metrics
Remove any `.overtime-stat` div you don't want to show.

## 📱 Mobile Responsive

The widget automatically adjusts:
- **Desktop**: 4 cards in a row
- **Tablet**: 2 cards per row
- **Mobile**: 1 card per row

## 🧪 Testing

### Test as Employee:
1. Login as regular employee
2. Navigate to where you added the widget
3. Should see your own overtime data
4. Try changing month/year
5. Click refresh to update

### Test Data Privacy:
1. Login as Employee A
2. Note their overtime hours
3. Logout and login as Employee B
4. Should see different data (Employee B's data)
5. Cannot see Employee A's data

## 💡 Usage Tips

### For Employees:
- Check overtime at end of month
- Verify hours before payroll processing
- Track attendance patterns
- Plan work hours better

### For Admins:
- Employees can self-service their data
- Reduces HR queries about overtime
- Transparent overtime tracking
- Builds trust with employees

## 🎯 Integration Checklist

- [ ] Copy widget HTML to enterprise portal
- [ ] Copy widget CSS styles
- [ ] Copy widget JavaScript
- [ ] Test with employee login
- [ ] Verify data privacy
- [ ] Test month/year selection
- [ ] Test refresh button
- [ ] Check mobile responsiveness

## 📝 Quick Integration Code

**Minimal integration** (add anywhere in enterprise_portal.html):

```html
<!-- Add this in the <head> section for Font Awesome icons if not already present -->
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">

<!-- Add this where you want the widget to appear -->
<div style="max-width: 800px; margin: 20px auto;">
    <!-- Paste entire content from employee_overtime_widget.html here -->
</div>
```

## 🆘 Troubleshooting

### Widget shows "--" for all values
- Check if employee is logged in
- Verify `localStorage` has user data
- Check browser console for errors
- Ensure attendance records exist

### "Access Denied" error
- Verify employee has valid user_id
- Check if salary structure exists
- Ensure attendance records are present

### Data not updating
- Click refresh button
- Check network tab for API errors
- Verify backend server is running
- Check database connection

---

**Ready to integrate!** 🚀

The widget is self-contained and ready to drop into your employee portal.
