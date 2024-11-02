import './style.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { StadiaMaps } from 'ol/source';
import TileWMS from 'ol/source/TileWMS.js';
import VectorSource from 'ol/source/Vector.js';
import VectorLayer from 'ol/layer/Vector.js';
import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js'; 
import {fromLonLat} from 'ol/proj';
import {createBox} from 'ol/interaction/Draw';
import Draw from 'ol/interaction/Draw.js';
import {bbox} from 'ol/loadingstrategy';
import {toLonLat, transform} from 'ol/proj';
// from Math import getWidth, getHeight;
import { getWidth, getHeight } from "ol/extent";
import {fromArrayBuffer} from 'geotiff';


const base_layer = new TileLayer({
        source: new StadiaMaps({
          // See our gallery for more styles: https://docs.stadiamaps.com/themes/
          layer: 'stamen_toner',
          retina: true,  // Set to false for stamen_watercolor
        }),
    });

const source = new VectorSource({wrapX: false});
const vector = new VectorLayer({
  source: source,
});

const wmsLayer = new TileLayer({
  source: new TileWMS({
    // url: 'https://geoserver.swissdatacube.org/geoserver/ows?SERVICE=WMS',
    url: 'https://geoportal.georhena.eu/geoserver/ows?SERVICE=WMS',
    params: {
      // 'LAYERS': 'sdc:Ch_DEM1',
      'LAYERS': 'basemaps:mnt_dem',
      'FORMAT': 'image/png'
    },
    // crossOrigin: 'anonymous'
  }),
  opacity: 0.5,
});

let layers = [base_layer, wmsLayer, vector];

const center = transform([8.5, 48.5], 'EPSG:4326', 'EPSG:3857');
const map = new Map({
    target: 'map',
    layers: layers,
    view: new View({
        center: center,
        zoom: 8
    })
});



let draw;
function addInteraction() {
  draw = new Draw({
    source: source,
    type: 'Circle',
    geometryFunction: createBox()
  });
  map.addInteraction(draw);
}
addInteraction();

draw.on('drawstart', function (evt) {
  source.clear();
});

////////////////////////////////////////
// Get GeoTiff and calculate avaerage from bbox
// bbox = [minX, minY, maxX, maxY]
////////////////////////////////////////

// function getElevationFromGeoTIFF(url, bbox) {
//   const [minX, minY, maxX, maxY] = bbox;

// }
async function calculateGeotiffAverage(url_prefix, bbox) {
  // try {
      // Get the url from url prefix and bbox
      // Example: https://geoserver.swissdatacube.org/geoserver/sdc/wms?service=WMS&version=1.1.0&request=GetMap&layers=sdc%3ACh_DEM1&srs=EPSG%3A3857&styles=&format=image%2Fgeotiff&bbox=639600%2C5729500%2C1174800%2C6072362&width=768&height=492
      // url_prefix example: https://geoserver.swissdatacube.org/geoserver/sdc/wms?service=WMS&version=1.1.0&request=GetMap&layers=sdc%3ACh_DEM1&srs=EPSG%3A3857&styles=&format=image%2Fgeotiff
      // Example for WCS service: https://geoportal.georhena.eu/geoserver/wcs?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=basemaps:mnt_dem&FORMAT=GeoTIFF&CRS=EPSG:4258&INTERPOLATION=nearest%20neighbor&BBOX=6.404821737%2C47.484411917%2C6.908502599%2C48.108964005&WIDTH=768&HEIGHT=492
      
      // Configure GeoServer first to support WGS 84 (EPSG:4326) or EPSG:3857, here the example only supports EPSG:4258
      // TODO: recheck if projection transformation is acceptable
      let [minX, minY, maxX, maxY] = bbox;
      [minX, minY] = transform([minX, minY], 'EPSG:3857', 'EPSG:4326');
      [maxX, maxY] = transform([maxX, maxY], 'EPSG:3857', 'EPSG:4326');

      const bbox_width = 400, bbox_height = parseInt(400 * (maxY - minY) / (maxX - minX));


      const url = `${url_prefix}&BBOX=${minX}%2C${minY}%2C${maxX}%2C${maxY}&WIDTH=${bbox_width}&HEIGHT=${bbox_height}`;
      // console.log('GeoTIFF URL:', url);

      // Fetch the GeoTIFF from the URL
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      // Read the GeoTIFF data
      const tiff = await fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();
      
      // Get the raster data
      const rasters = await image.readRasters();
      const width = image.getWidth();
      const height = image.getHeight();

      // Initialize sum and count for calculating average
      let sum = 0;
      let count = 0;

      // Assuming single-band GeoTIFF (e.g., DEM) so taking the first raster
      const rasterData = rasters[0];

      
      for (let i = 0; i < rasterData.length; i++) {
          // Ignore NoData values if specified in GeoTIFF metadata TODO: Check if this is correct
          if (rasterData[i] !== image.getGDALNoData()) {
              sum += rasterData[i];
              count++;
          }
      }

      // Calculate average
      const average = sum / count;
      console.log("Average Elevation:", average);
      return average;

  // } catch (error) {
  //     console.error("Error processing GeoTIFF:", error);
  // }
}


draw.on('drawend', function (evt) {
  const rectangle = evt.feature.getGeometry();
  const bbox = rectangle.getExtent();
  
  // const center = [(minX + maxX) / 2, (minY + maxY) / 2];
  // const viewResolution = map.getView().getResolution();
  const url_prefix = 'https://geoportal.georhena.eu/geoserver/wcs?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=basemaps:mnt_dem&FORMAT=GeoTIFF&CRS=EPSG:4258&INTERPOLATION=nearest%20neighbor';

  calculateGeotiffAverage(url_prefix, bbox);

  // const url = wmsLayer.getSource().getFeatureInfoUrl(
  //   center,
  //   viewResolution,
  //   'EPSG:3857',
  //   {
  //     'INFO_FORMAT': 'application/json'
  //   }
  // );
  // console.log('URL:', url);

  // fetch(url)
  //   .then(response => response.json())
  //   .then(data => {
  //       if (data.features && data.features.length > 0) {
  //           // Extract elevation values
  //           const elevations = data.features[0].properties['GRAY_INDEX'];
  //           console.log(`Average Elevation: ${elevations.toFixed(2)} meters`);
  //       } else {
  //           console.log('No elevation data available for this area.');
  //       }
  //   })
  //   .catch(error => {
  //       console.error('Error fetching elevation data:', error);
  //       alert('Error fetching elevation data.');
  //   });

});

// ////////////////////////////////////////
// // For the value in a rectangle
// ////////////////////////////////////////

// // Vector layer to hold the drawn rectangle
// const vectorSource = new VectorSource();
// const vectorLayer = new VectorLayer({
//     source: vectorSource
// });
// map.addLayer(vectorLayer);

// // Add draw interaction for drawing rectangles
// const draw = new Draw({
//     source: vectorSource,
//     type: 'Circle',  // Use Circle with max points for a rectangle
//     geometryFunction: createBox()
// });
// map.addInteraction(draw);

// // Listen for when the rectangle is drawn
// draw.on('drawend', function (evt) {
//     const rectangle = evt.feature.getGeometry();
//     const extent = rectangle.getExtent();

//     // Convert extent to longitude and latitude for WMS query
//     const [minX, minY, maxX, maxY] = extent;    //.map(coord => toLonLat([coord, coord])[0]);
//     const bbox = `${minX},${minY},${maxX},${maxY}`;

//     console.log('Bounding box:', bbox);

//     const center = [(minX + maxX) / 2, (minY + maxY) / 2]; // , 'EPSG:4326', 'EPSG:3857')
//     // const center = evt.coordinate;

//     // Construct GetFeatureInfo URL to get data within the bounding box
//     const viewResolution = map.getView().getResolution();

//     console.log('Center:', center);
//     console.log('Resolution:', viewResolution);
    
//     const url = wmsLayer.getSource().getFeatureInfoUrl(
//         center, // Center of the bounding box
//         viewResolution * Math.max(getWidth(extent), getHeight(extent)) / 100,
//         'EPSG:3857',
//         {
//             'INFO_FORMAT': 'application/json',
//             // 'QUERY_LAYERS': 'sdc:Ch_DEM1',
//             // 'BBOX': bbox, // Define bounding box in the request
//             // 'WIDTH': 100,  // Width of the sampling grid
//             // 'HEIGHT': 100  // Height of the sampling grid
//         }
//     );
//     console.log('URL:', url);
    

//     // Fetch and calculate the average elevation within the rectangle
//     fetch(url)
//         .then(response => response.json())
//         .then(data => {
//             if (data.features && data.features.length > 0) {
//                 // Extract elevation values
//                 const elevations = data.features.map(
//                     feature => feature.properties['GRAY_INDEX']
//                 );
                
//                 // Calculate the average elevation
//                 const sum = elevations.reduce((a, b) => a + b, 0);
//                 const avgElevation = sum / elevations.length;

//                 console.log(`Average Elevation: ${avgElevation.toFixed(2)} meters`);
//             } else {
//                 console.log('No elevation data available for this area.');
//             }
//         })
//         .catch(error => {
//             console.error('Error fetching elevation data:', error);
//             alert('Error fetching elevation data.');
//         });
// });

// ////////////////////////////////////////
// // For the value in a point
// ////////////////////////////////////////

// // Function to fetch elevation on click
// map.on('singleclick', function(evt) {
//   // Get the resolution of the map view at the clicked point
//   const viewResolution = map.getView().getResolution();

//   console.log('coordinate:', evt.coordinate);
//   console.log('viewResolution:', viewResolution);

//   // Construct the URL for the GetFeatureInfo request
//   const url = wmsLayer.getSource().getFeatureInfoUrl(
//       evt.coordinate,        // Coordinate clicked
//       viewResolution,         // Resolution at that coordinate
//       'EPSG:3857',            // Projection of the map view
//       {
//           'INFO_FORMAT': 'application/json' // Request JSON format to parse easily
//       }
//   );

//   console.log('URL:', url);

//   if (url) {
//       // Fetch the GetFeatureInfo result from the server
//       fetch(url)
//           .then(response => response.json())
//           .then(data => {
//               // Check if there's any elevation data in the response
//               if (data.features && data.features.length > 0) {
//                   const elevation = data.features[0].properties['GRAY_INDEX'];
//                   console.log(`Elevation: ${elevation} meters`);
//               } else {
//                   console.log('No elevation data available for this point.');
//               }
//           })
//           .catch(error => {
//               console.error('Error fetching elevation data:', error);
//               console.log('Error fetching elevation data.');
//           });
//   }
// });