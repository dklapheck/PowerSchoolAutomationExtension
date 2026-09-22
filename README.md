# PowerSchool Helper

PowerSchool Helper prepares Demographics, Student Connection Call (SCC), and Engagement Check Call (ECC) workflows inside PowerSchool. It also adds the OR010 shortcut to PowerSchool teacher pages. The extension never clicks **Submit** on a PowerSchool log.

Google Sheets is not in the extension manifest. The roster's Apps Script displays an explicit dialog, and the teacher clicks **Open PowerSchool** to open one tab containing a short-lived handoff in the URL hash.

## Installation and updating

1. Download or clone version **3.6.2** from the **dialog-handoff** branch.
2. Open `chrome://extensions` or `edge://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select this repository folder.

To update an existing unpacked installation, replace its files with the new repository version, return to the extensions page, and click **Reload**. Confirm the extension shows **3.6.2**. Close any looping PowerSchool tabs and start a fresh handoff from a newly generated roster dialog. If multiple copies of PowerSchool Helper are installed, disable the older copies. Updating GitHub alone does not update an installed unpacked extension.

## Demographics workflow

1. In the roster, choose **Teacher Tools > Open Demographics**.
2. On Call Entry, Apps Script uses the student selected in the form. On another tab, it uses the one selected Student Number cell.
3. In the dialog, click **Open PowerSchool**.
4. The extension switches to the required school when necessary, searches for the student, and opens Demographics.

Demographics does not create or edit a PowerSchool log.

Version 3.6.2 uses the actual Demographics destination URL, including custom page names, rather than the picker selection. It allows the final Demographics navigation only once per handoff. If PowerSchool redirects somewhere unexpected, the extension clears the pending handoff and displays an error instead of navigating again. You can choose Demographics manually or start a new dialog to retry.

## SCC and ECC workflow

1. Choose the appropriate Teacher Tools logging action in the roster.
2. Click **Open PowerSchool** in the Apps Script dialog.
3. If PowerSchool requires authentication, sign in. The pending handoff resumes after the authenticated teacher page loads, including SSO flows that finish in a different browser document or tab.
4. The extension finds the student, opens a new log, applies the supplied Type and Subtype, fills the three configured date fields, selects the applicable Attempt tag, and inserts the note while preserving PowerSchool's template text.
5. Review every field and click **Submit** manually.

The three supported date fields are **Date & Time**, **Incident Date**, and **Action Date**. Only the date portion is supplied. The extension does not fill the time portion or **Action Taken End Date**.

If the supplied Type, Subtype, date field, extra dropdown, or tag is missing, ambiguous, or rejected by PowerSchool, the extension stops, preserves the pending work when appropriate, and displays an error. It does not submit the form.

## PowerSchool Settings table

Each Apps Script handoff reads one workflow row from the roster's **Instructions and Settings** table:

| Workflow | Type/Subtype | Dates | Attempt tag |
|---|---|---|---|
| SCC Success | SCC success settings | Date & Time, Incident Date, Action Date | None unless configured |
| SCC Attempt | SCC attempt settings | Date & Time, Incident Date, Action Date | Matching Attempt number |
| ECC Conversation | ECC conversation settings | Date & Time, Incident Date, Action Date | None unless configured |
| ECC Attempt | ECC attempt settings | Date & Time, Incident Date, Action Date | Configured tag, if any |

The handoff may also include a small list of configured dropdown name/value pairs. Current settings take effect on the next dialog; reinstalling the extension is not required. Older handoffs without Type/Subtype settings may use SCC fallback selections remembered in extension storage. Those fallback values can be cleared from **Extension details > Extension options**.

## Permissions and privacy

- The content script runs only on `https://californiak12.powerschool.com/teachers/*` and `https://californiak12.powerschool.com/public/*`.
- The extension has no Google Sheets content-script access, background worker, or tab-opening permission.
- The only declared permission is `storage`, used for remembered SCC fallback selections and a short-lived sign-in recovery backup.
- A handoff URL fragment can contain a student number and, for SCC/ECC, the note and settings. The extension removes the fragment from the visible URL immediately. Pending state stays in the PowerSchool tab's session storage, with an extension-storage recovery backup that is accepted for no more than 30 minutes and deleted when authentication completes, the workflow ends, or an expired backup is next checked.
- The extension does not send roster data to a separate service and does not log the student number or note to the browser console.

## Testing

From the repository root, run:

```bash
node --test tests/*.test.cjs
```

The automated tests cover Demographics, SCC, and ECC hash handling; same-tab and cross-document SSO recovery; custom Demographics URLs and stale or absent pickers; multi-document Demographics navigation and unexpected redirects; refresh after completion or failure; Type/Subtype selection; Date & Time, Incident Date, and Action Date; Attempt-tag mapping; note preservation; failure behavior; and the rule that the PowerSchool log is never submitted. The manifest test confirms that no script is injected into `docs.google.com/spreadsheets` and that no background launcher is registered.

These tests use a simulated DOM. They do not prove live Google Sheets behavior, popup-blocker behavior, authenticated PowerSchool end-to-end behavior, or compatibility with the current production PowerSchool DOM. They are not end-to-end tests.

## Manual smoke test

- [ ] Refreshing the Google Sheet opens zero PowerSchool tabs.
- [ ] **Open Demographics** displays one dialog.
- [ ] Clicking **Open PowerSchool** opens exactly one tab.
- [ ] Demographics stays open without repeated navigation, including when its picker shows the previous screen.
- [ ] Refreshing the completed Demographics tab does not start another search or navigation.
- [ ] An unexpected redirect after the final Demographics navigation displays a stopped message and does not retry automatically.
- [ ] Call Entry uses the student selected in the form.
- [ ] One selected Student Number cell on another tab works.
- [ ] SCC Success fills Date & Time, Incident Date, and Action Date and uses the correct settings.
- [ ] SCC Attempt selects the correct Attempt tag.
- [ ] A signed-out handoff resumes after authentication in the same tab.
- [ ] Demographics, SCC, and ECC never click **Submit**.

## Troubleshooting

- **The dialog does not appear:** confirm that the Apps Script project is the dialog-handoff version, refresh the Sheet, and retry with a valid student or SCC/ECC selection.
- **The button does not open a tab:** allow the user-initiated PowerSchool link if the browser blocks it, then click the button again from a newly generated dialog.
- **PowerSchool opens but does not continue:** reload the unpacked extension and start a fresh handoff. The extension keeps a short-lived recovery backup for SSO redirects.
- **Demographics keeps reloading:** confirm **3.6.2** is loaded from **dialog-handoff**, disable any older duplicate PowerSchool Helper installations, close the looping tabs, and open a newly generated dialog. This version stops after an unexpected final-navigation redirect; use **Copy error** if that message appears.
- **A field cannot be selected:** verify the current values in the roster's PowerSchool Settings table and compare them with the live PowerSchool form.
- **An error panel appears:** continue manually in PowerSchool. The extension stops before submitting anything.

See [CHANGELOG.md](CHANGELOG.md) for version history.
