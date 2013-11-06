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


// refresh the graph
function refreshData() {
  // graphiteUrl is global
  getData(graphiteUrl, function(i, target) {
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


// retrieve dashboard list
function getDashboards(cb) {
  $.getJSON(".", function(d) {
    cb(d.dashboards);
  }).fail(function(xhr, textStatus, errorThrown) {
    console.log(errorThrown);
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
  for (var i=0; i<metrics.length; i++) {
    if (metrics[i].target === false) {
      $('.main').append('<div class="false"></div>');
      falseTargets++;
    } else {
      var j = i - falseTargets;
      var link_open = 'link' in metrics[i] ? '<a href="' + metrics[i].link + '" target="_new">' : '';
      var link_close = 'link' in metrics[i] ? '</a>' : '';
      var graph_div =
        '<div id="' + j + '" class="graph">' +
        '<div class="plot plot' + j + '"></div>' +
        '<span class="description description' + j + '"></span>' +
        link_open + '<div class="overlay-name overlay-name' + j + '"></div>' + link_close +
        '<div class="overlay-number overlay-number' + j + '"></div>' +
        '</div>';
      $('.main').append(graph_div);
    }
  }
}


// filter out false targets
gatherRealMetrics();

// build our div containers
buildContainers();

// build our graph objects
constructGraphs();

// build our url
constructUrl(period);


// set our theme
var myTheme = (typeof theme == 'undefined') ? 'default' : theme;
if (myTheme === 'dark') { enableNightMode(); }

// hide our toolbar if necessary
var toolbar = (typeof toolbar == 'undefined') ? true : toolbar;
if (!toolbar) { $('div.toolbar').css('display', 'none'); }

// initial load screen
for (var i=0; i<graphs.length; i++) {
  if (realMetrics[i].target === false) {
    //continue;
  } else if (myTheme === 'dark') {
    $('.overlay-number' + i + ' span').html('<img src="./i/spin-night.gif" />');
  } else {
    $('.overlay-number' + i).html('<img src="./i/spin.gif" />');
  }
}
refreshData();

// define our refresh and start interval
var refreshInterval = (typeof refresh == 'undefined') ? 10000 : refresh;
var refreshId = setInterval(refreshData, refreshInterval);

// set our 'live' interval hint
$('.toolbar ul li.timepanel a.play').text(period + 'min');

// populate and render our navigation list
function renderNavigationList() {
  getDashboards(function(list) {
    $('.title').off('hover', 'span');
    $('.title span').html('<select><option value="">welcome</option></select>');
    var selectObj = $('.title select');
    var currentDb = window.location.pathname.split('/').pop();
    for (var i in list) {
      if (list[i] === currentDb) {
        selectObj.append('<option selected="selected">' + list[i] + '</option>');
      } else {
        selectObj.append('<option>' + list[i] + '</option>');
      }
    }
    selectObj.focus();
  });
}

$('.title').on('hover', 'span', renderNavigationList);

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

// clear navigation list on focusout
$('.title span').on('focusout', 'select', function() {
  $('.title span').html(window.location.pathname.split('/').pop());
  $('.title').on('hover', 'span', renderNavigationList);
});

// navigate to selection
$('.title span').on('change', 'select', function() {
  var pathname = window.location.pathname.split('/');
  pathname.pop();
  pathname.push($(this).val());
  window.location.pathname = pathname.join('/');
});

// activate night mode
function enableNightMode() {
  $('body').addClass('night');
  $('div.title h1').addClass('night');
  $('div.graph div.plot').css('opacity', '0.8');
  $('span.description').addClass('night');
  $('div.overlay-name').addClass('night');
  $('div.overlay-number').addClass('night');
  $('div.toolbar ul li.timepanel').addClass('night');
}

// deactivate night mode
function disableNightMode() {
  $('body').removeClass('night');
  $('div.title h1').removeClass('night');
  $('div.graph div.plot').css('opacity', '1.0');
  $('span.description').removeClass('night');
  $('div.overlay-name').removeClass('night');
  $('div.overlay-number').removeClass('night');
  $('div.toolbar ul li.timepanel').removeClass('night');
}

// activate night mode by click
$('li.toggle-night').on('click', 'a', function() {
  if ($('body').hasClass('night')) {
    disableNightMode();
  } else {
    enableNightMode();
  }
});

// toggle number display
$('li.toggle-nonum').on('click', 'a', function() { $('div.overlay-number').toggleClass('nonum'); });

// time panel, pause live feed and show range
$('.toolbar ul li.timepanel').on('click', 'a.range', function() {
  var period = $(this).attr('title');
  constructUrl(period);
  if (! $('.toolbar ul li.timepanel a.play').hasClass('pause')) {
    $('.toolbar ul li.timepanel a.play').addClass('pause');
  }
  $('.toolbar ul li.timepanel a.play').text('paused');
  $(this).parent('li').parent('ul').find('li').removeClass('selected');
  $(this).parent('li').addClass('selected');
  refreshData();
  clearInterval(refreshId);
});

// time panel, resume live feed
$('.toolbar ul li.timepanel').on('click', 'a.play', function() {
  constructUrl(5);
  $(this).parent('li').parent('ul').find('li').removeClass('selected');
  $(this).parent('li').addClass('selected');
  $(this).removeClass('pause');
  $('.toolbar ul li.timepanel a.play').text(period + 'min');
  refreshData();
  // explicitly clear the old Interval in case
  // someone 'doubles up' on the live play button
  clearInterval(refreshId);
  // reapply our style settings if night mode is active
  if ($('body').hasClass('night')) { enableNightMode(); }
  // restart our refresh interval
  refreshId = setInterval(refreshData, refreshInterval);
});

}); // END $()
