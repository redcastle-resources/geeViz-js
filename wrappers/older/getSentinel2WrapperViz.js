/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var boulderMt = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-111.52744139733011, 38.1699537756843],
          [-111.52744139733011, 37.927710024593615],
          [-111.20334471764261, 37.927710024593615],
          [-111.20334471764261, 38.1699537756843]]], null, false),
    tushars = 
    /* color: #98ff00 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-112.58487547936136, 38.49957891519434],
          [-112.58487547936136, 38.28861908573503],
          [-112.23331297936136, 38.28861908573503],
          [-112.23331297936136, 38.49957891519434]]], null, false),
    redEdgeVizParams = {"opacity":1,"bands":["re1","re2","re3"],"min":0.20256242187301,"max":0.33442950850893194,"gamma":2.418};
/***** End of imports. If edited, may not auto-convert in the playground. *****/
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
/////////////////////////////////////////////////////////////////////////////
//User params
var args = {};
args.studyArea = boulderMt;//Draw study area on map and point to that variable name
args.startYear = 2018;
args.endYear = 2019;
args.startJulian = 190;
args.endJulian = 210;
args.applyTDOM = false;//Change to true if cloud shadow artifacts are a problem- will likely need to make the dimensions 500 or so in the getThumbURL call below 

//////////////////////////////////////////
//Get Images
//The TDOM stats are the mean and standard deviations of the two bands used in TDOM
//By default, TDOM uses the nir and swir1 bands
var preComputedTDOMStats = ee.ImageCollection('projects/USFS/TCC/TDOM_stats').mosaic().divide(10000);
args.preComputedTDOMIRMean = preComputedTDOMStats.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']);
args.preComputedTDOMIRStdDev = preComputedTDOMStats.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev']);
var s2s = getImagesLib.getProcessedSentinel2Scenes(args);
var composite = s2s.median();
var coeffsPredicted =getImagesLib.getHarmonicCoefficientsAndFit(s2s,['nir','swir1','swir2','NDVI']);
 //Get predicted values for visualization
  var predicted = coeffsPredicted[1];
  Map.addLayer(predicted,{},'harm predicted',false);
print('BandNames:',composite.bandNames());
/////////////////////////////////////////////
//Band names to choose from:
// ["blue",
//   "green",
//   "red",
//   "re1",
//   "re2",
//   "re3",
//   "nir",
//   "nir2",
//   "waterVapor",
//   "cirrus",
//   "swir1",
//   "swir2",
//   "NDVI",
//   "NBR",
//   "NDMI",
//   "NDSI",
//   "brightness",
//   "greenness",
//   "wetness",
//   "fourth",
//   "fifth",
//   "sixth",
//   "tcAngleBG",
//   ]
//Set up some options for stretching the data to rgb byte
var vizParamsFalse = {
  'min': 0.1, 
  'max': [0.5,0.6,0.6], 
  'bands': 'swir2,nir,red', 
  'gamma': 1.6
};
var vizParamsTrue = {
  'min': 0, 
  'max': [0.2,0.2,0.2], 
  'bands': 'red,green,blue', 
};
//Show some example options

//Example of using pre-defined params
Map.addLayer(composite,vizParamsTrue,'True Color',false);
Map.addLayer(composite,vizParamsFalse,'False Color',true);

//Example of hue, saturation, value transformation
Map.addLayer(composite.select(['brightness','greenness','wetness']).clamp(0,1).rgbToHsv(),{},'HSV',false);

//Example of using vizParams from the layer gui
Map.addLayer(composite,redEdgeVizParams,'Red Edge',false);

//Choose viz params to use for final output and make various thumbs
var vizParams = vizParamsFalse;
var url = composite
          .visualize(vizParams)//Convert to 3 band byte
          .getThumbURL({'dimensions':2000, 'region':args.studyArea,'format':'jpg'});
print('False:',url);

//Make thumb from vizParams from gui
var vizParams = redEdgeVizParams;
var url = composite
          .visualize(vizParams)//Convert to 3 band byte
          .getThumbURL({'dimensions':2000, 'region':args.studyArea,'format':'jpg'});
print('Red Edge:',url);

//Attempt at hue,saturation,value transform
var url = composite
          .select(['brightness','greenness','wetness'])
          .clamp(0,1)
          .rgbToHsv()//Convert to hue, saturation, value color space
          .visualize()//Convert to 3 band byte
          .getThumbURL({'dimensions':2000, 'region':args.studyArea,'format':'jpg'});
print('HSV:',url);


Map.setOptions('HYBRID');