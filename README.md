# PowerSchool OR010 + ECC/SCC Helper

This extension prepares PowerSchool ECC and Student Connection Call (SCC) logs from an approved roster Google Sheet and leaves **Submit** to the teacher. An SCC is usually a conversation with a parent at the start of a semester. The extension also adds an OR010 shortcut on PowerSchool teacher pages.

## Use with a new roster sheet

1. Download this repository and replace the files in the folder used by your unpacked extension.
2. Open `chrome://extensions` (or `edge://extensions`) and click **Reload** for this extension.
3. Open the extension's **Details > Extension options**. Paste your roster Google Sheets URL and click **Approve sheet**. The approved sheet ID is saved only in your browser.
4. Refresh the roster sheet tab. Use its Teacher Tools ECC or SCC handoff menu item.

The extension watches for ECC and SCC handoffs on approved sheets without adding a persistent notification over Google Sheets. It opens a PowerSchool tab when a handoff is detected and shows an error only if the tab cannot be opened.

## First Student Connection Call

1. In **Call Entry**, choose the student, record the call and use **Teacher Tools > Save Student Connection Call & Open PowerSchool**. The SCC note saves to the SCC tab before the PowerSchool handoff. An unsuccessful call uses the next available Attempt column.
2. On the PowerSchool New Log page, select the **Log Type** and **Subtype** appropriate for a Student Connection Call. These differ from ECC. Click the blue **SCC: choose Type & Subtype, then click here** button.
3. The extension inserts the call note while preserving PowerSchool's template, and remembers your selected Type and Subtype for future SCC logs. Review the entire log and click **Submit** yourself. To change the saved selections, use **Extension options > Forget SCC selections**.

The extension cannot verify which school-specific selections are correct; confirm them on the first log and review each prepared log before submitting. If PowerSchool cannot prepare the log, it stops and shows an error without submitting.

The original 2Roster ORN sheet is approved automatically. If the encoded toast appears without opening PowerSchool, confirm you approved the correct sheet URL, reloaded the unpacked extension and refreshed the sheet tab. Updating files on GitHub alone does not update an installed extension.

If PowerSchool opens but the log is not prepared, check the visible error before proceeding manually. The browser console also logs messages prefixed `[PowerSchool ECC]` or `[PowerSchool SCC]`. The extension does not click Submit.
