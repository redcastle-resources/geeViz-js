///Module imports
// var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
/////////////////////////////////////////////////////////////////////////////
//Function to predict a CCDC harmonic model at a given time
//The whichHarmonics options are [1,2,3] - denoting which harmonics to include
//Which bands is a list of the names of the bands to predict across
function simpleCCDCPrediction(img,timeBandName,whichHarmonics,whichBands){
  //Unit of each harmonic (1 cycle)
  var omega = ee.Number(2.0).multiply(Math.PI);
  
  //Pull out the time band in the yyyy.ff format
  var tBand = img.select([timeBandName]);
  
  //Pull out the intercepts and slopes
  var intercepts = img.select(['.*_INTP']);
  var slopes = img.select(['.*_SLP']).multiply(tBand);
  
  //Set up the omega for each harmonic for the given time band
  var tOmega = ee.Image(whichHarmonics).multiply(omega).multiply(tBand);
  var cosHarm = tOmega.cos();
  var sinHarm = tOmega.sin();
  
  //Set up which harmonics to select
  var harmSelect = whichHarmonics.map(function(n){return ee.String('.*').cat(ee.Number(n).format())});
  
  //Select the harmonics specified
  var sins = img.select(['.*_SIN.*']);
  sins = sins.select(harmSelect);
  var coss = img.select(['.*_COS.*']);
  coss = coss.select(harmSelect);
  
  //Set up final output band names
  var outBns = whichBands.map(function(bn){return ee.String(bn).cat('_predicted')});
  
  //Iterate across each band and predict value
  var predicted = ee.ImageCollection(whichBands.map(function(bn){
    bn = ee.String(bn);
    return ee.Image([intercepts.select(bn.cat('_.*')),
                    slopes.select(bn.cat('_.*')),
                    sins.select(bn.cat('_.*')).multiply(sinHarm),
                    coss.select(bn.cat('_.*')).multiply(cosHarm)
                    ]).reduce(ee.Reducer.sum());
  })).toBands().rename(outBns);
  return img.addBands(predicted);
}
/////////////////////////////////////////////////////////////
//Wrapper to predict CCDC values from a collection containing a time image and ccdc coeffs
//It is also assumed that the time format is yyyy.ff where the .ff is the proportion of the year
//The whichHarmonics options are [1,2,3] - denoting which harmonics to include
function simpleCCDCPredictionWrapper(c,timeBandName,whichHarmonics){
  var whichBands = ee.Image(c.first()).select(['.*_INTP']).bandNames().map(function(bn){return ee.String(bn).split('_').get(0)});
  whichBands = ee.Dictionary(whichBands.reduce(ee.Reducer.frequencyHistogram())).keys().getInfo();
  var out = c.map(function(img){return simpleCCDCPrediction(img,timeBandName,whichHarmonics,whichBands)});
  return out;
}
////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////
//Function to get the coeffs corresponding to a given date on a pixel-wise basis
//The raw CCDC image is expected
//It is also assumed that the time format is yyyy.ff where the .ff is the proportion of the year
function getCCDCSegCoeffs(timeImg,ccdcImg,fillGaps){
  var coeffKeys = ['.*_coefs'];
  var tStartKeys = ['tStart'];
  var tEndKeys = ['tEnd'];
  var tBreakKeys = ['tBreak'];
  
  //Get coeffs and find how many bands have coeffs
  var coeffs = ccdcImg.select(coeffKeys);
  var bns = coeffs.bandNames();
  var nBns = bns.length();
  var harmonicTag = ee.List(['INTP','SLP','COS1','SIN1','COS2','SIN2','COS3','SIN3']);

   
  //Get coeffs, start and end times
  coeffs = coeffs.toArray(2);
  var tStarts = ccdcImg.select(tStartKeys);
  var tEnds = ccdcImg.select(tEndKeys);
  var tBreaks = ccdcImg.select(tBreakKeys);
  
  //If filling to the tBreak, use this
  tStarts = ee.Image(ee.Algorithms.If(fillGaps,tStarts.arraySlice(0,0,1).arrayCat(tBreaks.arraySlice(0,0,-1),0),tStarts));
  tEnds = ee.Image(ee.Algorithms.If(fillGaps,tBreaks.arraySlice(0,0,-1).arrayCat(tEnds.arraySlice(0,-1,null),0),tEnds));
  
  
  //Set up a mask for segments that the time band intersects
  var tMask = tStarts.lt(timeImg).and(tEnds.gte(timeImg)).arrayRepeat(1,1).arrayRepeat(2,1);
  coeffs = coeffs.arrayMask(tMask).arrayProject([2,1]).arrayTranspose(1,0).arrayFlatten([bns,harmonicTag]);
  
  //If time band doesn't intersect any segments, set it to null
  coeffs = coeffs.updateMask(coeffs.reduce(ee.Reducer.max()).neq(0));
  
  return timeImg.addBands(coeffs);
}
////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
//Bring in ccdc image asset
//This is assumed to be an image of arrays that is returned from the ee.Algorithms.TemporalSegmentation.Ccdc method
var ccdcImg =  ee.ImageCollection("projects/CCDC/USA_V2")
          .filter(ee.Filter.eq('spectral', 'SR'))
          .select(['tStart','tEnd','tBreak','changeProb',
                      'NDVI_.*','NBR_.*']);;
var f= ee.Image(ccdcImg.first());
ccdcImg = ee.Image(ccdcImg.mosaic().copyProperties(f));

//Specify which harmonics to use when predicting the CCDC model
//CCDC exports the first 3 harmonics (1 cycle/yr, 2 cycles/yr, and 3 cycles/yr)
//If you only want to see yearly patterns, specify [1]
//If you would like a tighter fit in the predicted value, include the second or third harmonic as well [1,2,3]
var whichHarmonics = [1];

//Whether to fill gaps between segments' end year and the subsequent start year to the break date
var fillGaps = true;

//Specify which band to use for loss and gain. 
//This is most important for the loss and gain magnitude since the year of change will be the same for all years
var changeDetectionBandName = 'NDVI';
//////////////////////////////////////////////////////////////////////
//Pull out some info about the ccdc image
var startJulian = ccdcImg.get('startJulian').getInfo();
var endJulian = ccdcImg.get('endJulian').getInfo();
var startYear = ccdcImg.get('startYear').getInfo();
var endYear = ccdcImg.get('endYear').getInfo();

//Add the raw array image
Map.addLayer(ccdcImg,{},'Raw CCDC Output',false);

//Extract the change years and magnitude
// var changeObj = dLib.ccdcChangeDetection(ccdcImg,changeDetectionBandName);
// Map.addLayer(changeObj.highestMag.loss.year,{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Loss Year');
// Map.addLayer(changeObj.highestMag.loss.mag,{min:-0.5,max:-0.1,palette:dLib.lossMagPalette},'Loss Mag',false);
// Map.addLayer(changeObj.highestMag.gain.year,{min:startYear,max:endYear,palette:dLib.gainYearPalette},'Gain Year');
// Map.addLayer(changeObj.highestMag.gain.mag,{min:0.05,max:0.2,palette:dLib.gainMagPalette},'Gain Mag',false);
function simpleGetTimeImageCollection(startYear,endYear,step){
  var yearImages = ee.ImageCollection(ee.List.sequence(startYear,endYear,step).map(function(n){
    n = ee.Number(n);
    var img = ee.Image(n).float().rename(['year']);
    var y = n.int16();
    var fraction = n.subtract(y);
    var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
    return img.set('system:time_start',d);
  }));
  return yearImages
}
function annualizeCCDC(ccdcImg,startYear,endYear,targetMonth,targetDay){
  var fraction = ee.Date.fromYMD(1900,targetMonth,targetDay).getFraction('year');
  var yearImages = simpleGetTimeImageCollection(ee.Number(startYear).add(fraction),ee.Number(endYear).add(fraction),1);
  predictCCDC(ccdcImg,yearImages,fillGaps,whichHarmonics)
}
annualizeCCDC(ccdcImg,startYear,endYear,9,1)


//Apply the CCDC harmonic model across a time series
//First get a time series of time images 
// var yearImages = getTimeImageCollection(startYear,endYear,startJulian,endJulian,0.1);

// //Then predict the CCDC models
// var fitted = predictCCDC(ccdcImg,yearImages,fillGaps,whichHarmonics);
// Map.addLayer(fitted.select(['.*_predicted']),{},'Fitted CCDC',false);


// fitted = fitted.map(function(img){
//   var ndvi = img.normalizedDifference(['nir_predicted','red_predicted']).rename(['NDVI_predicted_after']);
//   return img.addBands(ndvi);
// });
// Map.addLayer(fitted.select(['NDVI_predicted','NDVI_predicted_after']),{},'NDVI Fitted vs NDVI after',false);
// var diff = fitted.map(function(img){
//   return img.select(['NDVI_predicted']).subtract(img.select(['NDVI_predicted_after'])).pow(2);
// }).mean();
// Map.addLayer(diff,{min:0,max:0.01},'Mean sq diff NDVI before and after')
Map.setOptions('HYBRID');