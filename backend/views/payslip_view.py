"""
Payslip view layer — server-rendered HTML for the printable pay slip.

This is the "V" for a server-rendered document (as opposed to the JSON the API
controllers return). It takes the fully-computed payslip dict and produces HTML.
"""


def build_html(d: dict) -> str:
    # Pre-compute conditional deduction rows (avoids nested quotes in f-strings)
    unpaid_leave_ded   = d.get('unpaid_leave_deduction', 0) or 0
    late_ded           = d.get('late_arrival_deduction', 0) or 0
    grace_count        = d.get('grace_late_count', 0) or 0
    deductions_applied = d.get('late_deductions_applied', 0) or 0
    unpaid_days        = d.get('unpaid_leave_days', 0) or 0
    total_deductions   = round(d['professional_tax'] + unpaid_leave_ded + late_ded, 2)

    def _day_s(n): return 's' if n != 1.0 else ''

    leave_row = (
        '<div class="row">'
        '<span class="lbl">Unpaid Leave ('
        + f'{unpaid_days:.2f} day{_day_s(unpaid_days)})'
        + '</span><span class="val red">&#8377;'
        + f'{unpaid_leave_ded:,.2f}</span></div>'
    ) if unpaid_leave_ded > 0 else ''

    occ_s    = 's' if grace_count != 1 else ''
    late_row = (
        '<div class="row">'
        '<span class="lbl">Late Arrival ('
        + f'{grace_count} occurrence{occ_s}'
        + f' — {deductions_applied} × ½ day)'
        + '</span><span class="val red">&#8377;'
        + f'{late_ded:,.2f}</span></div>'
    ) if late_ded > 0 else ''

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pay Slip — {d['payroll_month']}</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:Arial,sans-serif;color:#1e293b;background:#fff;padding:32px}}
.wrap{{max-width:760px;margin:0 auto}}
.hdr{{text-align:center;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px}}
.co{{font-size:22px;font-weight:700;color:#1e3a8a}}
.doc-title{{font-size:16px;font-weight:600;color:#475569;margin-top:6px}}
.period{{font-size:12px;color:#94a3b8;margin-top:3px}}
.info{{display:grid;grid-template-columns:1fr 1fr;gap:8px 28px;background:#f8fafc;padding:16px;border-radius:8px;margin-bottom:20px}}
.kv{{display:flex;flex-direction:column}}
.k{{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b}}
.v{{font-size:13px;font-weight:600;color:#1e293b;margin-top:2px}}
.sec{{margin-bottom:18px}}
.sec-hd{{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#64748b;padding-bottom:6px;border-bottom:1px solid #e2e8f0;margin-bottom:8px}}
.row{{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px}}
.row:last-child{{border-bottom:none}}
.lbl{{color:#64748b}}
.val{{font-weight:600;color:#1e293b}}
.val.red{{color:#ef4444}}
.tot{{font-size:13px;font-weight:700;color:#1e293b}}
.net{{background:#1e3a8a;color:#fff;padding:14px 20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-top:20px}}
.net-lbl{{font-size:14px;font-weight:600}}
.net-val{{font-size:22px;font-weight:700}}
.foot{{text-align:center;margin-top:28px;font-size:11px;color:#94a3b8;padding-top:14px;border-top:1px solid #e2e8f0}}
.print-btn{{position:fixed;top:16px;right:16px;background:#3b82f6;color:#fff;border:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;z-index:99}}
@media print{{.print-btn{{display:none}}}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">&#128424; Print / Save PDF</button>
<div class="wrap">
<div class="hdr">
  <div class="co">{d['company_name']}</div>
  <div class="doc-title">Pay Slip</div>
  <div class="period">{d['payroll_month']}</div>
</div>
<div class="info">
  <div class="kv"><span class="k">Employee Name</span><span class="v">{d['employee_name']}</span></div>
  <div class="kv"><span class="k">Employee ID</span><span class="v">{d['employee_id']}</span></div>
  <div class="kv"><span class="k">Department</span><span class="v">{d['department']}</span></div>
  <div class="kv"><span class="k">Job Title</span><span class="v">{d['job_title']}</span></div>
</div>
<div class="sec">
  <div class="sec-hd">Earnings</div>
  <div class="row"><span class="lbl">Monthly Salary (Gross)</span><span class="val">&#8377;{d['monthly_salary']:,.2f}</span></div>
</div>
<div class="sec">
  <div class="sec-hd">Deductions</div>
  <div class="row"><span class="lbl">Professional Tax (PT)</span><span class="val red">&#8377;{d['professional_tax']:,.2f}</span></div>
  {leave_row}
  {late_row}
  <div class="row"><span class="lbl tot">Total Deductions</span><span class="val red tot">&#8377;{total_deductions:,.2f}</span></div>
</div>
<div class="net">
  <span class="net-lbl">Net Salary</span>
  <span class="net-val">&#8377;{d['net_salary']:,.2f}</span>
</div>
<div class="foot">This is a computer-generated document. No signature required.</div>
</div>
</body>
</html>"""
