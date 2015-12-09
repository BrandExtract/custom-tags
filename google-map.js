function camelCaseMixin() {
  this.camelCase = function(dashedText) {
    return dashedText.replace(/-([a-z])/g, function(txt){
      return txt[1].toUpperCase();
    });
  }
}

<google-map>
  <yield/>

  <style scoped>
    :scope { display: block; }

    > div {
      width: 320px;
      height: 240px;
    }
  </style>

  <script>
    var tag = this, GM = google.maps;
    var zoom = opts.zoom || 3;
    var minZoom = opts['min-zoom'];
    var maxZoom = opts['max-zoom'];
    var center = (opts.center || '58.33,-98.52').split(',');
    var width = (opts.width || tag.root.offsetWidth || 320) + 'px';
    var height = (opts.height || tag.root.offsetHeight || 240) + 'px';
    var container = this.root;
    var markers = opts.markers || [];
    
    var mapOptions = {
      center: new google.maps.LatLng(center[0], center[1]),
      zoom: parseInt(zoom),
      minZoom: (minZoom && parseInt(minZoom)) || null,
      maxZoom: (maxZoom && parseInt(maxZoom)) || null,
      scaleControl: opts.scale,
      scrollwheel: opts.scrollwheel,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: opts.styles
    };
    
    if (opts.static) {
      mapOptions.disableDoubleClickZoom = true;
      mapOptions.draggable = false;
      mapOptions.mapTypeControl = false;
      mapOptions.panControl = false;
      mapOptions.rotateControl = false;
      mapOptions.scaleControl = false;
      mapOptions.scrollwheel = false;
      mapOptions.streetViewControl = false;
      mapOptions.zoomControl = false;
    }
    
    if (minZoom === maxZoom) {
      mapOptions.disableDoubleClickZoom = true;
      mapOptions.scaleControl = false;
      mapOptions.zoomControl = false;
    }

    function initialize() {
      var map = tag.map = new GM.Map(container, mapOptions);

      if (opts['load-geojson']) {
        map.data.loadGeoJson(opts['load-geojson']);
      }

      var geoJsonData = opts['add-geojson'];
      if (geoJsonData && geoJsonData.features.length > 0) {
        map.data.addGeoJson(geoJsonData);
        this.geojson = geoJsonData;
      }

      // Update so that the other tags know.
      tag.update();
      
      if (opts.bounds) {
        var latLngs = opts.bounds.split(',');
        var bounds = new google.maps.LatLngBounds();
        for (var i=0, count=latLngs.length; i<count; i+=2) {
          var latLng = new google.maps.LatLng(latLngs[i+1], latLngs[i]);
          bounds.extend(latLng);
        }
        
        map.fitBounds(bounds);
      }
      
      if (opts.static) return;
  
      GM.event.addListener(map.data, 'mouseover', function(dataMouseEvent) {
        var feature = dataMouseEvent.feature;
        opts.onmouseover && opts.onmouseover.call(tag, dataMouseEvent);
      });

      GM.event.addListener(map.data, 'mouseout', function(dataMouseEvent) {
        var feature = dataMouseEvent.feature;
        opts.onmouseout && opts.onmouseout.call(tag, dataMouseEvent);
      });

      GM.event.addListener(map, 'idle', function() {
        tag.update();
        if (opts.debug) {
          console.log('Idle at:', map.getCenter().toString());
        }
      });
    }

    this.on('mount', function() {
      initialize();
    });

    this.on('update', function() {
      var json = opts['add-geojson']
      if (this.map && json && json.features.length > 0 && json !== this.geojson) {
        this.map.data.addGeoJson(json);
        this.geojson = json;
      }

      if (this.map) {
        // Supports setting style for each feature
        this.map.data.setStyle(opts['set-style']);
      }
    });
  </script>
</google-map>

<fusion-layer>
  <script>
    var script = document.createElement('script');
    var url = ['https://www.googleapis.com/fusiontables/v1/query?'];
    url.push('sql=');
    var query = 'SELECT ' + opts.select + ' FROM ' + opts.from;
    if (opts.where) {
      query += ' WHERE ' + opts.where;
    }
    var encodedQuery = encodeURIComponent(query);
    url.push(encodedQuery);
    url.push('&callback=drawMap');
    //url.push('&key=AIzaSyAm9yWCV7JPCTHCJut8whOjARd7pwROFDQ');
    script.src = url.join('');
    //this.root.appendChild(script);
  
    this.on('update', function() {
      if (!opts.map) return;
      if (this.layer) return;
      var tag = this, layerOpts = {
        map: opts.map,
        heatmap: { enabled: opts.heatmap || false },
        query: {
          select: opts.select,
          from: opts.from,
          where: opts.where
        },
        styles: opts.styles,
        options: {
          styleId: opts['style-id'],
          templateId: opts['template-id']
        }
      };

      this.layer = new google.maps.FusionTablesLayer(layerOpts);
    });
  </script>
</fusion-layer>

<kml-layer>
  <script>
    this.mixin(new camelCaseMixin());

    this.on('update', function() {
      if (!opts.map) return;
      if (this.layer) return;
      var tag = this, layerOpts = {};

      for (var prop in opts) {
        if (opts.hasOwnProperty(prop)) {
          var item = opts[prop];
          layerOpts[this.camelCase(prop)] = item;
        }
      }

      this.layer = new google.maps.KmlLayer(layerOpts);
      google.maps.event.addListener(this.layer, 'click', function(kmlEvent) {
        tag.trigger('click', kmlEvent);
      });
    });
  </script>
</kml-layer>

<custom-overlay>
  <yield/>

  <style scoped>
    :scope { 
      display: block;
      position: absolute;
    }
  </style>

  var container = this.root, previousPosition;
  CustomOverlay.prototype = new google.maps.OverlayView();

  /** @constructor */
  function CustomOverlay(options) {
    if (options.map) {
      this.setMap(options.map);
    }
  }

  /**
   * onAdd is called when the map's panes are ready and the overlay has been
   * added to the map.
   */
  CustomOverlay.prototype.onAdd = function() {
    var panes = this.getPanes();
    panes[opts.pane || 'overlayMouseTarget'].appendChild(container);
  }

  CustomOverlay.prototype.draw = function() {
    var position = opts.position;
    if (!position) {
      container.style.left = '-99999px';
      container.style.top = '-99999px';
      return;
    }
    
    var overlayProjection = this.getProjection();
    if (!overlayProjection) return;
    
    var latlng;
    if (position[1]) {
      // Array passed from GIS
      latlng = new google.maps.LatLng(position[1], position[0]);
    } else if (position.lat) {
      latlng = position;
    }
    var point = overlayProjection.fromLatLngToDivPixel(latlng);
    container.style.left = point.x + 'px';
    container.style.top = point.y + 'px';
  }

  CustomOverlay.prototype.onRemove = function() {

  }

  this.attachedToMap = false;
  var marker = new CustomOverlay({
    map: opts.map
  });

  this.on('update', function() {
    if (!opts.map) return;
    marker.setMap(opts.map);
    marker.draw();
    this.attachedToMap = true;
  });
</custom-overlay>

<info-window>
  <yield/>

  <script>
    this.mixin(new camelCaseMixin());

    var opts = this.opts, options = {}, 
        notInfoWindowsOpts = ['map', 'position', 'name', 'info'];
    for (var prop in opts) {
      if (opts.hasOwnProperty(prop)) {
        if (notInfoWindowsOpts.indexOf(prop) > -1) continue;
        var item = opts[prop];
        options[this.camelCase(prop)] = item;
      }
    }

    var infowindow = this.infowindow = new google.maps.InfoWindow(options);
    // Because InfoWindow needs an anchor to open, we create an invisible marker with it.
    var marker = this.marker = new google.maps.Marker({
      clickable: false,
      visible: false
    });

    this.on('update', function() {
      if (!opts.map) return;
      var position = opts.position;
      if (!position) {
        infowindow.close();
        return;
      }

      // Move the marker to the updated position.
      if (position[1]) {
        position = {lng: position[0], lat: position[1]};
      }
      marker.setPosition(position);
      marker.setMap(opts.map);

      // Set InfoWindow's content from the yielded tag's children.
      infowindow.setContent(this.root.innerHTML);
      infowindow.open(opts.map, marker);
    });
  </script>
</info-window>

<raw-html>
  this.on('update', function() {
    this.root.innerHTML = opts.content
  });
</raw-html>
