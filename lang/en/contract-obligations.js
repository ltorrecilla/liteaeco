window.PAGE_I18N = {
    // Header & Alert
    title: 'Contract Obligations',
    subtitle: 'REFM Swiss Commercial Lease (Swiss Code)',
    ruleTitle: 'What this tool does',
    ruleDesc1: 'This tool is meant to be used only for Rental Contracts within <strong>Switzerland</strong>, the current parser is set up for the Swiss Code. Load or paste the contract text below, the tool uses browser-based regular expressions (Regex) to extract structured parameters, identify data, and highlight standard clauses. You can also use the integrated search and map attributes manually if needed.',
    alertTitle: 'Limitation (Information Overload):',
    alertText: 'This tool now combines highly specific data extraction with broad clause highlighting. Regular expressions extract syntactic patterns but do not understand legal context. Missing clauses do not necessarily mean missing obligations (the discretionary “OR” often applies).',

    // Step 1: Input
    step1: 'Contract Text Input',
    loadPdf: 'Load PDF',
    loadSample: 'Load Sample Text',
    extracting: 'Extracting text from PDF...',
    txtPlaceholder: 'Paste contract text here...', // Apply this via JS

    // Step 2: Configuration
    step2: 'Configuration',
    dateFormat: 'Date Format',
    optDach: 'Switzerland/DACH (DD.MM.YYYY)',
    optUs: 'US Format (MM/DD/YYYY)',
    optUk: 'UK/Global (DD/MM/YYYY)',
    optIso: 'ISO 8601 (YYYY-MM-DD)',
    extCrit: 'Extract Critical Data',
    hlClause: 'Highlight Standard Clauses',
    chkDach: 'Check for Missing DACH Baselines',
    btnAnalyze: 'Analyze Document',

    // Step 3: Analysis Results
    step3: 'Analysis Results',
    waiting: 'Waiting for document analysis...',
    
    // 3.1 Card Labels
    lblVermieter: 'Vermieter / Eigentümer',
    lblMieter: 'Mieter',
    lblAdresse: 'Liegenschaft / Objektadresse',
    lblPurpose: 'Purpose & Industry',
    lblArea: 'Area',
    lblTotal: 'Total Cost (CHF)',
    lblAddcost: 'Additional Costs (CHF)',
    lblDeposit: 'Deposit (CHF)',
    lblUid: 'MwSt-Number (UID)',
    lblMwst: 'Mehrwertsteuer (MWST)',
    lblMietbeginn: 'Mietbeginn',
    lblMinterm: 'Minimum Term',
    lblNotice: 'Notice Period',
    lblCompprot: 'Competition Prot.',
    lblSublease: 'Sublease',

    // 3.2 Heatmap Widgets
    widData: 'Found Data',
    widClauses: 'Detected Clauses',
    widMissing: 'Missing DACH-Baselines (Keywords)',

    // 3.3 Search Legend & Selection Menu
    legDate: 'Date',
    legClause: 'Clause',
    legBaseline: 'Baseline',
    allocTo: 'Allocate to:',
    btnAssign: 'Assign',

    // Selection dropdown options (If you decide to translate them via JS script map)
    optMenuAdresse: 'Adresse / Objekt',
    optMenuZweck: 'Zweck & Branche',
    optMenuFlaeche: 'Fläche',
    optMenuPreis: 'Total Preis (CHF)',
    optMenuNebenkosten: 'Nebenkosten (CHF)',
    optMenuKaution: 'Kaution (CHF)',
    optMenuMwstUID: 'MwSt-Nummer (UID)',
    optMenuDauer: 'Mindestdauer',
    optMenuFrist: 'Kündigungsfrist',
    optMenuKonkurrenz: 'Konkurrenzschutz',
    optMenuUntermiete: 'Untermiete',
    optMenuVermieter2: 'Vermieter / Eigentümer',
    optMenuMieter2: 'Mieter',
    optMenuMietbeginn2: 'Mietbeginn'
};