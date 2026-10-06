window.PAGE_I18N = {
    // Specific Content Elements
    title: 'IFC Reposition',
    subtitle: "Coordinates Editor",
    ruleTitle: "What this tool does",
    ruleDesc1: 'Allows you to quickly update the georeferencing coordinates (Latitude, Longitude) and Elevation within the IFCSITE entity of your IFC files.',
    ruleDesc2: "Upload IFC files, define your target coordinates in Decimal Degrees, and process the files to reposition them accurately.",

    // Steps
    step1: "Step 1: Upload Files & Information",
    step2: "Step 2: Target Location Configuration",
    step3: "Step 3: Process & Download",

    // Model Info
    modelInfoTitle: "Model Information",
    infoDate: "Date:",
    infoSize: "File Size:",
    infoSchema: "Schema:",
    infoApp: "Application:",
    infoPerson: "Person:",
    infoUnits: "Units:",
    infoXyz: "lat. / lon. / elev.:",
    valVaries: "Varies",
    valUnknown: "Unknown",
    unitMm: "Millimeters",
    unitCm: "Centimeters",
    unitM: "Meters",
    unitFt: "Feet",
    unitIn: "Inches",

    // Config Options
    optRules: "Target Location",
    optCoords: "Update Coordinates (Lat/Lon)",
    optElev: "Update Elevation",
    latLabel: "Latitude (DD)",
    lonLabel: "Longitude (DD)",
    elevLabel: "Elevation",
    optTimestamp: "Update File Timestamp",

    // Buttons & Dropzone
    dropText: "or drag and drop",
    browseBtn: "Upload file",
    applyBtn: "Apply Location",
    zipBtn: "Download as ZIP",
    saveBtn: "Save to Folder",
    downloadBtn: "Download Individually",
    clearBtn: "Clear List",

    // Table Headers
    thOrig: "Filename",
    thStatus: "Changes",
    thType: "Type",
    thSize: "Size",

    // Statuses & Details
    statusEmpty: "No IFC file loaded yet.",
    statusPending: "Pending configuration",
    statusProcessing: "Processing...",
    statusNoChangesApplied: "No changes applied",
    statusOK: (c, e, error) => {
        if (error) return "Error parsing file";
        if (c && e) return "Coordinates and Elevation updated";
        if (c) return "Coordinates updated";
        if (e) return "Elevation updated";
        return "No changes";
    },
    details: "Show details",
    detailsLat: "Latitude",
    detailsLon: "Longitude",
    detailsElev: "Elevation",
    detailsOld: "Old",
    detailsNew: "New",

    // Toasts & Alerts
    toastApplySuccess: "Location data applied successfully.",
    toastSaveSuccess: "Saved successfully!",
    errorBrowserSupport: "Browser not supported.",
    footerText: "Processed locally. No cloud uploads.",
    downloadSuccess: (count) => `${count} file(s) downloaded successfully.`,
    zippingProgress: "Creating ZIP...",
    removeFile: "Remove file",

    // Map Conversion (IFCMAPCONVERSION)
    worldCoordsTitle: "World Coordinates (IFCSITE)",
    projCoordsTitle: "IFC 4 - Project Coordinates (IFCMAPCONVERSION)",
    optMapconv: "Update Map Coordinates",
    optMapconvZ: "Update Ortho. Height",
    eastingLabel: "Eastings (X)",
    northingLabel: "Northings (Y)",
    orthoHeightLabel: "Ortho. Height (Z)",

    // Progress
    zipProgressText: "Creating ZIP...",

    // Dynamic table statuses
    statusProcessing: "Processing...",
    statusSiteNotFound: "IFCSITE not found",
    statusUpdatedPrefix: "Updated: ",
    statusErrorParsing: "Error parsing file",
    statusNoMapConv: " (no IFCMAPCONVERSION)",
    lblLatLon: "Lat/Lon",
    lblElevation: "Elevation",
    lblMap: "Map",
    lblTimestamp: "Timestamp",
    typeIfc: "IFC",
    detailsMap: "Project Coordinates (Map)",
    detailsTs: "Timestamp",

    // Toasts & validation
    toastNoChangesToDownload: "No files have changes to download.",
    toastNoChangesToSave: "No files have changes to save.",
    errValLatLon: "Enter both Latitude and Longitude.",
    errValLatRange: "Latitude must be between -90 and 90.",
    errValLonRange: "Longitude must be between -180 and 180.",
    errValElev: "Enter a valid Elevation.",
    errValMapXY: "Enter valid Eastings and Northings.",
    errValMapZ: "Enter a valid Ortho. Height.",
    errValNothing: "Select at least one option to update.",
    errBrowserSupport: "Browser not supported.",
    saveSuccess: (count) => `${count} file(s) saved successfully.`,
    saveFailed: "Save failed: ",
};
