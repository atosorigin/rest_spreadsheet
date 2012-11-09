

// Load table contents
	
$.ajaxSetup ({
    cache: true
});  
var ajax_load = "<img src='img/loading.gif' alt='loading...' />";  
//var loadUrl =  "incidents.htm"; 
var loadUrl =  "http://incidents.routetodigitallive.com:8080/incidents?Priority=Low&First%20Name=Lucy";
var queryString = null;
	
// Load all incidents on page load
$(document).ready(function() {
    $("#result").html(ajax_load).load(loadUrl);
})
	
$("#updateTable").click(function() { 			
    $("#result").html(ajax_load).load(loadUrl, queryString, function(){
        checkColumns();
        drawChart();
    });
});	
//setTimeout(function() { checkColumns(); drawChart(); }, 30); })
			
// Get Values of drop downs, build query string and then reload (for each dropdown)	
$("#reportedSourceSelect").change(function() {
    loadQueryString();		
});
$("#statusSelect").change(function() {
    loadQueryString();
});
$("#prioritySelect").change(function() {
    loadQueryString();
});
// Build query string 	
function loadQueryString() {
    var reportedSource = $("#reportedSourceSelect").val();
    var status =  $("#statusSelect").val();
    var priority = $("#prioritySelect").val();
    queryString = "?Reported Source=" + reportedSource + "&?Status=" + status + "&?Priority=" + priority;
}
	
// Check which columns are required
function checkColumns() {
    $("input[type=checkbox]:not(:checked)").each(
        function() { 
            var index = $(this).attr("name");
            $('table').find('td:nth-child(' + index + '),th:nth-child(' + index + ')').toggle();
        });
}	
		
		

	
// Toolbox Draw

$("#appDrawLink").click(function() {
    $("#toolboxDraw").toggle();
//var arrowImage = $("#appDrawImage").attr("src");
	
//if (arrowImage == 'img/downArrow.png')
//{
//	$("#appDrawImage").attr("src", "img/upArrow.png");
//}
//else if (arrowImage == 'img/upArrow.png')
//{
//	$("#appDrawImage").attr("src", "img/downArrow.png");
//}
	 
});

$("#graphButton").click(function() {
    setChartValues();
    drawChart();
    $("#chart_div").toggle();
//var arrowImage = $("#appDrawImage").attr("src");
	
//if (arrowImage == 'img/downArrow.png')
//{
//	$("#appDrawImage").attr("src", "img/upArrow.png");
//}
//else if (arrowImage == 'img/upArrow.png')
//{
//	$("#appDrawImage").attr("src", "img/downArrow.png");
//}
	 
});

// Add & remove columns

$("input:checkbox").click(function(){
    var index = $(this).attr("name");
    $('table').find('td:nth-child(' + index + '),th:nth-child(' + index + ')').toggle();
	
});


// Google chart
var lowPriority = 0;//$('table').find('td:nth-child(3),th:nth-child(3):contains("Low")').size();
var mediumPriority = 0 ; //$('table').find('td:nth-child(3),th:nth-child(3):contains("Medium")').size();
var highPriority = 0;


function sumOfColumns(columnIndex, hasHeader, search) {
    var tot = 0;
    $("table tr" + (hasHeader ? ":gt(0)" : "")).children("td:nth-child(" + columnIndex + ")").each(function() {
        if ($(this).html() == search)
            tot++;
    });
    return tot;
}

function setChartValues()
{
    lowPriority = sumOfColumns(3, 1, "Low");//$('table').find('td:nth-child(3),th:nth-child(3):contains("Low")').size();
    mediumPriority = sumOfColumns(3, 1, "Medium") ; //$('table').find('td:nth-child(3),th:nth-child(3):contains("Medium")').size();
    highPriority = sumOfColumns(3, 1, "High"); //$('table').find('td:nth-child(3),th:nth-child(3):contains("High")').size();
}


//Google example

// Load the Visualization API and the piechart package.
google.load('visualization', '1.0', {
    'packages':['corechart']
    });
      
// Set a callback to run when the Google Visualization API is loaded.
google.setOnLoadCallback(drawChart);
      
// Callback that creates and populates a data table, 
// instantiates the pie chart, passes in the data and
// draws it.
function drawChart() {
    //alert(mediumPriority);
    //alert(highPriority);
    // Create the data table.
    var data = new google.visualization.DataTable();
    data.addColumn('string', 'Priority');
    data.addColumn('number', 'Number');
    data.addRows([
        ['Low', lowPriority],
        ['Medium', mediumPriority],
        ['High', highPriority]
        ]);

    // Set chart options
    var options = {
        'title':'Incident Prioritys',
        'width':400,
        'height':300
    };

    // Instantiate and draw our chart, passing in some options.
    var chart = new google.visualization.PieChart(document.getElementById('chart_div'));
    chart.draw(data, options);
}
