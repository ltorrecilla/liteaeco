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
// liteAECO - (ifc-optimizer-classes.js)
// ========

self.IFC_OPTIMIZER_RECOMMENDATIONS = [
    ['Structure', 'IfcMechanicalFastener', 100, 'Repeated bolts and screws.'],
    ['Structure', 'IfcFastener', 100, 'Repeated fixing and connection details.'],
    ['Structure', 'IfcReinforcingBar', 90, 'Retain for reinforcement coordination.'],
    ['Structure', 'IfcReinforcingMesh', 90, 'Retain for reinforcement coordination.'],
    ['Structure', 'IfcTendon', 85, 'Retain for prestressing coordination.'],
    ['Structure', 'IfcTendonAnchor', 85, 'Retain for anchorage coordination.'],
    ['Structure', 'IfcDiscreteAccessory', 80, 'Supports can affect installation clearances.'],
    ['Architecture', 'IfcFurniture', 60, 'Retain for furniture layout coordination.'],
    ['Architecture', 'IfcSystemFurnitureElement', 60, 'Retain for furniture layout coordination.'],
    ['Architecture', 'IfcFurnishingElement', 60, 'Review furnishings and equipment layouts.'],
    ['Documentation', 'IfcAnnotation', 50, 'Review annotations before removing them.'],
    ['Landscape', 'IfcGeographicElement', 40, 'May include essential terrain geometry.'],
    ['Controls', 'IfcSensor', 30, 'Retain for controls coordination.'],
    ['Controls', 'IfcActuator', 30, 'Retain for controls coordination.'],
    ['Controls', 'IfcController', 30, 'Retain for controls coordination.'],
    ['Controls', 'IfcFlowInstrument', 30, 'Retain for instrumentation coordination.'],
    ['Electrical', 'IfcOutlet', 20, 'Review device locations and access.'],
    ['Electrical', 'IfcSwitchingDevice', 20, 'Review switching and access requirements.'],
    ['Electrical', 'IfcJunctionBox', 20, 'Review connections and access requirements.'],
    ['Electrical', 'IfcCableFitting', 20, 'Retain connections for routing coordination.'],
    ['Lighting', 'IfcLamp', 20, 'Review lighting and maintenance requirements.'],
    ['Lighting', 'IfcLightFixture', 20, 'Retain locations for lighting coordination.'],
    ['HVAC', 'IfcDuctFitting', 15, 'Fittings affect routing and clearances.'],
    ['HVAC', 'IfcAirTerminal', 15, 'Retain locations for airflow coordination.'],
    ['HVAC', 'IfcVibrationIsolator', 15, 'Review supports and equipment clearances.'],
    ['Plumbing', 'IfcPipeFitting', 15, 'Fittings affect routing and clearances.'],
    ['Plumbing', 'IfcSanitaryTerminal', 15, 'Retain locations for layout coordination.'],
    ['MEP routing', 'IfcFlowSegment', 10, 'Routes affect clashes; boxes exaggerate bends.'],
    ['Plumbing', 'IfcPipeSegment', 10, 'Retain routes for piping coordination.'],
    ['HVAC', 'IfcDuctSegment', 10, 'Retain routes for duct coordination.'],
    ['Electrical', 'IfcCableSegment', 10, 'Retain routes for electrical coordination.'],
    ['Electrical', 'IfcCableCarrierSegment', 10, 'Retain routes and installation clearances.']
];
