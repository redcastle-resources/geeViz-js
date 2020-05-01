/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-108.28163961476221, 39.25451132142729],
          [-108.28163961476221, 36.68265794564914],
          [-104.55727438038721, 36.68265794564914],
          [-104.55727438038721, 39.25451132142729]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
///Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib.js');
var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');

dLib.getExistingChangeData();
///////////////////////////////////////////////////////////////////////////////
// Define user parameters:

// 1. Specify study area: Study area
// Can specify a country, provide a fusion table  or asset table (must add 
// .geometry() after it), or draw a polygon and make studyArea = drawnPolygon
var studyArea = geometry;//paramDict[studyAreaName][3];

// 2. Update the startJulian and endJulian variables to indicate your seasonal 
// constraints. This supports wrapping for tropics and southern hemisphere.
// startJulian: Starting Julian date 
// endJulian: Ending Julian date
var startJulian = 1;
var endJulian = 365; 

// 3. Specify start and end years for all analyses
// More than a 3 year span should be provided for time series methods to work 
// well. If using Fmask as the cloud/cloud shadow masking method, this does not 
// matter
var startYear = 1984;
var endYear = 2020;





// 7. Choose Top of Atmospheric (TOA) or Surface Reflectance (SR) 
// Specify TOA or SR
// Current implementation does not support Fmask for TOA
var toaOrSR = 'SR';

// 8. Choose whether to include Landat 7
// Generally only included when data are limited
var includeSLCOffL7 = false;

//9. Whether to defringe L5
//Landsat 5 data has fringes on the edges that can introduce anomalies into 
//the analysis.  This method removes them, but is somewhat computationally expensive
var defringeL5 = false;

// 10. Choose cloud/cloud shadow masking method
// Choices are a series of booleans for cloudScore, TDOM, and elements of Fmask
//Fmask masking options will run fastest since they're precomputed
//CloudScore runs pretty quickly, but does look at the time series to find areas that 
//always have a high cloudScore to reduce comission errors- this takes some time
//and needs a longer time series (>5 years or so)
//TDOM also looks at the time series and will need a longer time series
var applyCloudScore = false;
var applyFmaskCloudMask = true;

var applyTDOM = false;
var applyFmaskCloudShadowMask = true;

var applyFmaskSnowMask = true;

// 11. Cloud and cloud shadow masking parameters.
// If cloudScoreTDOM is chosen
// cloudScoreThresh: If using the cloudScoreTDOMShift method-Threshold for cloud 
//    masking (lower number masks more clouds.  Between 10 and 30 generally 
//    works best)
var cloudScoreThresh = 20;

// Percentile of cloud score to pull from time series to represent a minimum for 
// the cloud score over time for a given pixel. Reduces comission errors over 
// cool bright surfaces. Generally between 5 and 10 works well. 0 generally is a
// bit noisy
var cloudScorePctl = 10; 

// zScoreThresh: Threshold for cloud shadow masking- lower number masks out 
//    less. Between -0.8 and -1.2 generally works well
var zScoreThresh = -1;

// shadowSumThresh: Sum of IR bands to include as shadows within TDOM and the 
//    shadow shift method (lower number masks out less)
var shadowSumThresh = 0.35;

// contractPixels: The radius of the number of pixels to contract (negative 
//    buffer) clouds and cloud shadows by. Intended to eliminate smaller cloud 
//    patches that are likely errors
// (1.5 results in a -1 pixel buffer)(0.5 results in a -0 pixel buffer)
// (1.5 or 2.5 generally is sufficient)
var contractPixels = 1.5; 

// dilatePixels: The radius of the number of pixels to dilate (buffer) clouds 
//    and cloud shadows by. Intended to include edges of clouds/cloud shadows 
//    that are often missed
// (1.5 results in a 1 pixel buffer)(0.5 results in a 0 pixel buffer)
// (2.5 or 3.5 generally is sufficient)
var dilatePixels = 2.5;

// 12. correctIllumination: Choose if you want to correct the illumination using
// Sun-Canopy-Sensor+C correction. Additionally, choose the scale at which the
// correction is calculated in meters.
var correctIllumination = false;
var correctScale = 250;//Choose a scale to reduce on- 250 generally works well

//13. Export params
//Whether to export composites
var exportComposites = false;

//Set up Names for the export
var outputName = 'CCDC_Test3';

//Provide location composites will be exported to
//This should be an asset folder, or more ideally, an asset imageCollection
var exportPathRoot = 'users/iwhousman/test/CCDC_Collection/';

// var exportPathRoot = 'projects/USFS/LCMS-NFS/R4/BT/Base-Learners/Base-Learners-Collection';
//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
var crs = 'EPSG:5070';

//Specify transform if scale is null and snapping to known grid is needed
var transform = [30,0,-2361915.0,0,-30,3177735.0];

//Specify scale if transform is null
var scale = null;

//How many segments to export
//Agricultural and wetland areas generally will need about 1 for every 2-5 years
//Other areas need about 1 for every 10-30 years
var nSegments = 9;
///////////////////////////////////////////////////////////////////////
//CCDC Parsams
var ccdcParams ={
  breakpointBands:['blue','green','red','nir','swir1','swir2','NDVI','NBR'],//The name or index of the bands to use for change detection. If unspecified, all bands are used.//Can include: 'blue','green','red','nir','swir1','swir2'
                                                              //'NBR','NDVI','wetness','greenness','brightness','tcAngleBG'
  tmaskBands : null,//['green','swir1'],//The name or index of the bands to use for iterative TMask cloud detection. These are typically the green band and the SWIR2 band. If unspecified, TMask is not used. If specified, 'tmaskBands' must be included in 'breakpointBands'., 
  minObservations: 6,//Factors of minimum number of years to apply new fitting.
  chiSquareProbability: 0.99,//The chi-square probability threshold for change detection in the range of [0, 1],
  minNumOfYearsScaler: 1.33,//Factors of minimum number of years to apply new fitting.,\
  lambda: 0.002,//Lambda for LASSO regression fitting. If set to 0, regular OLS is used instead of LASSO
  maxIterations : 25000 //Maximum number of runs for LASSO regression convergence. If set to 0, regular OLS is used instead of LASSO.
}; 

///////////////////////////////////////////////////////////////////////
// End user parameters
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
//Start function calls

////////////////////////////////////////////////////////////////////////////////
//Call on master wrapper function to get Landat scenes and composites
var processedScenes = getImagesLib.getProcessedLandsatScenes(studyArea,startYear,endYear,startJulian,endJulian,
  toaOrSR,includeSLCOffL7,defringeL5,applyCloudScore,applyFmaskCloudMask,applyTDOM,
  applyFmaskCloudShadowMask,applyFmaskSnowMask,
  cloudScoreThresh,cloudScorePctl,contractPixels,dilatePixels
  ).map(getImagesLib.addSAVIandEVI);


processedScenes = processedScenes.select(ccdcParams.breakpointBands);
Map.addLayer(processedScenes,{},'Raw Time Series',false);

ccdcParams.dateFormat = 1;
ccdcParams.collection = processedScenes;
var ccdc = ee.Algorithms.TemporalSegmentation.Ccdc(ccdcParams);


var ccdcImg = dLib.buildCcdcImage(ccdc, nSegments);

var count = ccdcImg.select(['.*tStart']).selfMask().reduce(ee.Reducer.count());
Map.addLayer(count,{min:1,max:nSegments},'Segment Count');
processedScenes = processedScenes.map(getImagesLib.addYearYearFractionBand);
ccdcParams.breakpointBands.push('.*_predicted');

var predicted = dLib.predictCCDC(ccdcImg,processedScenes).select(ccdcParams.breakpointBands);
Map.addLayer(predicted,{},'Predicted CCDC',false);

var seg1 = ccdcImg.select(['S1.*']);
var sinCoeffs = seg1.select(['.*_SIN']);
var cosCoeffs = seg1.select(['.*_COS']);
var bands = ['.*swir2.*','.*nir.*','.*red.*'];
// var band = 'B4.*';
var phase = sinCoeffs.atan2(cosCoeffs)
                    .unitScale(-Math.PI, Math.PI);
 
var amplitude = sinCoeffs.hypot(cosCoeffs)
                    // .unitScale(0, 1)
                    .multiply(2);
Map.addLayer(phase.select(bands),{min:0,max:1},'phase',false);
Map.addLayer(amplitude.select(bands),{min:0,max:0.6},'amplitude',true);


Export.image.toAsset(ccdcImg.float(), outputName, exportPathRoot +outputName , null, null, geometry, scale, crs, transform, 1e13)

Map.setOptions('HYBRID');