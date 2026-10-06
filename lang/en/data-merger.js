window.PAGE_I18N = {
    // Meta & Header Info
    title: "Data Merger",
    mainTitle: "Data Merger",
    subTitle: "Color-Coded Consolidator",
    ruleTitle: "What this tool does",
    ruleDesc1: "Allows you to visually map and merge multiple Excel or CSV reports into a single master file using an XLOOKUP-style matching engine. Load a Base File, map your secondary files to it by selecting shared headers, and execute the merge.",

    // Step 1: Upload Workspace
    step1Title: "Step 1: Load Files",
    baseFileTitle: "Base File",
    baseFileBtn: "Select Base File",
    baseFileDesc: ".xlsx, .ods, .csv (1 allowed)",
    secFileTitle: "Secondary Files",
    secFileBtn: "Load Additional Files",
    secFileDesc: ".xlsx, .ods, .csv (Multiple allowed)",

    // Step 2: Configuration Workspace
    step2Title: "Step 2: File Configuration & Mapping",
    emptyConfig: "Load your Base File to begin mapping.",

    // Step 3: Process Workspace
    step3Title: "Step 3: Process & Download",
    btnMerge: "Execute Merge & Download",
    btnClear: "Clear Table",

    // Dynamic UI (Rendered via JS)
    uiRemoveFile: "Remove File",
    uiPrimaryBase: "Primary Base Data",
    uiFile: "File",
    uiSheet: "Sheet",
    uiRow: "Row",
    uiRelatesTo: "Relates To",
    uiSelectTarget: "Select target file above",
    uiMappingKeyFor: "Mapping Key for",
    uiNoMatch: "No Match",

    // Excel Export Data & Audit Logs (Rendered via JS)
    sheetMergedData: "Merged Data",
    sheetAppendedRows: "Appended New Rows",
    sheetConflicts: "Conflicts Log",
    colSourceFile: "[Source File]",
    colSourceFileConflict: "Source File",
    colMappingKeyCol: "Mapping Key Column",
    colMappingKeyVal: "Mapping Key Value",
    colConflictingCol: "Conflicting Column",
    colBaseFileVal: "Existing Value",
    colDiscardedVal: "Discarded Value",
    colKeptFrom: "Value Kept From",
    sheetDuplicates: "Duplicate Keys",
    colDupSide: "Where",
    colDupTarget: "Target data",
    colDupIncoming: "Incoming file",
    fileSuffixMerged: "_Merged",

    // Toasts & Notifications
    toastSuccess: "Data Merged & Downloaded!",
    toastAppended: "Merged! Appended",
    toastNewRows: "new rows and found",
    toastConflicts: "conflicts.",

    // File loading errors
    toastUnsupported: "is not a supported format.",
    toastReadFailed: "could not be read. It may be corrupt or password protected.",
    toastOdsReadFailed: "could not be read. The ODS parser may be missing from this build.",
    toastNoSheets: "contains no sheets.",
    toastDropFailed: "Something went wrong loading that file.",

    // Merge & export warnings
    toastCircular: "file(s) form a circular relation and were skipped.",
    toastOdsExportFallback: "ODS export unavailable in this build. Saved as .xlsx instead.",
    toastExportFailed: "Merge succeeded but the download failed.",
    toastDuplicates: "duplicate key(s) found - see the audit tab."
};