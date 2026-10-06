window.PAGE_I18N = {
    // Specific Content Elements
    title: "IFC Inject Properties",
    subtitle: "Add new attributes into IFC Models",
    ruleTitle: "What this tool does",
    ruleDesc1: "This tool parses an IFC file entirely in your browser using <code class=\"bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-700\">web-ifc</code>. You can add entirely new properties to one or multiple IFC classes simultaneously, upload a spreadsheet to overwrite existing values, and download the updated topological graph as a new IFC file.",

    // Step 1: Load Model
    step1: "Step 1: Load Model",
    dropUpload: "Upload IFC file",
    dropOr: "or drag and drop",
    dropEmpty: "No file selected",

    // Step 2: Add New Properties (Optional)
    stepAddPropsTitle: "Optional: Add New Properties",
    stepAddPropsDesc: "Create new attributes and apply them to specific IFC Classes. Select one or multiple classes from the list.",
    lblClass: "IFC Class(es)",
    lblMultiSelect: "Ctrl/Cmd to multi-select",
    lblPsetName: "Pset Name",
    lblPropName: "Property Name",
    lblDataType: "Data Type",
    lblDefaultValue: "Default Value",
    btnAddProp: "ADD",
    queuedPropsTitle: "Queued New Properties",

    // Table Headers
    thClass: "IFC Class(es)",
    thPset: "Pset Name",
    thProperty: "Property",
    thType: "Type",
    thValue: "Value",
    thAction: "Action",

    // Step 3: Upload Data & Update (Note: Text kept as "Step 2" to match your current HTML)
    step3: "Step 2: Update Values & Export",
    uploadDataTitle: "1. Modify Existing Properties (Optional)",
    uploadDataDesc: "Upload an Excel/CSV file containing property corrections to overwrite existing values. Leave empty if only adding new properties.",
    waitingFile: "Waiting for file...",

    // Apply Changes Card
    applyChangesTitle: "2. Apply Changes & Download",
    applyChangesDesc: "This will inject the queued new properties and apply any uploaded property overwrites, generating your updated IFC file.",
    btnUpdateDownload: "Update & Download IFC",

    // System Log
    logTitle: "System Log Output",

    // Placeholders
    phPset: "e.g. Pset_Custom",
    phProp: "Attribute Name",
    phValue: "Value",

    // Data Types (Dropdown Options)
    typeLabel: "IfcLabel (Text)",
    typeText: "IfcText (Long Text)",
    typeBoolean: "IfcBoolean (True/False)",
    typeInteger: "IfcInteger (Whole Number)",
    typeReal: "IfcReal (Decimal)",

    // JS Alerts & Dynamic Text
    alertEmptyFields: "Please select at least one class and fill in all fields.",
    alertPsetProtected: "Security Error: The Property Set '{pset}' is protected by schema rules and cannot be modified.",
    alertPropProtected: "Security Error: The Property '{name}' is protected and cannot be created manually.",

    statusParsing: "Parsing ",
    statusReady: "Ready to apply {count} property updates.",
    statusNoValid: "No valid property updates found in file.",
    statusError: "Error parsing file.",
};