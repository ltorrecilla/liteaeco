window.PAGE_I18N = {
    // Meta & Header Info
    title: 'IFC Optimizer',
    subtitle: 'Reduce size of ifc models',
    ruleTitle: 'What this tool does',
    ruleDesc1: 'This tool optimizes single IFC files by deduplicating redundant information and geometric resources, trimming float precision, and utilizing Web-IFC for deep graph compression (tree-shaking) to significantly reduce the overall file size. If needed, it can also remove information about colors within the model or even completly remove property sets, quantities, and attribute values, leaving only the geometry.',

    // Step 1: Load Model
    step1: 'Load Model',
    file1Label: 'Select IFC Model',
    dropUpload: 'Load file',
    dropOr: 'or drag and drop',
    dropEmpty: 'No file selected',
    // ids are ui-drop1-upload / ui-drop1-or
    drop1Upload: 'Load file',
    drop1Or: 'or drag and drop',
    step2: 'Optimization Settings',

    // Step 2: Optimization Settings
    optLevel: 'Global Optimization Level',
    optLevelBadge: 'Higher = Slower',
    optLvlNone: 'None (Standard Processing)',
    optLvlLow: 'Low (Balanced)',
    optLvlMedium: 'Medium (Attribute Reduction)',
    optLvlHigh: 'High (Includes Storey Cleanup)',

    // Advanced Optimization Accordion
    advOptTitle: 'Advanced Optimization',
    
    // Web-IFC Column
    webifcOptTitle: 'Web-IFC Optimization',
    deepComp: 'Deep Graph Compression',
    deepCompDesc: 'Loads the model into memory to destructively prune dead graph elements.<br/>',
    deepCompWarn: 'Slowest, but highest compression.',
    stripPsets: 'Delete BIM Data (Property Sets & Quantities)',
    stripPsetsDesc: 'Removes <code class="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">IfcPropertySet</code> and related data. Massive size reduction, but objects lose attributes.',
    
    // Output Optimization Column
    outOptTitle: 'Output Optimization',
    floatPrec: 'Normalize float precision',
    floatPrecDesc: 'Trims excess decimal places from all numeric values',
    floatPrecDec: 'Decimal places:',
    dedupCol: 'Deduplicate colour definitions',
    dedupColDesc: 'Consolidates duplicate <code class="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">IFCCOLOURRGB</code> entities',
    guidRepair: 'Repair duplicate GlobalIds',
    guidRepairDesc: 'Regenerates the later copies of any duplicated <code class="bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-slate-600">GlobalId</code>. Unchecked: duplicates are only reported.',
    stripPres: 'Strip presentation & appearance data',
    stripPresDesc: 'Removes all visual styling entities.<br/>',
    stripPresWarn: 'Object colours will be lost.',
    
    // System log & Buttons
    btnOptimize: 'Optimize File', // Maps to btnText via your script
    sysLog: 'System Log Output',
    downloadText: 'Download Optimized Model'
};
