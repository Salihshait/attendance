# Reference Screenshots — Status

**Update:** 12 of the 15 reference screens were reviewed directly (attached inline to the chat session
that did this comparison, not saved as files in this repository — this tool has no mechanism to persist
chat-attached images to disk, so they are not present here as files, but the comparison itself was real
and is recorded below). A genuine screen-by-screen comparison was performed against the running app;
findings and the fixes made as a result are listed below, not fabricated as "passed" without evidence.

## What was actually compared

| # | Screen | Reviewed? | Result |
|---|--------|-----------|--------|
| 1 | Login | ✅ | Matches closely — split navy-illustration/white-form layout, module dropdown, username/password with icons, Remember Me, Login button, forgot-password link, Powered By footer with store badges. No changes needed. |
| 2 | Main Dashboard | ✅ | Matches — 3 role-gated cards (green/megaphone Employee Self Service, blue/list Manager Self Service, purple/info Information) with the same icons and colors already in `dashboardCards.ts`. No changes needed. |
| 3 | Employee Self Service (landing) | Not shown separately | Covered by #2 — same dashboard screen. |
| 4 | Manager Self Service (landing) | Not shown separately | Not included in the attached set. |
| 5 | Information | Not shown separately | Not included in the attached set. |
| 6 | Attendance Calendar | ✅ | Matches closely — month grid, per-day shift/hours/status tags, "Apply" button row, Monthly Details sidebar. One real finding: the reference's Apply row has only 4 buttons (Regularize/Leave/Present/Permission); this app now has a 5th ("Work From Home") because that was built as its own feature per explicit instruction — kept intentionally, not a bug (user-confirmed). |
| 7 | Event Request | ✅ | Matches — same 3-option dropdown (Leave/Present/Permission) in the reference; this app additionally lists "Work From Home" as a 4th option for the same intentional reason as above. |
| 8 | Leave Request List | ✅ | **Fixed**: "Entry By" now renders as `Name [CODE]` (e.g. "Bharath S [GG1661]"), matching the reference exactly — was previously just the name. |
| 9 | Present / Missed Punch List | ✅ | Same Entry By fix applies. Reference's "Type" column always reads "Missed In/Out Punch" with the specific reason (including "Work From Home") in the Reason column; this app shows the specific regularization-type label in Type instead — left as a minor, low-risk labeling difference, not changed. |
| 10 | Permission List | ✅ | Same Entry By fix applies. Structure otherwise matches (Date/Hours/Days/Entry By/Applied On/Reason/Approval Remarks/Status/Action). |
| 11 | Balance | ✅ | **Fixed — the significant one.** Reference shows monthly-accrual leave types (Casual Leave, Sick Leave) with a full year of individual monthly opening/used/balance rows when expanded, not one flat annual row. This app's `leave_balances` now generates 12 monthly rows for CL/SL (migration `0042`), and `BalancePage.tsx` groups and displays them the same way, with the aggregate total in the collapsed summary. Not replicated: the reference's separate "Count" sub-columns alongside "Days" — the reference data shows them as 0 throughout, so their real meaning couldn't be confirmed from the evidence available; flagged rather than guessed at. |
| 12 | Employee Profile | ✅ | Matches — same field set (Paygroup, Associate/Employee Code, First/Middle/Last Name, Gender, Father Name, DOB, DOJ, Official Email/Mobile, Department, Designation, Location, Grade, Cost Centre, Place of Tax Deduction, Reporting Manager, Job Responsibility) and the same photo-box + name-ribbon layout. No changes needed. |
| 13 | Attendance Menu | ✅ | Matches — My Request (Event Request) / My Report (In/Out Records, Raw In/Out Records, Balance, Holiday List) columns. This app adds "Missing Attendance" under My Report, which isn't in the reference — intentional, it's a new feature built per explicit instruction, not a copy of an existing reference screen. |
| 14 | EIP Menu | ✅ | Matches — same 4 columns (EIP/Pay Details/TDS/Policies); "Payslip & Taxsheet" label already matched exactly. |
| 15 | Exit Menu | ✅ | Matches — Exit (Home) / Transaction (Resignation Entry, Exit Interview) columns; this app's additional "Management" column (Manage Resignations) is correctly role-gated to manager/HR/admin, so it wouldn't appear for the plain-employee account the reference screenshot was taken from — not a discrepancy. |

## Not yet reviewed

Screens #3 (Employee Self Service as its own screen, if distinct from the Dashboard), #4 (Manager Self
Service landing), and #5 (Information) were not part of the attached screenshot set. If a real
comparison for those is wanted, attach them the same way and ask for the comparison to be re-run.

## Branding note

Per the instruction not to blindly copy proprietary branding: the reference screenshots are of a
different, named third-party product and company (visible company name, employee name/photo, and
vendor branding in the images). Only layout, workflow, navigation structure, and information hierarchy
were used for this comparison — no proprietary names, logos, or personal data from the reference were
copied into this codebase.
