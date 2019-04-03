/* Script by Jamp Vongkusolkit, 2019 */

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){

    //map frame dimensions
    var width = 960,
        height = 460;

    //create new svg container for the map
    var map = d3.select("body")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
    .center([0.00, 39])
    .rotate([97.36, 0, 0])
    .parallels([29.5, 45.5])
    .scale(850)
    .translate([width / 2, height / 2]);

    var path = d3.geoPath()
    .projection(projection);






    //use Promise.all to parallelize asynchronous data loading
    var promises = [];
    promises.push(d3.csv("../data/avocado-prices.csv")); //load attributes from csv
    promises.push(d3.json("../data/countries.topojson")); //load background spatial data
    promises.push(d3.json("data/states.topojson")); //load choropleth spatial data
    // promises.push(d3.json("data/FranceRegions.topojson")); //load choropleth spatial data
    Promise.all(promises).then(callback);

    function callback(data){
      csvData = data[0];
      countries = data[1];
      states = data[2];

      //create graticule generator
      var graticule = d3.geoGraticule()
          .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude


      //create graticule background
      var gratBackground = map.append("path")
          .datum(graticule.outline()) //bind graticule background
          .attr("class", "gratBackground") //assign class for styling
          .attr("d", path) //project graticule

      //create graticule lines
      var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
          .data(graticule.lines()) //bind graticule lines to each element to be created
          .enter() //create an element for each datum
          .append("path") //append each element to the svg as a path element
          .attr("class", "gratLines") //assign class for styling
          .attr("d", path); //project graticule lines

      //translate TopoJSON
      var worldCountries = topojson.feature(countries, countries.objects.ne_10m_admin_0_countries),
          unitedStates = topojson.feature(states, states.objects.cb_2017_us_state_500k).features;

      //add countries to map
      var countries = map.append("path")
          .datum(worldCountries)
          .attr("class", "countries")
          .attr("d", path);

      //add US states to map
      var regions = map.selectAll(".regions")
          .data(unitedStates)
          .enter()
          .append("path")
          .attr("class", function(d){
            console.log(d)
              return "regions " + d.properties.STATEFP;
          })
          .attr("d", path);




    };
};
