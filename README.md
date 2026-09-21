# PowerSchool Helper

This extension prepares PowerSchool ECC and Student Connection Call (SCC) logs from an approved roster Google Sheet and leaves **Submit** to the teacher. It can also open the selected student's Demographics screen when **Call Entry!B15** is selected. An SCC is usually a conversation with a parent at the start of a semester. The extension also adds an OR010 shortcut on PowerSchool teacher pages.

## Use with a new roster sheet

1. Download this repository and replace the files in the folder used by your unpacked extension.
2. Open `chrome://extensions` (or `edge://extensions`) and click **Reload** for this extension.
3. Open the extension's **Details > Extension options**. Paste your roster Google Sheets URL and click **Approve sheet**. The approved sheet ID is saved only in your browser.
4. Refresh the roster sheet tab. Use its Teacher Tools ECC or SCC handoff menu item.

The extension watches for ECC, SCC, and Demographics handoffs on approved sheets without adding a persistent notification over Google Sheets. It opens a PowerSchool tab when a handoff is detected and shows an error only if the tab cannot be opened.

## Login and retry behavior (3.2.3)

If PowerSchool asks you to sign in, the extension saves the pending ECC or SCC handoff in that PowerSchool tab and resumes after the authenticated teacher page returns. Complete sign-in in the same tab. An identical handoff can also be retried from Google Sheets after 60 seconds; repeated detections from the same action are ignored.

## Student Connection Call settings

1. In **Call Entry**, choose the student and record the call. Use **Teacher Tools > Save SCC Call Entry** to save it to the SCC tab. Separately, use **Teacher Tools > Log SCC in PowerSchool** to prepare the PowerSchool log. Logging does not save or change the SCC tab.
2. On **Instructions and Settings** in the roster, use the four rows **SCC Success**, **SCC Attempt**, **ECC Conversation**, and **ECC Attempt**. Enter the exact PowerSchool Log Type value in column B and Subtype value in D. Columns H:J identify Date & Time, Incident Date, and Action Date; column K contains the Attempt 1–6 tag map. Columns C and E are labels for reference, and F can hold additional dropdown JSON. The extension reads the row sent with each handoff, so edits take effect on the next call without reinstalling.
3. The extension sets all three requested dates, applies the tag matching the saved or next open Attempt column, and inserts the call note while preserving PowerSchool's template. It stops on a missing, duplicated, or rejected configured control. Review the entire log and click **Submit** yourself. Older Apps Script handoffs without Settings values can still use previously remembered browser selections.

The extension cannot verify which school-specific selections are correct; confirm them on the first log and review each prepared log before submitting. If PowerSchool cannot prepare the log, it stops and shows an error without submitting.

## Open student Demographics

Select a student on **Call Entry**, then select cell **B15**, labeled **Demographics Correct?**. The extension opens PowerSchool, switches to Sonoma if needed, searches by student number, and opens the Demographics screen. It does not create, edit, or submit a log. Because Google Sheets triggers this only when the selection changes, select another cell before selecting B15 again.

## Temporary settings capture (3.5.0)

This build reads Type, Subtype, optional additional dropdown choices, the log-date field, and a tag label from the roster's **Instructions and Settings** tab. The temporary recorder helps obtain exact option values and identify PowerSchool's date control. Captures survive a browser reload.

1. Install this branch's files into your unpacked extension folder, reload the extension at `chrome://extensions`, and refresh the PowerSchool tab.
2. On the PowerSchool **New Log** page, choose the correct Type/Subtype and any other needed dropdowns. Expand **Capture PowerSchool settings (temporary tool)** next to Log Type, choose the matching scenario, then click **Capture selected settings**. The button reads the form and never submits.
3. Click **Copy Date Field Map** to copy the visible date-field labels and their PowerSchool `id`/`name` attributes. Paste this single diagnostic string into column J (**Notes**) of the next empty **PowerSchool Settings Log** row. It never copies the entered date values, student number, or log note.
4. With the SCC Attempt Type/Subtype selected, click **Copy Attempt Tag Map**. Paste that diagnostic into column J of another empty row. It recognizes PowerSchool labels such as `Attempt 1 (34)`, records the canonical Attempt number and parenthetical code, and includes options that are currently below the list's scroll position.
5. Click **Copy Type/Subtype for Settings** and paste into column **B** of that scenario's row in [Instructions and Settings](https://docs.google.com/spreadsheets/d/1_MpkySxTB6BYBB8In3ELRUsH2XpGjaeipMXxxGQb0To/edit#gid=1866668700): SCC Success row 35, SCC Attempt 36, ECC Conversation 37, ECC Attempt 38. This fills B:E. Column F optionally accepts valid extra-dropdown JSON such as `[{"name":"result","value":"no_answer"}]`; H:J contain the three date controls and K contains the Attempt tag map.
6. Paste the full captured row into the next empty row of the [PowerSchool Settings Log](https://docs.google.com/spreadsheets/d/1_MpkySxTB6BYBB8In3ELRUsH2XpGjaeipMXxxGQb0To/edit#gid=435380773). If copying fails, use **Extension options > Temporary form settings captures > Copy row** or **Copy Settings cells**.
7. Repeat for all four scenarios when PowerSchool changes its school-specific Type/Subtype values. The verified date controls and Attempt tag map are already populated in the roster.

The recorder stores up to 20 selected-settings snapshots in extension storage; it does not store student numbers, note text, or arbitrary free-text fields. Version 3.5.0 fills Date & Time, Incident Date, and Action Date, and maps SCC Attempt numbers to PowerSchool's coded Attempt 1–6 options. Review every prepared log before submitting.

The original 2Roster ORN sheet and **6RosterORNFinal** are approved automatically. Version 3.4.0 watches Google Sheets editor frames, including Chrome's inherited `about:blank` editor frames, and polls toast/live regions as a fallback. SCC, ECC, and Demographics handoffs therefore do not depend on one specific Sheets DOM mutation. It keeps the duplicate guard in extension session storage, so repeated frame reports open only one PowerSchool tab when Chrome restarts the background worker. If the encoded toast appears without opening PowerSchool, reload the unpacked extension and refresh the sheet tab. For any other roster, confirm that you approved the correct sheet URL. Updating files on GitHub alone does not update an installed extension.

If PowerSchool opens but the log is not prepared, check the visible error before proceeding manually. The browser console also logs messages prefixed `[PowerSchool ECC]` or `[PowerSchool SCC]`. The extension does not click Submit.
