window.PAGE_I18N = {
    // Specific Content Elements
    title: 'IFC Merger',
    subtitle: 'Join several ifc models into one',
    ruleTitle: 'What this tool does',
    ruleDesc1: 'Join several IFC models into one single new IFC file, it has been tested with models up to 500MB, just give it some time.<br/> This webapp performs relational ID-swapping to unify IFC spatial trees, resolving the multiple <code class="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-700">IFCPROJECT</code> issue by combining Secondary models relationships onto a Main model hierarchy. It can also automatically detect/scale raw coordinates and swept-solid parameters on unit mismatch.<br/>Additionally you can optimize the filesize of the newly generated IFC Modell by removing information about colors, rounding comma values or even removing psets and properties that you do not need for the coordination.',
    step1: 'Load Models',
    file1Label: 'Main Model (File 1)',
    file2Label: 'Secondary Model/s to Append (You can select more than 1 IFC File)',
    dropUpload: 'Upload file',
    dropOr: 'or drag and drop',
    dropEmpty: 'No file selected',
    // ids are ui-drop1-upload / ui-drop1-or / ui-drop2-upload / ui-drop2-or
    drop1Upload: 'Load file',
    drop1Or: 'or drag and drop',
    drop2Upload: 'Load multiple files',
    drop2Or: 'or drag and drop',
    step2: 'Spatial Hierarchy Settings',
    siteHandling: 'IfcSite Handling',
    siteMerge: 'Merge sites into one',
    siteKeep: 'Keep separated',
    buildingHandling: 'IfcBuilding Handling',
    buildingMerge: 'Merge buildings into one',
    buildingKeep: 'Keep separated',
    storeyHandling: 'IfcBuildingStorey Handling',
    storeyExp: 'Experimental',
    storeyName: 'Merge by name (Recommended)',
    storeyElev: 'Merge by elevation',
    storeyKeep: 'Keep separated storeys',
    step3: 'Process & Output',
    btnMerge: 'Merge Files',
    btnDownload: 'Download Master Model',

    // Global Optimization Select
    optLevel: 'Global Optimization Level',
    optLevelBadge: 'Higher = Slower',
    optLvlNone: 'None (Fastest Processing)',
    optLvlLow: 'Low (Balanced)',
    optLvlMedium: 'Medium (Attribute Reduction)',
    optLvlHigh: 'High (Includes Storey Cleanup)',
    
    // Advanced Optimization Block
    advOptTitle: 'Advanced Optimization',
    
    // Web-IFC Column
    webifcOptTitle: 'Web-IFC Optimization',
    deepComp: 'Deep Graph Compression',
    deepCompDesc: 'Loads the model into memory to destructively prune heavy graph elements.<br/>',
    deepCompWarn: 'Slowest, but highest compression.',
    stripPsets: 'Delete BIM Data (Property Sets & Quantities)',
    stripPsetsDesc: 'Removes <code class="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">IfcPropertySet</code> and related data. Massive size reduction, but objects will lose their psets and attributes.',
    
    // Metadata block (Already had IDs in HTML, but missing in JS)
    metaHandling: 'Metadata Handling (IfcOwnerHistory)',
    metaKeep: 'Preserve original authors (Safe)',
    metaMerge: 'Overwrite with Master file metadata (Optimizes size)',
    
    // Output Optimization Column
    outOptTitle: 'Output Optimization',
    floatPrec: 'Normalize float precision',
    floatPrecDesc: 'Trims excess decimal places from all numeric values',
    floatPrecDec: 'Decimal places:',
    dedupCol: 'Deduplicate colour definitions',
    dedupColDesc: 'Consolidates duplicate <code class="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">IFCCOLOURRGB</code> entities',
    stripPres: 'Strip presentation & appearance data',
    stripPresDesc: 'Removes all visual styling entities such as colours, surface styles, layer assignments.<br/>',
    stripPresWarn: 'Object colours will be lost.',
    
    // System log & Button tweaks
    sysLog: 'System Log Output',
    downloadText: 'Download Merged Model'
};
