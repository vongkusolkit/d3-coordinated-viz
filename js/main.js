/* Script by Jamp Vongkusolkit, 2019 */
(function(){

  //pseudo-global variables
  var attrArray = ["Average_Price_per_Avocado", "Total_Volume_of_Avocados", "Number_of_Small_Avocados", "Number_of_Large_Avocados", "Number_of_XLarge_Avocados", "Total_Bags_of_Avocados", "Small_Bags_of_Avocados", "Large_Bags_of_Avocados", "XLarge_Bags_of_Avocados"];
  var expressed = attrArray[0]; //initial attribute

  var yScale;
  var chart;

  //begin script when window loads
  window.onload = setMap();

  //set up choropleth map
  function setMap(){

      //map frame dimensions
      var width = window.innerWidth * 0.5,
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

        //place graticule on the map
        setGraticule(map, path);

        //translate TopoJSON
        var worldCountries = topojson.feature(countries, countries.objects.ne_10m_admin_0_countries),
            unitedStates = topojson.feature(states, states.objects.cb_2017_us_state_500k).features;

        //add countries to map
        var countries = map.append("path")
            .datum(worldCountries)
            .attr("class", "countries")
            .attr("d", path);


        //join csv data to GeoJSON enumeration units
        unitedStates = joinData(unitedStates, csvData);


        //create the color scale
        var colorScale = makeColorScale(csvData);

        //add enumeration units to the map
        setEnumerationUnits(unitedStates, map, path, colorScale);

        //add coordinated visualization to the map
        setChart(csvData, colorScale);
    };
  }; //end of setMap()


  function setGraticule(map, path){
      //...GRATICULE BLOCKS FROM MODULE 8
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
  };



  function joinData(unitedStates, csvData){
    //...DATA JOIN LOOPS FROM EXAMPLE 1.1
    //variables for data join
    var attrArray = ["Average_Price_per_Avocado", "Total_Volume_of_Avocados", "Number_of_Small_Avocados", "Number_of_Large_Avocados", "Number_of_XLarge_Avocados", "Total_Bags_of_Avocados", "Small_Bags_of_Avocados", "Large_Bags_of_Avocados", "XLarge_Bags_of_Avocados"];

    //loop through csv to assign each set of csv attribute values to geojson region
    for (var i=0; i<csvData.length; i++){
        var csvRegion = csvData[i]; //the current region
        var csvKey = csvRegion.STATEFP; //the CSV primary key

        //loop through geojson regions to find correct region
        for (var a=0; a<unitedStates.length; a++){

            var geojsonProps = unitedStates[a].properties; //the current region geojson properties
            var geojsonKey = geojsonProps.STATEFP; //the geojson primary key

            //where primary keys match, transfer csv data to geojson properties object
            if (geojsonKey == csvKey){

                //assign all attributes and values
                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]); //get csv attribute value
                    geojsonProps[attr] = val; //assign attribute and value to geojson properties
                });
            };
        };
    };

    return unitedStates;
};



  //function to create color scale generator
  function makeColorScale(data){
      var colorClasses = [
          "#edf8e9",
          "#c7e9c0",
          "#a1d99b",
          "#74c476",
          "#41ab5d",
          "#238b45",
          "#005a32"
      ];

      //create color scale generator
      var colorScale = d3.scaleThreshold()
          .range(colorClasses);

      //build array of all values of the expressed attribute
      var domainArray = [];
      for (var i=0; i<data.length; i++){
          var val = parseFloat(data[i][expressed]);
          domainArray.push(val);
      };

      //cluster data using ckmeans clustering algorithm to create natural breaks
      var clusters = ss.ckmeans(domainArray, 5);
      //reset domain array to cluster minimums
      domainArray = clusters.map(function(d){
          return d3.min(d);
      });
      //remove first value from domain array to create class breakpoints
      domainArray.shift();

      //assign array of last 4 cluster minimums as domain
      colorScale.domain(domainArray);

      return colorScale;
  };

  //function to set enumeration units
  function setEnumerationUnits(unitedStates, map, path, colorScale){

      //add regions to map
      var regions = map.selectAll(".regions")
          .data(unitedStates)
          .enter()
          .append("path")
          .attr("class", function(d){
              return "regions " + d.properties.STATEFP;
          })
          .attr("d", path)
          .style("fill", function(d){
              return choropleth(d.properties, colorScale);
          });
  };

  //function to test for data value and return color
  function choropleth(props, colorScale){
      //make sure attribute value is a number
      var val = parseFloat(props[expressed]);
      //if attribute value exists, assign a color; otherwise assign gray
      if (typeof val == 'number' && !isNaN(val)){
          return colorScale(val);
      } else {
          return "#CCC";
      };
  };

  //function to create coordinated bar chart
  function setChart(csvData, colorScale){
      //chart frame dimensions
      var chartWidth = window.innerWidth * 0.425,
          chartHeight = 473,
          leftPadding = 25,
          rightPadding = 2,
          topBottomPadding = 5,
          chartInnerWidth = chartWidth - leftPadding - rightPadding,
          chartInnerHeight = chartHeight - topBottomPadding * 2,
          translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

      //create a second svg element to hold the bar chart
      var chart = d3.select("body")
          .append("svg")
          .attr("width", chartWidth)
          .attr("height", chartHeight)
          .attr("class", "chart");

      //create a rectangle for chart background fill
      var chartBackground = chart.append("rect")
          .attr("class", "chartBackground")
          .attr("width", chartInnerWidth)
          .attr("height", chartInnerHeight)
          .attr("transform", translate);

      //create a scale to size bars proportionally to frame and for axis
      var yScale = d3.scaleLinear()
          .range([463, 0])
          .domain([0, d3.max(csvData, function (d) {return parseFloat(d[expressed])*1.1;})]);

      //set bars for each province
      var bars = chart.selectAll(".bar")
          .data(csvData)
          .enter()
          .append("rect")
          .sort(function(a, b){
              return b[expressed]-a[expressed]
          })
          .attr("class", function(d){
              return "bar " + d.STATEFP;
          })
          .attr("width", chartInnerWidth / csvData.length - 1)
          .attr("x", function(d, i){
              return i * (chartInnerWidth / csvData.length) + leftPadding;
          })
          .attr("height", function(d, i){
              return 463 - yScale(parseFloat(d[expressed]));
          })
          .attr("y", function(d, i){
              return yScale(parseFloat(d[expressed])) + topBottomPadding;
          })
          .style("fill", function(d){
              return choropleth(d, colorScale);
          });

      //create a text element for the chart title
      var title = expressed.replace(/_/g, " ");
      var chartTitle = chart.append("text")
          .attr("x", 40)
          .attr("y", 40)
          .attr("class", "chartTitle")
          .text(title + " Sold in Each State");

      //create vertical axis generator
      var yAxis = d3.axisLeft()
          .scale(yScale);

      //place axis
      var axis = chart.append("g")
          .attr("class", "axis")
          .attr("transform", translate)
          .call(yAxis);

      //create frame for chart border
      var chartFrame = chart.append("rect")
          .attr("class", "chartFrame")
          .attr("width", chartInnerWidth)
          .attr("height", chartInnerHeight)
          .attr("transform", translate);
  };


})(); //last line of main.js
