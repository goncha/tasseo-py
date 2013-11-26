// BEGIN: IE
window.console = window.console || (function(){
  var c = {}; c.log = c.warn = c.debug = c.info = c.error = c.time = c.dir = c.profile = c.clear = c.exception = c.trace = c.assert = function(){};
  return c;
})();

jQuery.support.cors = true;
// END: IE

$(function () {

var graphs;           // plot object
var aliases;          // alias strings
var descriptions;     // description strings
var realMetrics;      // non-false targets
var graphiteUrl;      // graphite render url


// Defined in DASHBOARD.js
// minutes of data in the live feed
var period = (typeof period == 'undefined') ? 5 : period;
// wrap keepLastValue around target to pad null values
var padnulls = (typeof padnulls == 'undefined') ? true : padnulls;


// gather our non-false targets
function gatherRealMetrics() {
  realMetrics = $.map(metrics, function(metric){
    if (metric.target === false) {
      return undefined;
    } else {
      return metric;
    }
  });
}


// build our graph objects
function constructGraphs() {
  aliases = $.map(realMetrics, function(metric) {
    return metric.alias || metric.target;
  });
  descriptions = $.map(realMetrics, function(metric) {
    return metric.description || "";
  });

  // global grid options
  var gridOptions = {
    grid: {
    show: false
    },
    xaxis: {
    tickFormatter: function() { return ""; }
    },
    yaxis: {
    tickFormatter: function() { return ""; }
    },
    colors: ['#afdab1']
  };

  graphs = $.map(realMetrics, function(metric, i) {
    var series = [{
      data: [[0,0]],
      lines: { fill: true }
    }];

    return $.plot('.plot' + i, series, gridOptions);
  });
}


// construct url
function constructUrl(period) {
  graphiteUrl = url + '/render?' + $.map(realMetrics, function(metric) {
    if (padnulls === true) {
      return ('target=keepLastValue(' + encodeURI(metric.target) + ')');
    } else {
      return ('target=' + encodeURI(metric.target));
    }
  }).join("&") + '&from=-' + period + 'minutes&format=json';
}


var refreshEnabled;   // auto refresh status

// refresh the graph
function refreshData(force) {
  force = (typeof force != 'undefined' && force === true);
  if (force) { $('.graph .overlay-spin').css('display', 'block'); }

  // graphiteUrl is global
  getData(graphiteUrl, function(i, target) {
    if (force) { $('.graph .overlay-spin').css('display', 'none'); }
    if (!refreshEnabled && !force) return;
    // normalize datapoints
    var xzero = target.datapoints[0][1];
    var d = $.map(target.datapoints, function(d) {
      return [[d[1]-xzero, d[0]]];
    });

    // check our thresholds and update color
    var lastValue = d[d.length-1][1];
    var warning = realMetrics[i].warning;
    var critical = realMetrics[i].critical;
    var color = null;
    if (lastValue != null) {
      if (lastValue >= critical) {
        color = '#d59295';
      } else if (lastValue >= warning) {
        color = '#f5cb56';
      } else {
        color = '#afdab1';
      }
    }

    updateGraph(i, d, color);
  });
}


// retrieve the data from Graphite
function getData(url, cb) {
  $.getJSON(url, function(targets) {
    if (targets.length > 0) {
      // call cb on each targets
      $.each(targets, cb);
    }
  }).fail(function(xhr, textStatus, errorThrown) {
    console.log(errorThrown);
  });
}


// perform the actual graph object and
// overlay name and number updates
function updateGraph(i, data, color) {
  // update graph
  var g = graphs[i];
   // must call before plot.setData to change color immediately
  if (color) g.getOptions().colors = [ color ];
  g.setData([{data: data, lines: { fill: true }}]);
  g.setupGrid();
  g.draw();

  // update overlay
  var lastPoint = data[data.length-1];
  if (lastPoint !== undefined) {
    var lastValue = lastPoint[1];
    var lastValueDisplay;
    if ((typeof lastValue == 'number') && lastValue < 2.0) {
      lastValueDisplay = Math.round(lastValue*1000)/1000;
    } else {
      lastValueDisplay = parseInt(lastValue);
    }
    if (realMetrics[i].description) {
      $('.description' + i).html('Note:<br /><br />' + descriptions[i]);
    }
    $('.overlay-name' + i).text(aliases[i]);
    $('.overlay-number' + i).text(lastValueDisplay);
    if (realMetrics[i].unit) {
      $('.overlay-number' + i).append('<span class="unit">' + realMetrics[i].unit + '</span>');
    }
  } else {
    $('.overlay-name' + i).text(aliases[i]);
    $('.overlay-number' + i).html('<span class="error">NF</span>');
  }
}


// add our containers
function buildContainers() {
  var falseTargets = 0;
  var colNumbers = 3;
  var rowObj;
  var containerObj = $("#graphs");
  for (var i=0; i<metrics.length; i++) {
    if (i % colNumbers === 0) {
      rowObj = $('<div class="row"></div>');
      containerObj.append(rowObj);
    }
    if (metrics[i].target === false) {
      rowObj.append('<div class="col-md-4 false"></div>');
      falseTargets++;
    } else {
      var j = i - falseTargets;
      var link_open = 'link' in metrics[i] ? '<a href="' + metrics[i].link + '" target="_new">' : '';
      var link_close = 'link' in metrics[i] ? '</a>' : '';
      var graph_div =
        '<div id="' + j + '" class="col-md-4 graph">' +
        '<div class="plot plot' + j + '"></div>' +
        '<span class="description description' + j + '"></span>' +
        link_open + '<div class="overlay-name overlay-name' + j + '"></div>' + link_close +
        '<div class="overlay-number overlay-number' + j + '"></div>' +
        '<div class="overlay-spin"></div>' +
        '</div>';
      rowObj.append(graph_div);
    }
  }
}

// contruct loading spin
function constructLoadingSpin() {
  var spinFile;
  if ($('#modepanel .mode-night').hasClass('btn-primary')) { // night mode on
    spinFile = 'spin-night.gif';   
  } else { // night mode off
    spinFile = 'spin.gif';
  }
  $('.graph .overlay-spin').html('<img src="./static/img/' + spinFile + '" />');
}

// filter out false targets
gatherRealMetrics();

// build our div containers
buildContainers();

// build our graph objects
constructGraphs();

// build our url
constructUrl(period);

// display description
$(document).on('mouseenter', 'div.graph', function() {
  if ($(this).find('span.description').text().length > 0) {
    $(this).find('span.description').css('visibility', 'visible');
  }
});

// hide description
$(document).on('mouseleave', 'div.graph', function() {
  $(this).find('span.description').css('visibility', 'hidden');
});

// activate night mode by click
$('#modepanel').on('click', 'button.mode-night', function() {
  var thisObj = $(this);
  thisObj.toggleClass('btn-primary');
  $('body').toggleClass('night');
  $('.navbar').toggleClass('navbar-inverse');
  $('div.graph div.plot').css('opacity', thisObj.hasClass('btn-primary') ? '0.8' : '1.0');
  $('span.description').toggleClass('night');
  $('div.overlay-name').toggleClass('night');
  $('div.overlay-number').toggleClass('night');
  constructLoadingSpin();
});

// toggle number mode display
$('#modepanel').on('click', 'button.mode-num', function() {
  $(this).toggleClass('btn-primary');
  $('div.overlay-number').toggleClass('nonum');
});

// time panel, pause live feed and show range
$('#timepanel').on('click', 'button.range', function() {
  var period = $(this).attr('title');
  constructUrl(period);
  if (! $('#timepanel button.play').hasClass('pause')) {
    $('#timepanel button.play').addClass('pause');
  }
  $('#timepanel button.play').text('paused');
  $(this).parent('div').find('button').removeClass('btn-primary');
  $(this).addClass('btn-primary');
  clearInterval(refreshId);
  refreshEnabled = false;
  refreshData(true);
});

// time panel, resume live feed
$('#timepanel').on('click', 'button.play', function() {
  constructUrl(period);
  $(this).parent('div').find('button').removeClass('btn-primary');
  $(this).addClass('btn-primary');
  $(this).removeClass('pause');
  $('#toolbar button.play').text(period + 'min');
  refreshEnabled = true;
  refreshData(true);
  // explicitly clear the old Interval in case
  // someone 'doubles up' on the live play button
  clearInterval(refreshId);
  // reapply our style settings if night mode is active
  if ($('body').hasClass('night')) { enableNightMode(); }
  // restart our refresh interval
  refreshId = setInterval(refreshData, refreshInterval);
});

// set night mode
var myTheme = (typeof theme == 'undefined') ? 'default' : theme;
if (myTheme === 'dark') { $('#modepanel button.mode-night').click(); }

// set loading spin based on night mode
constructLoadingSpin();

// set number mode
$('#modepanel .mode-num').addClass('btn-primary');

// hide our toolbar if necessary
var toolbar = (typeof toolbar == 'undefined') ? true : toolbar;
if (!toolbar) { $('#toolbar').css('display', 'none'); }

// initial load screen
refreshEnabled = true;
refreshData(true);

// define our refresh and start interval
var refreshInterval = (typeof refresh == 'undefined') ? 10000 : refresh;
var refreshId = setInterval(refreshData, refreshInterval);

// set our 'live' interval hint
$('#timepanel .play').text(period + 'min');
}); // END $()
