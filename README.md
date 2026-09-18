# PowerSchool OR010 + ECC Helper

This extension prepares a PowerSchool ECC log from an approved roster Google Sheet and leaves **Submit** to the teacher. It also adds an OR010 shortcut on PowerSchool teacher pages.

## Use with a new roster sheet

1. Download this repository and replace the files in the folder used by your unpacked extension.
2. Open `chrome://extensions` (or `edge://extensions`) and click **Reload** for this extension.
3. Open the extension's **Details > Extension options**. Paste your roster Google Sheets URL and click **Approve sheet**. The approved sheet ID is saved only in your browser.
4. Refresh the roster sheet tab. On an ECC student row, use the Teacher Tools handoff menu item.

On an approved sheet, a small **ECC Helper active on this sheet** badge appears at the bottom right. When a handoff is detected, the badge reports whether PowerSchool opened or gives a launch error. If that badge is absent, the sheet is not approved, the tab needs refreshing, or this extension is not running on that tab.\n\nThe original 2Roster ORN sheet is approved automatically. The content script listens for `ECC_HANDOFF_V1:` only on approved sheet IDs. If the encoded toast appears without opening PowerSchool, confirm you approved the correct sheet URL, reloaded the unpacked extension and refreshed the sheet tab. Updating files on GitHub alone does not update an installed extension.

If PowerSchool opens but the log is not prepared, do not submit it. The extension should display an alert explaining why it stopped. The browser console also logs messages prefixed `[PowerSchool ECC]`. The extension does not click Submit.
