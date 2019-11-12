/* Script by Jamp Vongkusolkit, 2019 */
(function () {

	//pseudo-global variables

	//array with all column headers
	var attrArray = ["Average Price per Avocado", "Total Volume of Avocados", "Number of Small Avocados", "Number of Large Avocados", "Number of XLarge Avocados", "Total Bags of Avocados", "Small Bags of Avocados", "Large Bags of Avocados", "XLarge Bags of Avocados"];

	//initial attribute
	var expressed = attrArray[0];
	//create a scale to size bars proportionally to frame and for axis
	var yScale;
	//var to access the chart
	var chart;

	//chart frame dimensions
	var chartWidth = window.innerWidth * 0.425,
		chartHeight = 473,
		leftPadding = 25,
		rightPadding = 2,
		topBottomPadding = 5,
		chartInnerWidth = chartWidth - leftPadding - rightPadding,
		chartInnerHeight = chartHeight - topBottomPadding * 2,
		translate = "translate(" + leftPadding + "," + topBottomPadding + ")";


	//begin script when window loads
	window.onload = setMap();

	//set up choropleth map
	function setMap() {
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
			.scale(750)
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

		function callback(data) {
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

			//add dropdown menu to map
			createDropdown(csvData);

			//add coordinated visualization to the map
			setChart(csvData, colorScale);

			createLegend(csvData, expressed);
		};

	}; //end of setMap()


	//function to create a dropdown menu for attribute selection
	function createDropdown(csvData) {
		//add select element
		var dropdown = d3.select("body")
			.append("select")
			.attr("class", "dropdown")
			.on("change", function () {
				changeAttribute(this.value, csvData)
			});

		//add initial option
		var titleOption = dropdown.append("option")
			.attr("class", "titleOption")
			.attr("disabled", "true")
			.text("Average Price per Avocado");

		//add attribute name options
		var attrOptions = dropdown.selectAll("attrOptions")
			.data(attrArray)
			.enter()
			.append("option")
			.attr("value", function (d) {
				return d
			})
			.text(function (d) {
				return d
			});
	};

	//dropdown change listener handler
	function changeAttribute(attribute, csvData) {
		//change the expressed attribute
		expressed = attribute;

		//recreate the color scale
		var colorScale = makeColorScale(csvData);

		//recolor enumeration units
		var regions = d3.selectAll(".regions")
			.transition()
			.duration(1000)
			.style("fill", function (d) {
				return choropleth(d.properties, colorScale)
			});

		//re-sort, resize, and recolor bars
		var bars = d3.selectAll(".bar")
			//re-sort bars
			.sort(function (a, b) {
				return b[expressed] - a[expressed];
			})
			.transition() //add animation
			.delay(function (d, i) {
				return i * 20
			})
			.duration(500);

		updateChart(bars, csvData.length, colorScale);

		createLegend(csvData, expressed);
	}; //end of changeAttribute()


	function setGraticule(map, path) {
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

	function joinData(unitedStates, csvData) {
		//variables for data join

		//loop through csv to assign each set of csv attribute values to geojson region
		for (var i = 0; i < csvData.length; i++) {
			var csvRegion = csvData[i]; //the current region
			var csvKey = csvRegion.STUSPS; //the CSV primary key

			//loop through geojson regions to find correct region
			for (var a = 0; a < unitedStates.length; a++) {

				var geojsonProps = unitedStates[a].properties; //the current region geojson properties
				var geojsonKey = geojsonProps.STUSPS; //the geojson primary key

				//where primary keys match, transfer csv data to geojson properties object

				if (geojsonKey == csvKey) {
					//assign all attributes and values
					attrArray.forEach(function (attr) {
						var val = parseFloat(csvRegion[attr]); //get csv attribute value

						geojsonProps[attr] = val; //assign attribute and value to geojson properties
					});
				};
			};
		};

		return unitedStates;
	};


	//function to create color scale generator
	function makeColorScale(data) {
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
		for (var i = 0; i < data.length; i++) {
			var val = parseFloat(data[i][expressed]);
			domainArray.push(val);
		};

		//cluster data using ckmeans clustering algorithm to create natural breaks
		var clusters = ss.ckmeans(domainArray, 7);
		//reset domain array to cluster minimums
		domainArray = clusters.map(function (d) {
			return d3.min(d);
		});

		classes = clusters.map(function (d) {
			return d3.min(d);
		});
		//remove first value from domain array to create class breakpoints
		domainArray.shift();

		//assign array of last 4 cluster minimums as domain
		colorScale.domain(domainArray);

		return colorScale;
	};

	//function to set enumeration units
	function setEnumerationUnits(unitedStates, map, path, colorScale) {

		//add regions to map
		var regions = map.selectAll(".regions")
			.data(unitedStates)
			.enter()
			.append("path")
			.attr("class", function (d) {
				return "regions " + d.properties.STUSPS;
			})
			.attr("d", path)
			.style("fill", function (d) {
				return choropleth(d.properties, colorScale);
			})
			//regions event listeners
			.on("mouseover", function (d) {
				highlight(d.properties);
			})
			.on("mouseout", function (d) {
				dehighlight(d.properties);
			})
			.on("mousemove", moveLabel);

		//add style descriptor to each path
		var desc = regions.append("desc")
			.text('{"stroke": "#000", "stroke-width": "0.5px"}');
	};

	//function to test for data value and return color
	function choropleth(props, colorScale) {
		//make sure attribute value is a number
		var val = parseFloat(props[expressed]);
		//if attribute value exists, assign a color; otherwise assign gray
		if (typeof val == 'number' && !isNaN(val)) {
			return colorScale(val);
		} else {
			return "#e0e2e4";
		};
	};

	//function to create coordinated bar chart
	function setChart(csvData, colorScale) {
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
		chart = d3.select("body")
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
		yScale = d3.scaleLinear()
			.range([463, 0])
			.domain([0, d3.max(csvData, function (d) {
				return parseFloat(d[expressed]) * 1.1;
			})]);

		//set bars for each state
		var bars = chart.selectAll(".bar")
			.data(csvData)
			.enter()
			.append("rect")
			.sort(function (a, b) {
				return b[expressed] - a[expressed]
			})
			.attr("class", function (d) {
				return "bar " + d.STUSPS;
			})
			.attr("width", chartInnerWidth / csvData.length - 1)
			//bars event listeners
			.on("mouseover", highlight)
			.on("mouseout", dehighlight)
			.on("mousemove", moveLabel);

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
		//set bar positions, heights, and colors

		updateChart(bars, csvData.length, colorScale);

		//add style descriptor to each rect
		var desc = bars.append("desc")
			.text('{"stroke": "none", "stroke-width": "0px"}');
	}; //end of setChart()

	//function to position, size, and color bars in chart
	function updateChart(bars, n, colorScale) {

		var yScale = d3.scaleLinear()
			.range([463, 0])
			.domain([0, d3.max(csvData, function (d) {

				return parseFloat(d[expressed]) * 1.1;

			})]);

		var yAxis = d3.axisLeft()
			.scale(yScale)
			.tickSize(0)
			.ticks(10, "s");

		chart.selectAll("g.axis")
			.call(yAxis);

		//position bars
		bars.attr("x", function (d, i) {
				return i * (chartInnerWidth / n) + leftPadding;
			})
			//size/resize bars
			.attr("height", function (d, i) {
				return 463 - yScale(parseFloat(d[expressed]));
			})
			.attr("y", function (d, i) {
				return yScale(parseFloat(d[expressed])) + topBottomPadding;
			})
			//color/recolor bars
			.style("fill", function (d) {
				return choropleth(d, colorScale);
			});
		//update chart title
		var title = expressed.replace(/_/g, " ");
		var chartTitle = d3.select(".chartTitle")
			.text(title + " Sold in Each State");
	};

	//function to highlight enumeration units and bars
	function highlight(props) {
		//change stroke
		var selected = d3.selectAll("." + props.STUSPS)
			.style("opacity", "0.1")
		setLabel(props);
	};

	//function to reset the element style on mouseout
	function dehighlight(props) {
		var selected = d3.selectAll("." + props.STUSPS)
			.style("opacity", function () {
				return getStyle(this, "opacity")
			})


		function getStyle(element, styleName) {
			var styleText = d3.select(element)
				.select("desc")
				.text();

			var styleObject = JSON.parse(styleText);

			return styleObject[styleName];
		};
		//remove info label
		d3.select(".infolabel")
			.remove();
	};

	//function to create dynamic label
	function setLabel(props) {

		//Check for data on the state, replace "undefined" if no data
		if (props[expressed] == undefined) {
			var cur_label = "No Data"
		} else {
			var cur_label = props[expressed]
		}

		//label content
		var labelAttribute = "<h1>" + cur_label +
			"</h1><b>" + expressed + "</b>";

		//create info label div
		var infolabel = d3.select("body")
			.append("div")
			.attr("class", "infolabel")
			.attr("id", props.STUSPS + "_label")
			.html(labelAttribute);

		var regionName = infolabel.append("div")
			.attr("class", "labelname")
			.html(props.STUSPS);
	};

	//function to move info label with mouse
	function moveLabel() {
		//get width of label
		var labelWidth = d3.select(".infolabel")
			.node()
			.getBoundingClientRect()
			.width;

		//use coordinates of mousemove event to set label coordinates
		var x1 = d3.event.clientX + 10,
			y1 = d3.event.clientY - 75,
			x2 = d3.event.clientX - labelWidth - 10,
			y2 = d3.event.clientY + 25;

		//horizontal label coordinate, testing for overflow
		var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
		//vertical label coordinate, testing for overflow
		var y = d3.event.clientY < 75 ? y2 : y1;

		d3.select(".infolabel")
			.style("left", x + "px")
			.style("top", y + "px");
	};

	//function to create legend
	function createLegend(csvData, expressed) {
		var quantize = d3.scaleQuantize()
			.domain([0, d3.max(csvData, function (d) {
				return parseFloat(d[expressed]) * 1.1;
			})])
			.range(["rgb(237,248,233)", "rgb(199,233,192)", "rgb(161,217,155)", "rgb(116,196,118)", "rgb(65,171,93)", "rgb(35,139,69)", "rgb(0,90,50)"]);


		d3.select("body").append("svg").attr("class", "legendsvg");
		var svg = d3.select(".legendsvg");

		svg.append("g")
			.attr("class", "legendQuant")
			.attr("transform", "translate(20,20)");


		var legend = d3.legendColor()
			.labelFormat(d3.format(".2f"))
			.scale(quantize);

		svg.select(".legendQuant")
			.call(legend);

	};

})(); //last line of main.js
