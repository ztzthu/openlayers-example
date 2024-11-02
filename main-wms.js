import './style.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
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


const base_layer = new TileLayer({
        source: new OSM()
    });

const source = new VectorSource({wrapX: false});
const vector = new VectorLayer({
  source: source,
});

const wmsLayer = new TileLayer({
  source: new TileWMS({
    url: 'https://geoserver.swissdatacube.org/geoserver/wcs?',
    params: {
      'LAYERS': 'sdc:Ch_DEM1',
      'FORMAT': 'image/png'
    },
    // crossOrigin: 'anonymous'
  })
});

let layers = [base_layer, wmsLayer, vector];

const center = transform([8.5, 47], 'EPSG:4326', 'EPSG:3857');
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

draw.on('drawend', function (evt) {
  const rectangle = evt.feature.getGeometry();
  const [minX, minY, maxX, maxY]  = rectangle.getExtent();
  
  const center = [(minX + maxX) / 2, (minY + maxY) / 2];
  const viewResolution = map.getView().getResolution();

  const url = wmsLayer.getSource().getFeatureInfoUrl(
    center,
    viewResolution,
    'EPSG:3857',
    {
      'INFO_FORMAT': 'application/json'
    }
  );
  console.log('URL:', url);

  fetch(url)
    .then(response => response.json())
    .then(data => {
        if (data.features && data.features.length > 0) {
            // Extract elevation values
            const elevations = data.features[0].properties['GRAY_INDEX'];
            console.log(`Average Elevation: ${elevations.toFixed(2)} meters`);
        } else {
            console.log('No elevation data available for this area.');
        }
    })
    .catch(error => {
        console.error('Error fetching elevation data:', error);
        alert('Error fetching elevation data.');
    });

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