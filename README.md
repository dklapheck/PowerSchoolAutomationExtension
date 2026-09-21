# PowerSchool OR010 + ECC/SCC Helper

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
2. On **Instructions and Settings** in the roster, use the four rows **SCC Success**, **SCC Attempt**, **ECC Conversation**, and **ECC Attempt**. Enter the exact PowerSchool Log Type value in column B and Subtype value in D. Columns C and E are labels for reference. The extension reads the row sent with each handoff; edits take effect on the next call without reinstalling. If an SCC row is blank, select Type/Subtype manually on PowerSchool and click the blue SCC button.
3. The extension inserts the call note while preserving PowerSchool's template. Review the entire log and click **Submit** yourself. Older Apps Script handoffs without Settings values can still use previously remembered browser selections.

The extension cannot verify which school-specific selections are correct; confirm them on the first log and review each prepared log before submitting. If PowerSchool cannot prepare the log, it stops and shows an error without submitting.

## Open student Demographics

Select a student on **Call Entry**, then select cell **B15**, labeled **Demographics Correct?**. The extension opens PowerSchool, switches to Sonoma if needed, searches by student number, and opens the Demographics screen. It does not create, edit, or submit a log. Because Google Sheets triggers this only when the selection changes, select another cell before selecting B15 again.

## Temporary settings capture (3.2.2)

This build reads Type/Subtype and optional additional dropdown choices from the roster's Settings tab. The temporary recorder helps you obtain exact option values and identify PowerSchool's ECC date controls. Captures survive a browser reload; ECC date selection is still awaiting a separate code update based on those captures.

1. Install this branch's files into your unpacked extension folder, reload the extension at `chrome://extensions`, and refresh the PowerSchool tab.
2. On the PowerSchool **New Log** page, choose the correct Type/Subtype and any other needed dropdowns. Expand **Capture PowerSchool settings (temporary tool)** next to Log Type, choose the matching scenario, then click **Capture selected settings**. The button reads the form and never submits.
3. Click **Copy Type/Subtype for Settings** and paste into column **B** of that scenario's row in [Instructions and Settings](https://docs.google.com/spreadsheets/d/1_MpkySxTB6BYBB8In3ELRUsH2XpGjaeipMXxxGQb0To/edit#gid=1866668700): SCC Success row 35, SCC Attempt 36, ECC Conversation 37, ECC Attempt 38. This fills B:E. For extra dropdowns, column F optionally accepts valid JSON such as `[{"name":"result","value":"no_answer"}]`.
4. Paste the full captured row into the next empty row of the [PowerSchool Settings Log](https://docs.google.com/spreadsheets/d/1_MpkySxTB6BYBB8In3ELRUsH2XpGjaeipMXxxGQb0To/edit#gid=435380773). If copying fails, use **Extension options > Temporary form settings captures > Copy row** or **Copy Settings cells**.
5. Repeat for all four scenarios. For at least one ECC, select an actual past call date in PowerSchool before capturing, and check the requested date in the panel. Once the date controls are recorded, we can hardcode the ECC date behavior in the extension.

The recorder stores up to 20 selected-settings snapshots in extension storage; it does not store student numbers, note text, or free-text fields. This release does not apply a past ECC date automatically. Review every prepared log before submitting.

The original 2Roster ORN sheet and **6RosterORNFinal** are approved automatically. Version 3.3.6 watches Google Sheets editor frames, including Chrome's inherited `about:blank` editor frames, and polls toast/live regions as a fallback. SCC, ECC, and Demographics handoffs therefore do not depend on one specific Sheets DOM mutation. It keeps the duplicate guard in extension session storage, so repeated frame reports open only one PowerSchool tab when Chrome restarts the background worker. If the encoded toast appears without opening PowerSchool, reload the unpacked extension and refresh the sheet tab. For any other roster, confirm that you approved the correct sheet URL. Updating files on GitHub alone does not update an installed extension.

If PowerSchool opens but the log is not prepared, check the visible error before proceeding manually. The browser console also logs messages prefixed `[PowerSchool ECC]` or `[PowerSchool SCC]`. The extension does not click Submit.
