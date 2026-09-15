/*
 * Copyright 2026 Luis Torrecilla (liteAECO)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// ========
// liteAECO - (meetings.js)
// ========

window.PAGE_I18N = {
    title: "Meetings",
    subtitle: "Meeting Minutes & Tasks tracking",
    ruleTitle: "What this tool does",
    ruleDesc1: "This allows you to create and manage meeting minutes and threads. Keep track of every open issue, while assigning them to your team easily. You can export it as an Excel file and bring it back to continue editing opened issues in following meetings. <br/><br/>This tool uses an Universal <span class='bg-white px-1.5 py-0.5 rounded border border-slate-200'>Excel</span> files so you can load your contacts back in from other webapps within this website.",

    lblNo: "No.",
    phMeetingTitle: "Enter Meeting Title...",
    btnTemplate: "Excel Template",
    btnSave: "Save",
    btnExport: "Export",
    autosaveToggle: "Autosave",
    projectInfoMenu: "Project info",
    titleOptions: "Options",
    openFileMenu: "Open file\u2026",
    importContactsMenu: "Import contacts\u2026",
    msgContactsImported: "Contacts imported.",
    lblNew: "New",
    lblUpdated: "Updated",
    btnOpen: "Open",
    btnPdf: "PDF",
    historyCurrent: "(Current)",

    titleTopics: "Topics & Minutes",
    phSearch: "Search minutes...",
    titleParticipants: "Participants",
    phName: "Name...",

    optRequired: "Required",
    optOptional: "Optional",
    optOrganizer: "Organizer",
    statusInfo: "INFO",
    statusOpen: "OPEN",
    statusClosed: "CLOSED",
    priorityLow: "Low",
    priorityMed: "Med",
    priorityHigh: "High",

    modalTitleEdit: "Edit Contact",
    modalLblName: "Name",
    modalLblCompany: "Company",
    phCompanySearch: "Type to search...",
    modalLblRole: "Role (Job Title)",
    modalLblContactInfo: "Contact Info (Email/Phone)",
    modalLblParticipation: "Participation",
    btnCancel: "Cancel",
    btnSaveModal: "Save",

    emptyAttendees: "No attendees added yet.",
    archivedTag: "(Archived)",
    badgeUnassigned: "Unassigned",
    titleCompanies: "Companies",
    phNotes: "Notes...",
    btnAddSubtask: "Add Sub-task",
    btnAddNewTask: "Add New Task",
    emptyTasks: "No tasks found",

    alertMissingTitle: "Please enter a Meeting Title before saving.",
    alertParseError: "Error parsing Excel file. Make sure xlsx.bundle.js is loaded correctly.",
    confirmRemovePerson: "Remove this person from the active contacts list? (They will be preserved in past meeting records)",
    confirmDeleteTask: "Delete this entire task and its subtasks?",

    lblProject: "Project",
    lblProjectDetails: "Details",
    lblClient: "Client",
    lblAddress: "Address",
    lblProjectType: "Project Type",
    phProjectNo: "No.",
    phProjectTitle: "Project Title...",

    btnAttach: "Attach image or PDF",
    titleRemoveAttachment: "Remove attachment",
    phAddComment: "Add comment...",
    lblMeetingAttachments: "Meeting attachments (not linked to a topic)",
    lblNotEmbedded: "Not embedded \u2014 reference only",
    lblReference: "Reference",
    lblOrigSize: "orig",
    alertOnlyImagesPdf: "only images and PDF files can be attached.",
    alertHeic: "HEIC images cannot be read by the browser. Please convert to JPEG first (iOS: choose \"Most Compatible\", or share via Photos which converts automatically).",
    errFileProcess: "could not process this file.",
    warnAttachSize25: "Total attachment size is getting large \u2014 .ltm files may become slow to save/open.",
    warnAttachSize100: "Total embedded attachments now exceed 100 MB. The .ltm will be slow to save and open \u2014 consider referencing large files or trimming old images.",
    confirmPdfReference: "is {0} MB (limit for embedding is 5 MB).\n\nAttach it as a REFERENCE instead? The file itself stays where it is; only its name, size and fingerprint travel in the .ltm.",
    confirmRemoveAttachment: "Remove attachment \"{0}\"?",
    alertReferenceOnly: "This attachment is a reference \u2014 the file itself is not embedded.",

    errBadLtm: "This .ltm file could not be read (corrupt or not a ZIP container).",
    errLtmNoXlsx: "No spreadsheet found inside the .ltm container.",
    errParseLtmXlsx: "Error parsing the spreadsheet inside the .ltm container.",
    warnOtherContainer: "This container was made by another liteAECO app ({0}). Open its spreadsheet anyway?",
    warnNewerLtm: "This .ltm uses a newer format version ({0}). Try to open anyway?",
    warnNoManifest: "No valid manifest.json in this container \u2014 spreadsheet loaded, attachments skipped.",

    btnMetadata: "View metadata",
    titleMetadata: "Attachment Metadata",
    mdFile: "File name",
    mdStoredAs: "Stored format",
    mdSize: "Size",
    mdFromOriginal: "from",
    mdSmaller: "smaller",
    mdCaptured: "Captured (EXIF)",
    mdDevice: "Device",
    mdCoords: "Coordinates",
    mdAltitude: "Altitude",
    mdAltNote: "(GPS, \u00B1tens of metres)",
    mdHeading: "Camera heading",
    mdNoGps: "(no GPS in original file)",
    mdReferenceOnly: "reference only, not embedded",
    mdReferenceSource: "Reference source",
    mdAdded: "Added to meeting",
    mdMeetingNo: "Attached in meeting no.",
    mdSha: "SHA-256",
    mdShaUnavailable: "unavailable (needs a secure context)",
    mdGuid: "GUID",
    mdLinkedTo: "Linked to",
    optLinkMeeting: "Meeting (general)",
    mdComments: "Comments",
    ttOpenMap: "Open in OpenStreetMap",
    mdNote: "Images are recompressed on attach (max 1920 px long edge, JPEG q0.8). EXIF capture time, GPS and device are read from the original file and stored separately in the .ltm container.",

    confirmImportReplace: "Are you sure you want to import this Meeting? Existing unsaved data will be replaced.",
    alertNoContactsTab: "No CONTACTS tab found in this file. Nothing to import.",
    confirmForeignImport1: "This file's INFO tab A2 does not read \"Meetings\".\n\nContacts will be imported from the CONTACTS tab. Meeting settings may not load correctly.",
    confirmMinorIssues: "Minor issues:\n\n",
    txtImportAnyway: "\n\nImport anyway?",
    phSearchAssignees: "Search assignees...",
    phThreadTopic: "Thread Topic...",

    autosaveMenu: "Autosave…",
    historyMenu: "History",
    autosaveOffMenu: "Autosave off",
    autosaved: "Autosaved",
    autosaveDirty: "Autosave: unsaved changes…",
    autosaveOff: "Autosave off – enable it in this menu",
    autosaveReconnectShort: "Autosave: reconnect needed – open the Save menu",
    snapshotMode: "Autosaving to this browser. Use Save to keep a file.",
    browserSnapshot: "browser snapshot",
    multiTabWarning: "This session is now autosaving in another tab – autosave here is paused.",
    resumeSession: "Continue where you left off?",
    resumeDetail: "A previous session was found:",
    resumeFailed: "Could not reopen the last session file.",
    startFresh: "Start Fresh",
    continueBtn: "Continue",
    planHistory: "Plan History",
    noHistory: "No snapshots yet – they are created automatically while autosave is active.",
    restore: "Restore",
    loading: "Loading…",
    autosaveLeaveMessage: "Autosave is on and the changes to this project have been saved. Your session will be restored when you return.",
    unsavedLeaveMessage: "You have unsaved changes. Are you sure you want to leave?"
};
