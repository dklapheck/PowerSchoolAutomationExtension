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

## Temporary settings capture (3.2.1)

This temporary build records your school's actual PowerSchool choices so the next extension release can use permanent Type, Subtype, ECC outcome and date selections. A browser reload retains the captures, but the captured settings are not yet built into the automation.

1. Install this branch's files into your unpacked extension folder, reload the extension at `chrome://extensions`, and refresh the PowerSchool tab.
2. On the PowerSchool **New Log** page for an SCC, choose the right Type and Subtype (and any other needed dropdowns). Expand **Capture PowerSchool settings (temporary tool)** next to Log Type, select **SCC**, then click **Capture selected settings**. The button reads the form and never submits.
3. Open the [PowerSchool Settings Log](https://docs.google.com/spreadsheets/d/1_MpkySxTB6BYBB8In3ELRUsH2XpGjaeipMXxxGQb0To/edit#gid=435380773), click the first empty cell in column A, and paste the copied row. If the clipboard did not work, use **Extension options > Temporary form settings captures > Copy row**.
4. Repeat for an ECC **Conversation (successful)** and an ECC **Attempt (unsuccessful)**. For at least one ECC, choose an actual past call date using PowerSchool's date controls before capturing, and verify the requested date shown in the capture panel. Paste each captured row into the next empty row.
5. Let us know after all three rows are in the log. We can inspect the real selected values and date control options, then make a separate permanent extension update.

The recorder stores up to 20 selected-settings snapshots in extension storage; it does not store student numbers, note text, or free-text fields. This temporary release does not apply a past ECC date automatically. Review every prepared log before submitting.

The original 2Roster ORN sheet is approved automatically. If the encoded toast appears without opening PowerSchool, confirm you approved the correct sheet URL, reloaded the unpacked extension and refreshed the sheet tab. Updating files on GitHub alone does not update an installed extension.

If PowerSchool opens but the log is not prepared, check the visible error before proceeding manually. The browser console also logs messages prefixed `[PowerSchool ECC]` or `[PowerSchool SCC]`. The extension does not click Submit.
