/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = 
    /* color: #d63000 */
    /* displayProperties: [
      {
        "type": "rectangle"
      },
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.MultiPolygon(
        [[[[-107.28502557958218, 37.95180391281335],
           [-107.28502557958218, 37.57181970608451],
           [-106.70549677098843, 37.57181970608451],
           [-106.70549677098843, 37.95180391281335]]],
         [[[-118.93183248812555, 36.94269993936479],
           [-118.93183248812555, 36.74928026456],
           [-118.63520162875055, 36.74928026456],
           [-118.63520162875055, 36.94269993936479]]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
///Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');

dLib.getExistingChangeData();
///////////////////////////////////////////////////////////////////////////////
// Define user parameters:
var args = {};

// Specify study area: Study area
// Can be a featureCollection, feature, or geometry
args.studyArea = geometry;//getImagesLib.testAreas.CA;

// Update the startJulian and endJulian variables to indicate your seasonal 
// constraints. This supports wrapping for tropics and southern hemisphere.
// If using wrapping and the majority of the days occur in the second year, the system:time_start will default 
// to June 1 of that year.Otherwise, all system:time_starts will default to June 1 of the given year
// startJulian: Starting Julian date 
// endJulian: Ending Julian date
args.startJulian = 190;
args.endJulian = 250; 

// Specify start and end years for all analyses
// More than a 3 year span should be provided for time series methods to work 
// well. If providing pre-computed stats for cloudScore and TDOM, this does not 
// matter
args.startYear = 2010;
args.endYear = 2019;

// Choose whether to include Landat 7
// Generally only included when data are limited
args.includeSLCOffL7 = false;

//Choose whether to use the Chastain et al 2019(https://www.sciencedirect.com/science/article/pii/S0034425718305212)
//harmonization method
//All harmonization models apply a rather small correction and are likely not needed
args.runChastainHarmonization = false;

//If available, bring in preComputed cloudScore offsets and TDOM stats
//Set to null if computing on-the-fly is wanted
//These have been pre-computed for all CONUS for Landsat and Setinel 2 (separately)
//and are appropriate to use for any time period within the growing season
//The cloudScore offset is generally some lower percentile of cloudScores on a pixel-wise basis
var preComputedCloudScoreOffset = ee.ImageCollection('projects/USFS/TCC/cloudScore_stats').mosaic();
args.preComputedLandsatCloudScoreOffset = preComputedCloudScoreOffset.select(['Landsat_CloudScore_p10']);
args.preComputedSentinel2CloudScoreOffset = preComputedCloudScoreOffset.select(['Sentinel2_CloudScore_p10']);

//The TDOM stats are the mean and standard deviations of the two bands used in TDOM
//By default, TDOM uses the nir and swir1 bands
var preComputedTDOMStats = ee.ImageCollection('projects/USFS/TCC/TDOM_stats').mosaic().divide(10000);
args.preComputedLandsatTDOMIRMean = preComputedTDOMStats.select(['Landsat_nir_mean','Landsat_swir1_mean']);
args.preComputedLandsatTDOMIRStdDev = preComputedTDOMStats.select(['Landsat_nir_stdDev','Landsat_swir1_stdDev']);

args.preComputedSentinel2TDOMIRMean = preComputedTDOMStats.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']);
args.preComputedSentinel2TDOMIRStdDev = preComputedTDOMStats.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev']);


//List of acceptable sensors
//Options include: 'LANDSAT_4', 'LANDSAT_5', 'LANDSAT_7','LANDSAT_8','Sentinel-2A', 'Sentinel-2B'
var sensorList = [ 'LANDSAT_4', 'LANDSAT_5', 'LANDSAT_7','LANDSAT_8','Sentinel-2A', 'Sentinel-2B'];

//Whether to offset the years so the intercept values aren't too large
//Set to -1900 if you want intercepts to be closer to the mean of the value of the band/index
//Any pixel with a steep slope will have a very high/low intercept
//Set to 0 if you want the years to remain as they are
var nYearOffset = 0;

// Set up Names for the export
args.outputName = 'CCDC-Test';

// Provide location composites will be exported to
// This should be an asset folder, or more ideally, an asset imageCollection
args.exportPathRoot = 'users/iwhousman/test/ChangeCollection';


// CRS- must be provided.  
// Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
// WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
args.crs = 'EPSG:5070';

// Specify transform if scale is null and snapping to known grid is needed
args.transform = [30,0,-2361915.0,0,-30,3177735.0];

// Specify scale if transform is null
args.scale = null;

//How many segments to export
//Agricultural and wetland areas generally will need about 1 for every 2-5 years
//Other areas need about 1 for every 10-30 years
var nSegments = 9;
///////////////////////////////////////////////////////////////////////
//CCDC Params
var ccdcParams ={
  breakpointBands:['green','red','nir','swir1','swir2','NDVI'],//The name or index of the bands to use for change detection. If unspecified, all bands are used.//Can include: 'blue','green','red','nir','swir1','swir2'
                                                              //'NBR','NDVI','wetness','greenness','brightness','tcAngleBG'
  tmaskBands : null,//['green','swir2'],//The name or index of the bands to use for iterative TMask cloud detection. These are typically the green band and the SWIR2 band. If unspecified, TMask is not used. If specified, 'tmaskBands' must be included in 'breakpointBands'., 
  minObservations: 6,//Factors of minimum number of years to apply new fitting.
  chiSquareProbability: 0.99,//The chi-square probability threshold for change detection in the range of [0, 1],
  minNumOfYearsScaler: 1.33,//Factors of minimum number of years to apply new fitting.,\
  lambda: 0.002,//Lambda for LASSO regression fitting. If set to 0, regular OLS is used instead of LASSO
  maxIterations : 25000, //Maximum number of runs for LASSO regression convergence. If set to 0, regular OLS is used instead of LASSO.
  dateFormat : 1 //'fractional' (1) is the easiest to work with. It is the time representation to use during fitting: 0 = jDays, 1 = fractional years, 2 = unix time in milliseconds. The start, end and break times for each temporal segment will be encoded this way.
  
}; 

///////////////////////////////////////////////////////////////////////
// End user parameters
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
//Start function calls

////////////////////////////////////////////////////////////////////////////////
//Call on master wrapper function to get Landat scenes and composites
var processedScenes = getImagesLib.getProcessedLandsatAndSentinel2Scenes(args);

//Filter to only include wanted sensors
processedScenes = processedScenes.filter(ee.Filter.inList('sensor',ee.List(sensorList)));

//Remove any extremely high band/index values
processedScenes = processedScenes.map(function(img){
  var lte1 = img.select(['blue','green','nir','swir1','swir2']).lte(1).reduce(ee.Reducer.min());
  return img.updateMask(lte1);
});
Map.addLayer(processedScenes)


ccdcParams.collection = processedScenes;
//Run CCDC
var ccdc = ee.Algorithms.TemporalSegmentation.Ccdc(ccdcParams);

ccdc = ccdc.set(args);
ccdc = ccdc.set(ccdcParams)
print(ccdc)
Map.addLayer(ccdc)
//Export output
Export.image.toAsset(ccdc, args.outputName, args.exportPathRoot +'/'+args.outputName , {'.default':'sample'}, null, args.studyArea, args.scale, args.crs, args.transform, 1e13);


// //Convert to image stack
// var ccdcImg = dLib.buildCcdcImage(ccdc, nSegments);
// // ccdcImg = ccdcImg.updateMask(ccdcImg.neq(-32768));
// Map.addLayer(ccdcImg)
// //Find the segment count for each pixel
// var count = ccdcImg.select(['.*tStart']).selfMask().reduce(ee.Reducer.count());
// Map.addLayer(count,{min:1,max:nSegments},'Segment Count');

// //Set up time series for predicting values
// processedScenes = processedScenes.map(getImagesLib.addYearYearFractionBand);
// ccdcParams.breakpointBands.push('.*_predicted');

// var change = dLib.getCCDCChange(ccdcImg);

// Map.addLayer(change.breakLossYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Most Recent Break Loss Year',false);
// Map.addLayer(change.segLossYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Most Recent Seg Loss Year',false);

// Map.addLayer(change.breakGainYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.gainYearPalette},'Most Recent Break Gain Year',false);
// Map.addLayer(change.segGainYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.gainYearPalette},'Most Recent Seg Gain Year',false);
// // // Export.Image.toDrive(changeYears.lossYears.reduce(ee.Reducer.max()),)  
  
// //Predict CCDC model and visualize the actual vs. predicted
// var predicted = dLib.predictCCDC(ccdcImg,processedScenes).select(ccdcParams.breakpointBands);
// Map.addLayer(predicted,{},'Predicted CCDC',false);

// // //Visualize the seasonality of the first segment
// // var seg1 = ccdcImg.select(['S1.*']);
// // var sinCoeffs = seg1.select(['.*_SIN']);
// // var cosCoeffs = seg1.select(['.*_COS']);
// // var bands = ['.*swir2.*','.*nir.*','.*red.*'];
// // // var band = 'B4.*';
// // var phase = sinCoeffs.atan2(cosCoeffs)
// //                     .unitScale(-Math.PI, Math.PI);
 
// // var amplitude = sinCoeffs.hypot(cosCoeffs)
// //                     // .unitScale(0, 1)
// //                     .multiply(2);
// // Map.addLayer(phase.select(bands),{min:0,max:1},'phase',false);
// // Map.addLayer(amplitude.select(bands),{min:0,max:0.6},'amplitude',true);

// //Set export asset properties
// ccdcImg = ccdcImg.set(ccdcParams).float();
// ccdcImg = ccdcImg.set({
//   'startYear':startYear,
//   'endYear':endYear,
//   'useLandsat':useLandsat,
//   'useS2':useS2,
//   'nSegments':nSegments
// })
//   .float();


Map.setOptions('HYBRID');