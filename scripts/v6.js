/**
 * v6.js is a JavaScript Graphic Library.
 *
 * p5.js:
 * https://github.com/processing/p5.js/
 *
 * MIT License
 *
 * Copyright (c) 2017-2018 SILENT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
;( function ( window, undefined ) {

'use strict';

var document = window.document,
    scotch = window.peako,
    warn = window.console && window.console.warn || scotch.noop,
    err = window.console && window.console.error || scotch.noop,
    floor = Math.floor,
    round = Math.round,
    atan2 = Math.atan2,
    rand = Math.random,
    sqrt = Math.sqrt,
    cos = Math.cos,
    sin = Math.sin,
    min = Math.min,
    max = Math.max,
    pi = Math.PI,
    renderer_index = -1;

var support = {
  webgl: function ( canvas ) {
    if ( typeof canvas.getContext != 'function' ) {
      return 0;
    }

    var has_context = function ( canvas, type ) {
      try {
        if ( canvas.getContext( type ) ) {
          return true;
        }
      } catch ( ex ) {
        warn( ex );
      }

      return false;
    };

    return has_context( canvas, 'webgl' ) ?
      1 : has_context( canvas, 'webgl-experemental' ) ?
      2 : 0;
  }( document.createElement( 'canvas' ) )
};

var v6 = function ( options ) {
  if ( options && options.mode === 'webgl' ) {
    if ( support.webgl ) {
      return new RendererWebGL( options );
    }

    warn( 'Can not get WebGL context. Falling back to 2D context' );
  }

  return new Renderer2D( options );
};

var settings = {
  degrees: false
};

var default_options = {
  settings: {
    scale: 1,
    smooth: false,
    colorMode: 'rgba'
  },

  mode: '2d',
  alpha: true
};

var map = function ( value, start1, stop1, start2, stop2 ) {
  return ( ( value - start1 ) / ( stop1 - start1 ) ) * ( stop2 - start2 ) + start2;
};

var dist = function ( x1, y1, x2, y2 ) {
  return sqrt( ( x2 - x1 ) * ( x2 - x1 ) + ( y2 - y1 ) * ( y2 - y1 ) );
};

var lerp_color = function ( a, b, value ) {
  return ( typeof a != 'object' ? parse_color( a ) : a ).lerp( b, value );
};

var clone_style = function ( style, object ) {
  object.rectAlignX = style.rectAlignX;
  object.rectAlignY = style.rectAlignY;
  object.doFill = style.doFill;
  object.doStroke = style.doStroke;
  object.fillStyle[ 0 ] = style.fillStyle[ 0 ];
  object.fillStyle[ 1 ] = style.fillStyle[ 1 ];
  object.fillStyle[ 2 ] = style.fillStyle[ 2 ];
  object.fillStyle[ 3 ] = style.fillStyle[ 3 ];
  object.font.style = style.font.style;
  object.font.variant = style.font.variant;
  object.font.weight = style.font.weight;
  object.font.size = style.font.size;
  object.font.family = style.font.family;
  object.lineHeight = style.lineHeight;
  object.lineWidth = style.lineWidth;
  object.strokeStyle[ 0 ] = style.strokeStyle[ 0 ];
  object.strokeStyle[ 1 ] = style.strokeStyle[ 1 ];
  object.strokeStyle[ 2 ] = style.strokeStyle[ 2 ];
  object.strokeStyle[ 3 ] = style.strokeStyle[ 3 ];
  object.textAlign = style.textAlign;
  object.textBaseline = style.textBaseline;
  return object;
};

var set_image_smoothing = function ( context, value ) {
  context.imageSmoothingEnabled =
    context.oImageSmoothingEnabled =
    context.msImageSmoothingEnabled =
    context.mozImageSmoothingEnabled =
    context.webkitImageSmoothingEnabled = value;

  return context.imageSmoothingEnabled;
};

var align = function ( value, size, align ) {
  switch ( align ) {
    case 'left':
    case 'top':
      return value;

    case 'center':
    case 'middle':
      return value - size * 0.5;

    case 'right':
    case 'bottom':
      return value - size;
  }

  return 0;
};

/* FILTERS */

var filters = {
  negative: function ( data ) {
    var r = data.length - 4,
        g, b;

    for ( ; r >= 0; r -= 4 ) {
      data[ r ] = 255 - data[ r ];
      data[ g = r + 1 ] = 255 - data[ g ];
      data[ b = r + 2 ] = 255 - data[ b ];
    }

    return data;
  },

  contrast: function ( data ) {
    var r = data.length - 4,
        g, b;

    for ( ; r >= 0; r -= 4 ) {
      data[ r ] = data[ g = r + 1 ] = data[ b = r + 2 ] = ( data[ r ] * 299 + data[ g ] * 587 + data[ b ] * 114 ) / 1000;
    }

    return data;
  },

  sepia: function ( data ) {
    var rindex = data.length - 4,
        gindex, bindex, r, g, b;

    for ( ; rindex >= 0; rindex -= 4 ) {
      r = data[ rindex ];
      g = data[ gindex = rindex + 1 ];
      b = data[ bindex = rindex + 2 ];
      data[ rindex ] = r * 0.393 + g * 0.769 + b * 0.189;
      data[ gindex ] = r * 0.349 + g * 0.686 + b * 0.168;
      data[ bindex ] = r * 0.272 + g * 0.534 + b * 0.131;
    }

    return data;
  }
};

/* TICKER */

var ticker = function ( update, render ) {
  return new Ticker( update, render );
};

var Ticker = function ( update, render ) {
  var ticker = this,
      tick = ticker.tick;

  if ( render === undefined ) {
    render = update;
    update = scotch.noop;
  }

  ticker.lasttime = scotch.timestamp();
  ticker.update = update;
  ticker.render = render;

  ticker.boundtick = function () {
    tick.call( ticker, undefined, true );
  };
};

Ticker.prototype = scotch.create( null );
Ticker.prototype.constructor = Ticker;
Ticker.prototype.step = 1 / 60;
Ticker.prototype.skipped = Ticker.prototype.lastid = Ticker.prototype.idoffset = Ticker.prototype.total = 0;
Ticker.prototype.stopped = true;

Ticker.prototype.tick = function ( fps, requested ) {
  if ( this.stopped ) {
    if ( requested ) {
      return this;
    }

    this.stopped = false;
  }

  if ( fps !== undefined ) {
    this.step = 1 / fps;
  }

  var now = scotch.timestamp(),
      dt = min( 5, ( now - this.lasttime ) * 0.001 );

  this.skipped += dt;
  this.total += dt;

  while ( this.skipped > this.step ) {
    this.skipped -= this.step;
    this.update.call( this, this.step );
  }

  this.render.call( this, dt );
  this.lasttime = now;
  this.lastid = scotch.requestframe( this.boundtick );
  return this;
};

Ticker.prototype.clear = function () {
  var id = this.lastid,
      off = this.idoffset;

  this.idoffset = id;

  while ( id > off ) {
    scotch.cancelframe( --id );
  }

  return this;
};

Ticker.prototype.stop = function () {
  return this.stopped = true, this;
};

/* VECTOR2D */

var vec2 = function ( x, y ) {
  return new Vector2D( x, y );
};

var Vector2D = function ( x, y ) {
  this.set( x, y );
};

Vector2D.prototype = scotch.create( null );
Vector2D.prototype.constructor = Vector2D;
Vector2D.prototype.length = 2;

Vector2D.prototype.set = function ( x, y ) {
  if ( x != null && typeof x == 'object' ) {
    this[ 0 ] = x[ 0 ] || 0;
    this[ 1 ] = x[ 1 ] || 0;
  } else {
    this[ 0 ] = x || 0;
    this[ 1 ] = y || 0;
  }

  return this;
};

Vector2D.prototype.lerp = function ( x, y, value ) {
  if ( x != null && typeof x == 'object' ) {
    this[ 0 ] += ( x[ 0 ] - this[ 0 ] ) * y || 0;
    this[ 1 ] += ( x[ 1 ] - this[ 1 ] ) * y || 0;
  } else {
    this[ 0 ] += ( x - this[ 0 ] ) * value || 0;
    this[ 1 ] += ( y - this[ 1 ] ) * value || 0;
  }

  return this;
};

Vector2D.prototype.add = function ( x, y ) {
  if ( x != null && typeof x == 'object' ) {
    this[ 0 ] += x[ 0 ] || 0;
    this[ 1 ] += x[ 1 ] || 0;
  } else {
    this[ 0 ] += x || 0;
    this[ 1 ] += y || 0;
  }

  return this;
};

Vector2D.prototype.sub = function ( x, y ) {
  if ( x != null && typeof x == 'object' ) {
    this[ 0 ] -= x[ 0 ] || 0;
    this[ 1 ] -= x[ 1 ] || 0;
  } else {
    this[ 0 ] -= x || 0;
    this[ 1 ] -= y || 0;
  }

  return this;
};

Vector2D.prototype.mult = function ( value ) {
  this[ 0 ] = this[ 0 ] * value || 0;
  this[ 1 ] = this[ 1 ] * value || 0;
  return this;
};

Vector2D.prototype.div = function ( value ) {
  this[ 0 ] = this[ 0 ] / value || 0;
  this[ 1 ] = this[ 1 ] / value || 0;
  return this;
};

Vector2D.prototype.angle = function () {
  return settings.degrees ?
    atan2( this[ 1 ], this[ 0 ] ) * 180 / pi :
    atan2( this[ 1 ], this[ 0 ] );
};

Vector2D.prototype.mag = function () {
  return sqrt( this[ 0 ] * this[ 0 ] + this[ 1 ] * this[ 1 ] );
};

Vector2D.prototype.magSq = function () {
  return this[ 0 ] * this[ 0 ] + this[ 1 ] * this[ 1 ];
};

Vector2D.prototype.setMag = function ( value ) {
  return this.normalize().mult( value );
};

Vector2D.prototype.normalize = function () {
  var mag = this.mag();

  return mag && mag !== 1 ?
    this.div( mag ) : this;
};

Vector2D.prototype.rotate = function ( angle ) {

  if ( settings.degrees ) {
    angle = angle * pi / 180 + this.angle();
  } else {
    angle += this.angle();
  }

  var length = this.mag();

  this[ 0 ] = length * cos( angle );
  this[ 1 ] = length * sin( angle );

  return this;

};

Vector2D.prototype.dot = function ( x, y ) {
  return x != null && typeof x == 'object' ?
    this[ 0 ] * ( x[ 0 ] || 0 ) + this[ 1 ] * ( x[ 1 ] || 0 ) :
    this[ 0 ] * ( x || 0 ) + this[ 1 ] * ( y || 0 );
};

Vector2D.prototype.copy = function () {
  return new Vector2D( this[ 0 ], this[ 1 ] );
};

Vector2D.prototype.dist = function ( vector ) {
  return dist( this[ 0 ], this[ 1 ], vector[ 0 ], vector[ 1 ] );
};

Vector2D.prototype.limit = function ( value ) {
  var mag = this.magSq();

  return mag > value * value && ( mag = sqrt( mag ) ) ?
    this.div( mag ).mult( value ) : this;
};

Vector2D.prototype.cross = function( vector ) {
  return Vector2D.cross( this, vector );
};

Vector2D.prototype.toString = function () {
  return 'vec2(' + ( floor( this[ 0 ] * 100 ) * 0.01 ) + ', ' + ( floor( this[ 1 ] * 100 ) * 0.01 ) + ')';
};

/* VECTOR3D */

var vec3 = function ( x, y, z ) {
  return new Vector3D( x, y, z );
};

var Vector3D = function ( x, y, z ) {
  this.set( x, y, z );
};

Vector3D.prototype = scotch.create( null );
Vector3D.prototype.constructor = Vector3D;
Vector3D.prototype.length = 3;

Vector3D.prototype.set = function ( x, y, z ) {
  if ( x != null && typeof x == 'object' ) {
    this[ 2 ] = x[ 2 ] || 0;
    this[ 0 ] = x[ 0 ] || 0;
    this[ 1 ] = x[ 1 ] || 0;
  } else {
    this[ 0 ] = x || 0;
    this[ 1 ] = y || 0;
    this[ 2 ] = z || 0;
  }

  return this;
};

Vector3D.prototype.lerp = function ( x, y, z, value ) {
  if ( x != null && typeof x == 'object' ) {
    this[ 0 ] += ( x[ 0 ] - this[ 0 ] ) * y || 0;
    this[ 1 ] += ( x[ 1 ] - this[ 1 ] ) * y || 0;
    this[ 2 ] += ( x[ 2 ] - this[ 2 ] ) * y || 0;
  } else {
    this[ 0 ] += ( x - this[ 0 ] ) * value || 0;
    this[ 1 ] += ( y - this[ 1 ] ) * value || 0;
    this[ 2 ] += ( z - this[ 2 ] ) * value || 0;
  }

  return this;
};

Vector3D.prototype.add = function ( x, y, z ) {
  if ( x != null && typeof x == 'object' ) {
    this[ 0 ] += x[ 0 ] || 0;
    this[ 1 ] += x[ 1 ] || 0;
    this[ 2 ] += x[ 2 ] || 0;
  } else {
    this[ 0 ] += x || 0;
    this[ 1 ] += y || 0;
    this[ 2 ] += z || 0;
  }

  return this;
};

Vector3D.prototype.sub = function ( x, y, z ) {
  if ( x != null && typeof x == 'object' ) {
    this[ 0 ] -= x[ 0 ] || 0;
    this[ 1 ] -= x[ 1 ] || 0;
    this[ 2 ] -= x[ 2 ] || 0;
  } else {
    this[ 0 ] -= x || 0;
    this[ 1 ] -= y || 0;
    this[ 2 ] -= z || 0;
  }

  return this;
};

Vector3D.prototype.mult = function ( value ) {
  this[ 0 ] = this[ 0 ] * value || 0;
  this[ 1 ] = this[ 1 ] * value || 0;
  this[ 2 ] = this[ 2 ] * value || 0;
  return this;
};

Vector3D.prototype.div = function ( value ) {
  this[ 0 ] = this[ 0 ] / value || 0;
  this[ 1 ] = this[ 1 ] / value || 0;
  this[ 2 ] = this[ 2 ] / value || 0;
  return this;
};

Vector3D.prototype.angle = Vector2D.prototype.angle;

Vector3D.prototype.mag = function () {
  return sqrt( this[ 0 ] * this[ 0 ] + this[ 1 ] * this[ 1 ] + this[ 2 ] * this[ 2 ] );
};

Vector3D.prototype.magSq = function () {
  return this[ 0 ] * this[ 0 ] + this[ 1 ] * this[ 1 ] + this[ 2 ] * this[ 2 ];
};

Vector3D.prototype.setMag = Vector2D.prototype.setMag;
Vector3D.prototype.normalize = Vector2D.prototype.normalize;
Vector3D.prototype.rotate = Vector2D.prototype.rotate;

Vector3D.prototype.dot = function ( x, y, z ) {
  return x != null && typeof x == 'object' ?
    this[ 0 ] * ( x[ 0 ] || 0 ) + this[ 1 ] * ( x[ 1 ] || 0 ) + this[ 2 ] * ( x[ 2 ] || 0 ) :
    this[ 0 ] * ( x || 0 ) + this[ 1 ] * ( y || 0 ) + this[ 2 ] * ( z || 0 );
};

Vector3D.prototype.copy = function () {
  return new Vector3D( this[ 0 ], this[ 1 ], this[ 2 ] );
};

Vector3D.prototype.dist = function ( vector ) {
  var x = ( vector[ 0 ] - this[ 0 ] ),
      y = ( vector[ 1 ] - this[ 1 ] ),
      z = ( vector[ 2 ] - this[ 2 ] );

  return sqrt( x * x + y * y + z * z );
};

Vector3D.prototype.limit = Vector2D.prototype.limit;

Vector3D.prototype.cross = function ( vector ) {
  return Vector3D.cross( this, vector );
};

Vector3D.prototype.toString = function () {
  return 'vec3(' + ( floor( this[ 0 ] * 100 ) * 0.01 ) + ', ' + ( floor( this[ 1 ] * 100 ) * 0.01 ) + ', ' + ( floor( this[ 2 ] * 100 ) * 0.01 ) + ')';
};

var names = [ 'set', 'lerp', 'add', 'sub', 'mult', 'div', 'setMag', 'normalize', 'rotate', 'limit' ],
    i = names.length - 1;

for ( ; i >= 0; --i ) {
  Vector2D[ names[ i ] ] = Vector3D[ names[ i ] ] = Function( 'vector, x, y, z, value', 'return vector.copy().' + names[ i ] + '( x, y, z, value );' );
}

Vector2D.angle = Vector3D.angle = function ( x, y ) {
  return settings.degrees ?
    atan2( y, x ) * 180 / pi :
    atan2( y, x );
};

Vector2D.random = function () {
  return Vector2D.fromAngle( rand() * ( settings.degrees ? 360 : pi * 2 ) );
};

Vector3D.random = function () {
  var angle = rand() * pi * 2,
      z = rand() * 2 - 1,
      z_base = sqrt( 1 - z * z );

  return new Vector3D( z_base * cos( angle ), z_base * sin( angle ), z );
};

Vector2D.fromAngle = function ( angle ) {
  return settings.degrees ?
    new Vector2D( cos( angle *= pi / 180 ), sin( angle ) ) :
    new Vector2D( cos( angle ), sin( angle ) );
};

Vector3D.fromAngle = function ( angle ) {
  return settings.degrees ?
    new Vector3D( cos( angle *= pi / 180 ), sin( angle ) ) :
    new Vector3D( cos( angle ), sin( angle ) );
};

Vector2D.cross = function( a, b ) {
  return a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ];
};

Vector3D.cross = function ( a, b ) {
  return new Vector3D(
    a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
    a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
    a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ] );
};

/* COLORS */

var colors = {
  aliceblue:       'f0f8ffff', antiquewhite:         'faebd7ff',
  aqua:            '00ffffff', aquamarine:           '7fffd4ff',
  azure:           'f0ffffff', beige:                'f5f5dcff',
  bisque:          'ffe4c4ff', black:                '000000ff',
  blanchedalmond:  'ffebcdff', blue:                 '0000ffff',
  blueviolet:      '8a2be2ff', brown:                'a52a2aff',
  burlywood:       'deb887ff', cadetblue:            '5f9ea0ff',
  chartreuse:      '7fff00ff', chocolate:            'd2691eff',
  coral:           'ff7f50ff', cornflowerblue:       '6495edff',
  cornsilk:        'fff8dcff', crimson:              'dc143cff',
  cyan:            '00ffffff', darkblue:             '00008bff',
  darkcyan:        '008b8bff', darkgoldenrod:        'b8860bff',
  darkgray:        'a9a9a9ff', darkgreen:            '006400ff',
  darkkhaki:       'bdb76bff', darkmagenta:          '8b008bff',
  darkolivegreen:  '556b2fff', darkorange:           'ff8c00ff',
  darkorchid:      '9932ccff', darkred:              '8b0000ff',
  darksalmon:      'e9967aff', darkseagreen:         '8fbc8fff',
  darkslateblue:   '483d8bff', darkslategray:        '2f4f4fff',
  darkturquoise:   '00ced1ff', darkviolet:           '9400d3ff',
  deeppink:        'ff1493ff', deepskyblue:          '00bfffff',
  dimgray:         '696969ff', dodgerblue:           '1e90ffff',
  feldspar:        'd19275ff', firebrick:            'b22222ff',
  floralwhite:     'fffaf0ff', forestgreen:          '228b22ff',
  fuchsia:         'ff00ffff', gainsboro:            'dcdcdcff',
  ghostwhite:      'f8f8ffff', gold:                 'ffd700ff',
  goldenrod:       'daa520ff', gray:                 '808080ff',
  green:           '008000ff', greenyellow:          'adff2fff',
  honeydew:        'f0fff0ff', hotpink:              'ff69b4ff',
  indianred:       'cd5c5cff', indigo:               '4b0082ff',
  ivory:           'fffff0ff', khaki:                'f0e68cff',
  lavender:        'e6e6faff', lavenderblush:        'fff0f5ff',
  lawngreen:       '7cfc00ff', lemonchiffon:         'fffacdff',
  lightblue:       'add8e6ff', lightcoral:           'f08080ff',
  lightcyan:       'e0ffffff', lightgoldenrodyellow: 'fafad2ff',
  lightgrey:       'd3d3d3ff', lightgreen:           '90ee90ff',
  lightpink:       'ffb6c1ff', lightsalmon:          'ffa07aff',
  lightseagreen:   '20b2aaff', lightskyblue:         '87cefaff',
  lightslateblue:  '8470ffff', lightslategray:       '778899ff',
  lightsteelblue:  'b0c4deff', lightyellow:          'ffffe0ff',
  lime:            '00ff00ff', limegreen:            '32cd32ff',
  linen:           'faf0e6ff', magenta:              'ff00ffff',
  maroon:          '800000ff', mediumaquamarine:     '66cdaaff',
  mediumblue:      '0000cdff', mediumorchid:         'ba55d3ff',
  mediumpurple:    '9370d8ff', mediumseagreen:       '3cb371ff',
  mediumslateblue: '7b68eeff', mediumspringgreen:    '00fa9aff',
  mediumturquoise: '48d1ccff', mediumvioletred:      'c71585ff',
  midnightblue:    '191970ff', mintcream:            'f5fffaff',
  mistyrose:       'ffe4e1ff', moccasin:             'ffe4b5ff',
  navajowhite:     'ffdeadff', navy:                 '000080ff',
  oldlace:         'fdf5e6ff', olive:                '808000ff',
  olivedrab:       '6b8e23ff', orange:               'ffa500ff',
  orangered:       'ff4500ff', orchid:               'da70d6ff',
  palegoldenrod:   'eee8aaff', palegreen:            '98fb98ff',
  paleturquoise:   'afeeeeff', palevioletred:        'd87093ff',
  papayawhip:      'ffefd5ff', peachpuff:            'ffdab9ff',
  peru:            'cd853fff', pink:                 'ffc0cbff',
  plum:            'dda0ddff', powderblue:           'b0e0e6ff',
  purple:          '800080ff', red:                  'ff0000ff',
  rosybrown:       'bc8f8fff', royalblue:            '4169e1ff',
  saddlebrown:     '8b4513ff', salmon:               'fa8072ff',
  sandybrown:      'f4a460ff', seagreen:             '2e8b57ff',
  seashell:        'fff5eeff', sienna:               'a0522dff',
  silver:          'c0c0c0ff', skyblue:              '87ceebff',
  slateblue:       '6a5acdff', slategray:            '708090ff',
  snow:            'fffafaff', springgreen:          '00ff7fff',
  steelblue:       '4682b4ff', tan:                  'd2b48cff',
  teal:            '008080ff', thistle:              'd8bfd8ff',
  tomato:          'ff6347ff', turquoise:            '40e0d0ff',
  violet:          'ee82eeff', violetred:            'd02090ff',
  wheat:           'f5deb3ff', white:                'ffffffff',
  whitesmoke:      'f5f5f5ff', yellow:               'ffff00ff',
  yellowgreen:     '9acd32ff', transparent:          '00000000'
};

var rhsl = /^hsl\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\u0025\s*,\s*(\d+|\d*\.\d+)\u0025\s*\)$|^\s*hsla\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\u0025\s*,\s*(\d+|\d*\.\d+)\u0025\s*,\s*(\d+|\d*\.\d+)\s*\)$/,
    rrgb = /^rgb\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*\)$|^\s*rgba\s*\(\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*,\s*(\d+|\d*\.\d+)\s*\)$/,
    rhex = /^(?:#)([0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f])([0-9a-f][0-9a-f])?$/,
    rhex3 = /^(?:#)([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/,
    parsed = scotch.create( null ),
    transparent = [ 0, 0, 0, 0 ];

var color = function ( a, b, c, d ) {
  return typeof a != 'string' ?
    new RGBA( a, b, c, d ) :
    parse_color( a );
};

var parse_color = function ( string ) {
  var cache = parsed[ string ] ||
    parsed[ string = scotch.trim( string ).toLowerCase() ];

  if ( !cache ) {
    if ( ( cache = colors[ string ] ) ) {
      cache = parsed[ string ] = new ColorData( parse_hex( cache ), RGBA );
    } else if ( ( cache = rhex.exec( string ) ) ) {
      cache = parsed[ string ] = new ColorData( parse_hex( format_hex( cache ) ), RGBA );
    } else if ( ( cache = rrgb.exec( string ) ) ) {
      cache = parsed[ string ] = new ColorData( compact_match( cache ), RGBA );
    } else if ( ( cache = rhsl.exec( string ) ) ) {
      cache = parsed[ string ] = new ColorData( compact_match( cache ), HSLA );
    } else if ( ( cache = rhex3.exec( string ) ) ) {
      cache = parsed[ string ] = new ColorData( parse_hex( format_hex( cache, true ) ), RGBA );
    } else {
      throw SyntaxError( string + " isn't valid syntax" );
    }
  }

  return new cache.constructor( cache[ 0 ], cache[ 1 ], cache[ 2 ], cache[ 3 ] );
};

var format_hex = function ( match, short_syntax ) {
  if ( !short_syntax ) {
    return match[ 1 ] + ( match[ 2 ] || 'ff' );
  }

  var r = match[ 1 ],
      g = match[ 2 ],
      b = match[ 3 ],
      a = match[ 4 ];

  return r + r + g + g + b + b + ( a ? a + a : 'ff' );

  // #todo test in benchmark
  /* var r = match[ 1 ],
      g = match[ 2 ],
      b = match[ 3 ],
      a = match[ 4 ] || 'f';

  return r + r + g + g + b + b + a + a; */
};

var parse_hex = function ( hex ) {
  if ( hex == 0 ) {
    return transparent;
  }

  hex = window.parseInt( hex, 16 );

  return [
    hex >> 24 & 255,
    hex >> 16 & 255,
    hex >> 8 & 255,
    ( hex & 255 ) / 255
  ];
};

var compact_match = function ( match ) {
  return match[ 7 ] ?
    [ match[ 4 ], match[ 5 ], match[ 6 ], match[ 7 ] ] :
    [ match[ 1 ], match[ 2 ], match[ 3 ] ];
};

var rgba = function ( r, g, b, a ) {
  return new RGBA( r, g, b, a );
};

var RGBA = function ( r, g, b, a ) {
  this.set( r, g, b, a );
};

RGBA.prototype = scotch.create( null );
RGBA.prototype.constructor = RGBA;
RGBA.prototype.type = 'rgba';

RGBA.prototype.contrast = function () {
  return this[ 0 ] * 0.299 + this[ 1 ] * 0.587 + this[ 2 ] * 0.114;
};

RGBA.prototype.toString = function () {
  return 'rgba(' + this[ 0 ] + ', ' + this[ 1 ] + ', ' + this[ 2 ] + ', ' + this[ 3 ] + ')';
};

RGBA.prototype.set = function ( r, g, b, a ) {
  if ( r == null || typeof r != 'object' && typeof r != 'string' ) {
    switch ( undefined ) {
      case r: a = 1; b = g = r = 0; break;
      case g: a = 1; b = g = r = floor( r ); break;
      case b: a = g; b = g = r = floor( r ); break;
      case a: a = 1;
      default: r = floor( r ); g = floor( g ); b = floor( b );
    }

    this[ 0 ] = r;
    this[ 1 ] = g;
    this[ 2 ] = b;
    this[ 3 ] = a;
  } else {
    if ( typeof r == 'string' ) {
      r = parse_color( r );
    }

    if ( r.type !== this.type ) {
      r = r[ this.type ]();
    }

    this[ 0 ] = r[ 0 ];
    this[ 1 ] = r[ 1 ];
    this[ 2 ] = r[ 2 ];
    this[ 3 ] = r[ 3 ];
  }

  return this;
};

RGBA.prototype.hsla = function () {
  var hsla = new HSLA(),
      r = this[ 0 ] / 255,
      g = this[ 1 ] / 255,
      b = this[ 2 ] / 255,
      greatest = max( r, g, b ),
      least = min( r, g, b ),
      diff = greatest - least,
      l = ( greatest + least ) * 50,
      h, s;

  if ( diff ) {
    s = l > 50 ?
      diff / ( 2 - greatest - least ) :
      diff / ( greatest + least );

    switch ( greatest ) {
      case r: h = g < b ? 1.0472 * ( g - b ) / diff + 6.2832 : 1.0472 * ( g - b ) / diff; break;
      case g: h = 1.0472 * ( b - r ) / diff + 2.0944; break;
      default: h = 1.0472 * ( r - g ) / diff + 4.1888;
    }

    h = round( h * 360 / 6.2832 );
    s = round( s * 100 );
  } else {
    h = s = 0;
  }

  hsla[ 0 ] = h;
  hsla[ 1 ] = s;
  hsla[ 2 ] = round( l );
  hsla[ 3 ] = this[ 3 ];

  return hsla;
};

RGBA.prototype.rgba = function () {
  return this;
};

RGBA.prototype.lerp = function ( color, value ) {
  if ( typeof color != 'object' ) {
    color = parse_color( color );
  }

  if ( color.type !== 'rgba' ) {
    color = color.rgba();
  }

  return new RGBA(
    this[ 0 ] + ( color[ 0 ] - this[ 0 ] ) * value,
    this[ 1 ] + ( color[ 1 ] - this[ 1 ] ) * value,
    this[ 2 ] + ( color[ 2 ] - this[ 2 ] ) * value );
};

var hsla = function ( h, s, l, a ) {
  return new HSLA( h, s, l, a );
};

var HSLA = function ( h, s, l, a ) {
  this.set( h, s, l, a );
};

HSLA.prototype = scotch.create( null );
HSLA.prototype.constructor = HSLA;
HSLA.prototype.type = 'hsla';

HSLA.prototype.toString = function () {
  return 'hsla(' + this[ 0 ] + ', ' + this[ 1 ] + '\u0025, ' + this[ 2 ] + '\u0025, ' + this[ 3 ] + ')';
};

HSLA.prototype.set = function ( h, s, l, a ) {
  if ( h == null || typeof h != 'object' && typeof h != 'string' ) {
    switch ( undefined ) {
      case h: a = 1; l = s = h = 0; break;
      case s: a = 1; l = floor( h ); s = h = 0; break;
      case l: a = s; l = floor( h ); s = h = 0; break;
      case a: a = 1;
      default: h = floor( h ); s = floor( s ); l = floor( l );
    }

    this[ 0 ] = h;
    this[ 1 ] = s;
    this[ 2 ] = l;
    this[ 3 ] = a;
  } else {
    if ( typeof h == 'string' ) {
      h = parse_color( h );
    }

    if ( h.type !== this.type ) {
      h = h[ this.type ]();
    }

    this[ 0 ] = h[ 0 ];
    this[ 1 ] = h[ 1 ];
    this[ 2 ] = h[ 2 ];
    this[ 3 ] = h[ 3 ];
  }

  return this;
};

HSLA.prototype.rgba = function () {
  var rgba = new RGBA(),
      h = this[ 0 ] % 360 / 360,
      s = this[ 1 ] * 0.01,
      l = this[ 2 ] * 0.01,
      q = l < 0.5 ? l * ( 1 + s ) : l + s - ( l * s ),
      p = 2 * l - q,
      tr = h + 1 / 3,
      tg = h,
      tb = h - 1 / 3;

  if ( tr < 0 ) { ++tr; }
  if ( tg < 0 ) { ++tg; }
  if ( tb < 0 ) { ++tb; }
  if ( tr > 1 ) { --tr; }
  if ( tg > 1 ) { --tg; }
  if ( tb > 1 ) { --tb; }

  rgba[ 0 ] = round( 255 * ( tr < 1 / 6 ?
    p + ( q - p ) * 6 * tr : tr < 0.5 ?
    q : tr < 2 / 3 ?
    p + ( q - p ) * ( 2 / 3 - tr ) * 6 : p ) );

  rgba[ 1 ] = round( 255 * ( tg < 1 / 6 ?
    p + ( q - p ) * 6 * tg : tg < 0.5 ?
    q : tg < 2 / 3 ?
    p + ( q - p ) * ( 2 / 3 - tg ) * 6 : p ) );

  rgba[ 2 ] = round( 255 * ( tb < 1 / 6 ?
    p + ( q - p ) * 6 * tb : tb < 0.5 ?
    q : tb < 2 / 3 ?
    p + ( q - p ) * ( 2 / 3 - tb ) * 6 : p ) );

  rgba[ 3 ] = this[ 3 ];

  return rgba;
};

HSLA.prototype.lerp = function ( color, value ) {
  if ( typeof color != 'object' ) {
    color = parse_color( color );
  }

  if ( color.type !== 'rgba' ) {
    color = color.rgba();
  }

  var that = this.rgba();

  return new RGBA(
    that[ 0 ] + ( color[ 0 ] - that[ 0 ] ) * value,
    that[ 1 ] + ( color[ 1 ] - that[ 1 ] ) * value,
    that[ 2 ] + ( color[ 2 ] - that[ 2 ] ) * value ).hsla();
};

var ColorData = function ( match, constructor ) {
  this[ 0 ] = match[ 0 ];
  this[ 1 ] = match[ 1 ];
  this[ 2 ] = match[ 2 ];
  this[ 3 ] = match[ 3 ];
  this.constructor = constructor;
};

ColorData.prototype = scotch.create( null );

/* FONT */

var is_global = function ( value ) {
  return value === 'inherit' || value === 'initial' || value === 'unset';
};

var is_font_style = function ( value ) {
  return value === 'normal' || value === 'italic' || value === 'oblique';
};

var is_font_variant = function ( value ) {
  return value === 'none' || value === 'normal' || value === 'small-caps';
};

var is_font_size = function ( value ) {
  return typeof value == 'number' || /^(?:smaller|xx-small|x-small|small|medium|large|x-large|xx-large|larger|(\d+|\d*\.\d+)(px|em|\u0025|cm|in|mm|pc|pt|rem)?)$/.test( value );
};

var get_property_name = function ( value, name ) {
  switch ( true ) {
    case is_global( value ): return name;
    case is_font_style( value ): return 'style';
    case is_font_variant( value ): return 'variant';
    default: return 'weight';
  }
};

var font = function ( style, variant, weight, size, family ) {
  return new Font( style, variant, weight, size, family );
};

var Font = function ( style, variant, weight, size, family ) {
  this.set( style, variant, weight, size, family );
};

Font.prototype = scotch.create( null );
Font.prototype.constructor = Font;
Font.prototype.style = Font.prototype.variant = Font.prototype.weight = 'normal';
Font.prototype.size = 'medium';
Font.prototype.family = 'sans-serif';

Font.prototype.get = function () {
  return [
    this.style, this.variant, this.weight, this.size,  this.family
  ];
};

/**
 * font.set( 'normal' );
 * font.set( 'Ubuntu' );
 * font.set( '24px', 'Ubuntu, sans-serif' );
 * font.set( 'small-caps', 'larger', 'sans-serif' );
 * font.set( 'italic', '300', '110%', 'serif' );
 * font.set( 'normal', 'normal', 'normal', 'medium', 'sans-serif' );
 */
Font.prototype.set = function ( style, variant, weight, size, family ) {
  if ( style == null ) {
    return this;
  }

  if ( typeof style != 'object' ) {
    if ( variant === undefined ) {
      if ( is_global( style ) || is_font_size( style ) ) {
        this.size = style;
      } else {
        this.family = style;
      }
    } else if ( weight === undefined ) {
      this.size = style;
      this.family = variant;
    } else if ( size === undefined ) {
      this[ get_property_name( style, 'style' ) ] = style;
      this.size = variant;
      this.family = weight;
    } else if ( family === undefined ) {
      var a = get_property_name( style, 'style' ),
          b = get_property_name( variant, a === 'style' ? 'variant' : 'weight' );

      if ( a === b ) {
        b = a === 'style' ? 'variant' : 'weight';
      }

      this[ a ] = style;
      this[ b ] = variant;
      this.size = weight;
      this.family = size;
    } else {
      this.style = style;
      this.variant = variant;
      this.weight = weight;
      this.size = size;
      this.family = family;
    }
  } else {
    this.style = style.style;
    this.variant = style.variant;
    this.weight = style.weight;
    this.size = style.size;
    this.family = style.family;
  }

  return this;
};

Font.prototype.toString = function () {
  return this.style + ' ' + this.variant + ' ' + this.weight + ' ' + ( typeof this.size == 'number' ? this.size + 'px ' : this.size + ' ' ) + this.family;
};

/* IMAGE */

var image = function ( path, x, y, w, h ) {
  return new Image( path, x, y, w, h );
};

var Image = function ( path, x, y, w, h ) {
  if ( path !== undefined ) {
    if ( path instanceof window.Image ) {
      this.source = path;
    } else if ( path instanceof Image ) {
      this.source = path.source;

      if ( !path.loaded ) {
        var image = this;

        scotch( this.source ).one( 'load', function () {
          image.set( x, y, w, h, true );
        } );
      } else {
        this.set( x, y, w, h, true );
      }
    } else {
      this.source = document.createElement( 'img' );
      this.load( path, x, y, w, h );
    }
  } else {
    this.source = document.createElement( 'img' );
  }
};

Image.prototype = scotch.create( null );
Image.prototype.constructor = Image;
Image.prototype.x = Image.prototype.y = Image.prototype.width = Image.prototype.height = 0;
Image.prototype.loaded = false;
Image.prototype.path = '';

Image.prototype.set = function ( x, y, w, h, loaded ) {
  this.loaded = loaded;
  this.x = x ? floor( x ) : 0;
  this.y = y ? floor( y ) : 0;

  this.width = w == null ?
    floor( this.source.width - this.x ) : w ?
    floor( w ) : 0;

  this.height = h == null ?
    floor( this.source.height - this.y ) : h ?
    floor( h ) : 0;

  return this;
};

Image.prototype.load = function ( path, x, y, w, h ) {
  var image = this.set( 0, 0, 0, 0, false ),
      source = image.source;

  scotch( source ).one( 'load', function () {
    image.set( x, y, w, h, true );
  } );

  image.path = source.src = path;
  return image;
};

/* LOADER */

var loader = function () {
  return new Loader();
};

var Loader = function () {
  this.list = scotch.create( null );
};

Loader.prototype = scotch.create( null );
Loader.prototype.constructor = Loader;

Loader.prototype.add = function ( name, path ) {
  if ( typeof name == 'object' ) {
    if ( scotch.isArray( name ) ) {
      var list = this.list,
          len = name.length,
          i = 0;

      for ( ; i < len; i += 2 ) {
        list[ name[ i ] ] = name[ i + 1 ];
      }
    } else if ( name != null ) {
      scotch.assign( this.list, name );
    } else {
      throw TypeError();
    }
  } else if ( path === undefined ) {
    this.list[ name ] = name;
  } else {
    this.list[ name ] = path;
  }

  return this;
};

var get_promise = function ( path, name ) {
  return new scotch.Promise( /\.(?:png|jpe?g)$/i.test( path ) ? function ( resolve, reject ) {
    var image = new Image( path );

    if ( !image.loaded ) {
      var $source = scotch( image.source );

      var load = function () {
        $source.off( 'error', error );
        resolve( [ name, image ] );
      };

      var error = function ( event ) {
        $source.off( 'load', load );
        reject( [ 'Failed to load ' + path, path ] );
      };

      $source
        .one( 'load', load )
        .one( 'error', error );
    } else {
      resolve( [ name, image ] );
    }
  } : function ( resolve, reject ) {
    scotch.file( path, {
      onload: function ( file ) {
        resolve( [ name, file ] );
      },

      onerror: function () {
        reject( [ 'Failed to load ' + path, path ] );
      }
    } );
  } );
};

var load_err = function ( data ) {
  err( data[ 0 ] );
};

Loader.prototype.load = function ( setup, error ) {
  var list = this.list,
      names = scotch.keys( list ),
      length = names.length,
      promises = Array( length ),
      i = 0;

  for ( ; i < length; ++i ) {
    promises[ i ] = get_promise( list[ names[ i ] ], names[ i ] );
  }

  scotch.Promise.all( promises )
    .then( setup, error || load_err );

  return this;
};

/* RENDERER2D SHAPES */

var shape = function ( draw, no_fill, no_stroke ) {
  return function ( vertices, close ) {
    var fill = !no_fill && this.style.doFill,
        stroke = !no_stroke && this.style.doStroke,
        context = this.context;

    if ( vertices.length && ( fill || stroke || no_stroke && no_fill ) ) {
      draw.call( this, context, vertices );

      if ( fill ) {
        this._fill();
      }

      if ( stroke ) {
        if ( close ) {
          context.closePath();
        }

        this._stroke();
      }
    }
  };
};

var shapes = {
  points: shape( function ( context, vertices ) {
    var len = vertices.length,
        r = this.style.lineWidth,
        i = 0;

    context.fillStyle = this.style.strokeStyle;

    for ( ; i < len; i += 2 ) {
      context.beginPath();
      context.arc( vertices[ i ], vertices[ i + 1 ], r, 0, pi * 2 );
      context.fill();
    }
  }, true, true ),

  lines: shape( function ( context, vertices ) {
    var len = vertices.length,
        i = 2;

    context.beginPath();
    context.moveTo( vertices[ 0 ], vertices[ 1 ] );

    for ( ; i < len; i += 2 ) {
      context.lineTo( vertices[ i ], vertices[ i + 1 ] );
    }
  } )
};

/* RENDERER2D */

var Renderer2D = function ( options ) {
  create_renderer( this, '2d', options );
};

Renderer2D.prototype = scotch.create( null );
Renderer2D.prototype.constructor = Renderer2D;

Renderer2D.prototype.add = function () {
  return document.body.appendChild( this.canvas ), this;
};

Renderer2D.prototype.destroy = function () {
  scotch( this.canvas ).off().remove();
  delete renderers[ this.index ];
  return this;
};

Renderer2D.prototype.pixelDensity = function ( value ) {
  if ( value !== undefined ) {
    return this.settings.scale = value, this;
  }

  return this;
};

Renderer2D.prototype.push = function () {
  return this.saves.push( clone_style( this.style, { fillStyle: {}, font: {}, strokeStyle: {} } ) ), this;
};

Renderer2D.prototype.pop = function () {
  return this.saves.length && clone_style( this.saves.pop(), this.style ), this;
};

Renderer2D.prototype.smooth = function ( value ) {
  return this.settings.smooth = set_image_smoothing( this.context, value ), this;
};

Renderer2D.prototype.resize = function ( w, h ) {
  var scale = this.settings.scale,
      canvas = this.canvas,
      style = canvas.style;

  // rescale canvas
  if ( w === undefined ) {
    w = this.rWidth;
    h = this.rHeight;
  } else {
    this.rWidth = w;
    this.rHeight = h;
  }

  style.width = w + 'px';
  style.height = h + 'px';
  canvas.width = this.width = w * scale;
  canvas.height = this.height = h * scale;

  if ( active_renderer_index === this.index ) {
    window.width = this.width;
    window.height = this.height;
  }

  return this;
};

Renderer2D.prototype.fullwindow = function () {
  var window = scotch( this.canvas.ownerDocument.defaultView );
  return this.resize( window.width(), window.height() );
};

Renderer2D.prototype.backgroundColor = function ( a, b, c, d ) {
  this.context.save();
  this.context.setTransform( this.settings.scale, 0, 0, this.settings.scale, 0, 0 );
  this.context.fillStyle = this.color( a, b, c, d );
  this.context.fillRect( 0, 0, this.width, this.height );
  this.context.restore();
  return this;
};

Renderer2D.prototype.backgroundImage = function ( image ) {
  var style = this.style,
      rectAlignX = style.rectAlignX,
      rectAlignY = style.rectAlignY;

  style.rectAlignX = 'left';
  style.rectAlignY = 'top';

  if ( image.width / ( image.height / this.height ) < this.width ) {
    this.image( image, 0, 0, this.width, 'auto' );
  } else {
    this.image( image, 0, 0, 'auto', this.height );
  }

  style.rectAlignX = rectAlignX;
  style.rectAlignY = rectAlignY;
  return this;
};

Renderer2D.prototype.background = function ( a, b, c, d ) {
  return this[ a instanceof Image ?
    'backgroundImage' :
    'backgroundColor' ]( a, b, c, d );
};

Renderer2D.prototype.clear = function ( x, y, w, h ) {
  if ( x === undefined ) {
    x = y = 0;
    w = this.width;
    h = this.height;
  } else {
    x = floor( align( x, w, this.style.rectAlignX ) );
    y = floor( align( y, h, this.style.rectAlignY ) );
  }

  this.context.clearRect( x, y, w, h );
  return this;
};

Renderer2D.prototype.rect = function ( x, y, w, h ) {
  x = floor( align( x, w, this.style.rectAlignX ) );
  y = floor( align( y, h, this.style.rectAlignY ) );

  if ( this.state.beginPath ) {
    this.context.rect( x, y, w, h );
  } else {
    this.context.beginPath();
    this.context.rect( x, y, w, h );

    if ( this.style.doFill ) {
      this._fill();
    }

    if ( this.style.doStroke ) {
      this._stroke();
    }
  }

  return this;
};

Renderer2D.prototype.line = function ( x1, y1, x2, y2 ) {
  if ( this.state.beginPath ) {
    this.context.moveTo( x1, y1 );
    this.context.lineTo( x2, y2 );
  } else if ( this.style.doStroke ) {
    this.context.beginPath();
    this.context.moveTo( x1, y1 );
    this.context.lineTo( x2, y2 );
    this._stroke();
  }

  return this;
};

Renderer2D.prototype.image = function ( image, x, y, width, height ) {
  if ( image == null ) {
    throw TypeError( image + ' is not an object' );
  }

  if ( image.loaded ) {
    var w = typeof width != 'string' ? width : width == 'auto' || width == 'initial' ? image.width : 0,
        h = typeof height != 'string' ? height : height == 'auto' || height == 'initial' ? image.height : 0;

    if ( width === 'auto' ) {
      w /= image.height / h;
    }

    if ( height === 'auto' ) {
      h /= image.width / w;
    }

    x = floor( align( x, w, this.style.rectAlignX ) );
    y = floor( align( y, h, this.style.rectAlignY ) );
    this.context.drawImage( image.source, image.x, image.y, image.width, image.height, x, y, w, h );
  }

  return this;
};

Renderer2D.prototype.text = function ( text, x, y, maxWidth, maxHeight ) {
  var style = this.style,
      doFill = style.doFill,
      doStroke = style.doStroke && style.lineWidth > 0;

  if ( !( doFill || doStroke ) || !( text += '' ).length ) {
    return this;
  }

  text = text.split( '\n' );
  x = floor( x );
  y = floor( y );

  var context = this.context,
      lineHeight = style.lineHeight,
      maxLength = maxHeight === undefined ? Infinity : floor( maxHeight / lineHeight ),
      i, length, line, words, word, test, j, k, splittedtext;

  if ( maxWidth !== undefined ) {
    for ( splittedtext = [], i = 0, length = text.length; i < length && splittedtext.length < maxLength; ++i ) {
      words = text[ i ].match( /\s+|\S+/g ) || [];
      line = '';

      for ( j = 0, k = words.length; j < k && splittedtext.length < maxLength; ++j ) {
        word = words[ j ];
        test = line + word;

        if ( context.measureText( test ).width > maxWidth ) {
          splittedtext.push( line );
          line = word;
        } else {
          line = test;
        }
      }

      splittedtext.push( line );
    }

    text = splittedtext;
  }

  if ( text.length > maxLength ) {
    text.length = maxLength;
  }

  context.font = style.font.toString();
  context.textAlign = style.textAlign;
  context.textBaseline = style.textBaseline;

  if ( doFill ) {
    context.fillStyle = style.fillStyle;
  }

  if ( doStroke ) {
    context.strokeStyle = style.strokeStyle;
    context.lineWidth = style.lineWidth;
  }

  for ( i = 0, length = text.length; i < length; ++i ) {
    line = text[ i ];

    if ( doFill ) {
      context.fillText( line, x, y + i * lineHeight );
    }

    if ( doStroke ) {
      context.strokeText( line, x, y + i * lineHeight );
    }
  }

  return this;
};

Renderer2D.prototype.arc = function ( x, y, r, begin, end, anticlockwise ) {
  if ( begin === undefined ) {
    begin = 0;
    end = pi * 2;
  } else if ( settings.degrees ) {
    begin *= pi / 180;
    end *= pi / 180;
  }

  if ( !this.state.beginPath ) {
    this.context.beginPath();
    this.context.arc( x, y, r, begin, end, anticlockwise );

    if ( this.style.doFill ) {
      this._fill();
    }

    if ( this.style.doStroke ) {
      this.context.closePath();
      this._stroke();
    }
  } else {
    this.context.arc( x, y, r, begin, end, anticlockwise );
  }

  return this;
};

Renderer2D.prototype.filter = function ( filter, x, y, w, h ) {
  if ( x === undefined ) {
    x = y = 0;
    w = this.width;
    h = this.height;
  } else {
    x = floor( align( x, w, this.style.rectAlignX ) );
    y = floor( align( y, h, this.style.rectAlignY ) );
  }

  var image_data = this.context.getImageData( x, y, w, h );
  filter.call( this, image_data.data );
  this.context.putImageData( image_data, x, y );
  return this;
};

Renderer2D.prototype.font = function ( a, b, c, d, e ) {
  return this.style.font.set( a, b, c, d, e ), this;
};

Renderer2D.prototype.save = function () {
  return this.context.save(), this;
};

Renderer2D.prototype.restore = function () {
  return this.context.restore(), this;
};

Renderer2D.prototype.noFill = function () {
  return this.style.doFill = false, this;
};

Renderer2D.prototype.noStroke = function () {
  return this.style.doStroke = false, this;
};

Renderer2D.prototype.beginShape = function () {
  return this.vertices.length = 0, this;
};

Renderer2D.prototype.vertex = function ( x, y ) {
  return this.vertices.push( floor( x ), floor( y ) ), this;
};

Renderer2D.prototype.endShape = function ( type, close ) {
  if ( typeof type != 'string' ) {
    close = type;
    type = 'lines';
  }

  return shapes[ type ].call( this, this.vertices, close ), this;
};

Renderer2D.prototype.rectAlign = function ( x, y ) {
  if ( x != null ) {
    this.style.rectAlignX = x;
  }

  if ( y != null ) {
    this.style.rectAlignY = y;
  }

  return this;
};

Renderer2D.prototype.color = function ( a, b, c, d ) {
  return typeof a == 'string' ?
    v6[ this.settings.colorMode ]( parse_color( a ) ) :
    v6[ this.settings.colorMode ]( a, b, c, d );
};

Renderer2D.prototype.colorMode = function ( mode ) {
  return this.settings.colorMode = mode, this;
};

Renderer2D.prototype.polygon = function ( x, y, r, n, begin ) {
  if ( begin === undefined ) {
    begin = -pi * 0.5;
  } else if ( settings.degrees ) {
    begin *= pi / 180;
  }

  var step = pi * 2 / n,
      end = begin + pi * 2,
      style = this.style,
      context = this.context;

  context.beginPath();
  context.moveTo( r * cos( begin ) + x, r * sin( begin ) + y );

  for ( begin += step; begin <= end; begin += step ) {
    context.lineTo( r * cos( begin ) + x, r * sin( begin ) + y );
  }

  if ( !this.state.beginPath ) {
    if ( style.doFill ) {
      this._fill();
    }

    if ( style.doStroke ) {
      context.closePath();
      this._stroke();
    }
  }

  return this;
};

Renderer2D.prototype.point = function ( x, y ) {
  if ( this.style.doStroke ) {
    this.context.beginPath();
    this.context.arc( x, y, this.style.lineWidth * 0.5, 0, pi * 2 );
    this.context.fillStyle = this.style.strokeStyle;
    this.context.fill();
  }

  return this;
};

Renderer2D.prototype.beginPath = function () {
  this.state.beginPath = true;
  this.context.beginPath();
  return this;
};

Renderer2D.prototype.closePath = function () {
  this.state.beginPath = false;
  this.context.closePath();
  return this;
};

var renderers = [],
    renderers_modes = [],
    active_renderer_index = -1;

Renderer2D.prototype.global = function () {

  if ( scotch.indexOf( renderers_modes, this.mode ) < 0 ) {
    scotch.forInRight( this, function ( value, name ) {
      this[ name ] = typeof value == 'function' ?
        function ( a, b, c, d, e, f, g, h ) {
          return value.call( renderers[ active_renderer_index ], a, b, c, d, e, f, g, h );
        } : value;
    }, window );

    renderers_modes.push( this.mode );
  }

  active_renderer_index = this.index;

  return this;

};

Renderer2D.prototype.getImageData = function ( x, y, w, h ) {
  return this.context.getImageData( x, y, w, h );
};

Renderer2D.prototype.putImageData = function ( imageData, x, y, sx, sy, sw, sh ) {
  if ( sx !== undefined ) {
    this.context.putImageData( imageData, x, y, sx, sy, sw, sh );
  } else {
    this.context.putImageData( imageData, x, y );
  }

  return this;
};

Renderer2D.prototype.rotate = function ( angle ) {
  return this.context.rotate( settings.degrees ? angle * pi / 180 : angle ), this;
};

Renderer2D.prototype._fill = function () {
  this.context.fillStyle = this.style.fillStyle;
  this.context.fill();
  return this;
};

Renderer2D.prototype._stroke = function () {
  this.context.strokeStyle = this.style.strokeStyle;

  if ( ( this.context.lineWidth = this.style.lineWidth ) < 1.5 ) {
    this.context.stroke();
  }

  this.context.stroke();
  return this;
};

scotch.forInRight( {
  fontVariant: 'variant', fontStyle: 'style',
  fontWeight:  'weight',  fontSize:  'size',
  fontFamily:  'family'
}, function ( name, methodname ) {
  this[ methodname ] = Function( 'value', 'return this.style.font.' + name + ' = value, this;' );
}, Renderer2D.prototype );

scotch.forEachRight( [
  'scale',  'translate', 'moveTo', 'lineTo', 'setTransform'
], function ( name ) {
  this[ name ] = Function( 'a, b, c, d, e, f', 'return this.context.' + name + '( a, b, c, d, e, f ), this;' );
}, Renderer2D.prototype );

scotch.forEachRight( [
  'lineWidth', 'lineHeight', 'textAlign', 'textBaseline'
], function ( name ) {
  this[ name ] = Function( 'value', 'return this.style.' + name + ' = value, this;' );
}, Renderer2D.prototype );

scotch.forInRight( { fill: 'fillStyle', stroke: 'strokeStyle' }, function ( name, method_name ) {
  var style = scotch.upperFirst( method_name ),
      do_style = 'do' + style,
      _method_name = '_' + method_name;

  this[ method_name ] = function ( a, b, c, d ) {
    if ( a === undefined ) {
      this[ _method_name ]();
    } else if ( a !== true && a !== false ) {
      this.style[ do_style ] = true;

      if ( typeof a != 'string' && this.style[ name ].type === this.settings.colorMode ) {
        this.style[ name ].set( a, b, c, d );
      } else {
        this.style[ name ] = this.color( a, b, c, d );
      }
    } else {
      this.style[ do_style ] = a;
    }

    return this;
  };
}, Renderer2D.prototype );

/* PROGRAM */

var program = function ( context, vShader, fShader ) {
  return new Program( context, vShader, fShader );
};

var Program = function ( context, vShader, fShader ) {
  this.program = create_program( context, vShader, fShader );
  this.context = context;
  this.vShader = vShader;
  this.fShader = fShader;
  this.attributes = scotch.create( null );
  this.uniforms = scotch.create( null );
  this.samplers = [];
  this.loadAttributes();
  this.loadUniforms();
};

Program.prototype = scotch.create( null );
Program.prototype.constructor = Program;
Program.prototype.loadedAttributes = Program.prototype.loadedUniforms = false;

Program.prototype.loadAttributes = function () {
  if ( !this.loadedAttributes ) {
    var gl = this.context,
        program = this.program,
        attrs = this.attributes,
        i = gl.getProgramParameter( program, gl.ACTIVE_ATTRIBUTES ) - 1,
        info, name, attr;

    for ( ; i >= 0; --i ) {
      info = gl.getActiveAttrib( program, i );
      name = info.name;
      attr = attrs[ name ] = scotch.create( null );
      attr.name = name;
      attr.type = info.type;
      attr.size = info.size;
      attr.location = gl.getAttribLocation( program, name );
    }

    this.loadedAttributes = true;
  }

  return this;
};

Program.prototype.loadUniforms = function () {
  if ( !this.loadedUniforms ) {
    var gl = this.context,
        program = this.program,
        samplers = this.samplers,
        uniforms = this.uniforms,
        i = gl.getProgramParameter( program, gl.ACTIVE_UNIFORMS ) - 1,
        samplerIndex = -1,
        info, name, uniform, index;

    for ( ; i >= 0; --i ) {
      info = gl.getActiveUniform( program, i );
      name = info.name;
      uniform = scotch.create( null );
      uniform.size = info.size;
      uniform.type = info.type;
      uniform.location = gl.getUniformLocation( program, name );

      if ( info.size > 1 && ( index = name.indexOf( '[0]' ) ) >= 0 ) {
        name = name.slice( 0, index );
      }

      uniforms[ uniform.name = name ] = uniform;

      if ( uniform.type === gl.SAMPLER_2D ) {
        uniform.samplerIndex = ++samplerIndex;
        samplers.push( uniform );
      }
    }

    this.loadedUniforms = true;
  }

  return this;
};

Program.prototype.use = function () {
  return this.context.useProgram( this.program ), this;
};

// from p5
Program.prototype.uniform = function ( name, data ) {
  var gl = this.context,
      uniform = this.uniforms[ name ];

  switch ( uniform.type ) {
    case gl.BOOL: gl.uniform1i( uniform.location, data ? 1 : 0 ); break;
    case gl.INT: gl.uniform1i( uniform.location, data ); break;
    case gl.FLOAT: gl[ uniform.size > 1 ? 'uniform1fv' : 'uniform1f' ]( uniform.location, data ); break;
    case gl.FLOAT_MAT3: gl.uniformMatrix3fv( uniform.location, false, data ); break;
    case gl.FLOAT_MAT4: gl.uniformMatrix4fv( uniform.location, false, data ); break;
    case gl.FLOAT_VEC2: uniform.size > 1 ? gl.uniform2fv( uniform.location, data ) : gl.uniform2f( uniform.location, data[ 0 ], data[ 1 ] ); break;
    case gl.FLOAT_VEC3: uniform.size > 1 ? gl.uniform3fv( uniform.location, data ) : gl.uniform3f( uniform.location, data[ 0 ], data[ 1 ], data[ 2 ] ); break;
    case gl.FLOAT_VEC4: uniform.size > 1 ? gl.uniform4fv( uniform.location, data ) : gl.uniform4f( uniform.location, data[ 0 ], data[ 1 ], data[ 2 ], data[ 3 ] ); break;
    default: throw TypeError( "This uniform type isn't supported for setting: " + uniform.type );
  }

  return this;
};

Program.prototype.vertexPointer = function ( index, size, type, normalized, stride, offset ) {
  this.context.enableVertexAttribArray( index );
  this.context.vertexAttribPointer( index, size, type, normalized, stride, offset );
  return this;
};

var create_program = function ( context, vShader, fShader ) {

  var program = context.createProgram();

  context.attachShader( program, vShader );
  context.attachShader( program, fShader );
  context.linkProgram( program );

  if ( !context.getProgramParameter( program, context.LINK_STATUS ) ) {
    throw Error( 'Unable to initialize the shader program' );
  }

  context.validateProgram( program );

  if ( !context.getProgramParameter( program, context.VALIDATE_STATUS ) ) {
    throw Error( 'Unable to validate the shader program' );
  }

  return program;

};

/* SHADER */

var shader = function ( v, f ) {
  return new Shader( v, f );
};

var Shader = function ( v, f ) {
  this.vShaderSource = v;
  this.fShaderSource = f;
  this.programs = scotch.create( null );
};

Shader.prototype = scotch.create( null );
Shader.prototype.constructor = Shader;

Shader.prototype.create = function ( renderer ) {
  if ( !this.programs[ renderer.index ] ) {
    this.programs[ renderer.index ] = new Program( renderer.context,
      create_shader( renderer.context, this.vShaderSource, renderer.context.VERTEX_SHADER ),
      create_shader( renderer.context, this.fShaderSource, renderer.context.FRAGMENT_SHADER ) );
  } else {
    warn( 'This shader program is already created for this renderer' );
  }

  return this;
};

Shader.prototype.use = function ( renderer ) {
  return this.programs[ renderer.index ].use(), this;
};

Shader.prototype.program = function ( renderer ) {
  return this.programs[ renderer.index ];
};

Shader.prototype.uniform = function ( renderer, name, data ) {
  return this.programs[ renderer.index ].uniform( name, data ), this;
};

Shader.prototype.vertexPointer = function ( renderer, index, size, type, normalized, stride, offset ) {
  return this.programs[ renderer.index ].vertexPointer( index, size, type, normalized, stride, offset ), this;
};

var create_shader = function ( context, source, type ) {

  var shader = context.createShader( type );

  context.shaderSource( shader, source );
  context.compileShader( shader );

  if ( !context.getShaderParameter( shader, context.COMPILE_STATUS ) ) {
    throw SyntaxError( 'An error occurred compiling the shaders: ' + context.getShaderInfoLog( shader ) );
  }

  return shader;

};

var get_source = function ( script ){
  var child = script.firstChild,
      source = '';

  while ( child ) {
    if ( child.nodeType == 3 ) {
      source += child.textContent;
    }

    child = child.nextSibling;
  }

  return source;
};

/* BUFFER */

var buffer = function ( context ) {
  return new Buffer( context );
};

var Buffer = function ( context ) {
  this.context = context;
  this.buffer = context.createBuffer();
};

Buffer.prototype = scotch.create( null );
Buffer.prototype.constructor = Buffer;

Buffer.prototype.bind = function () {
  return this.context.bindBuffer( this.context.ARRAY_BUFFER, this.buffer ), this;
};

Buffer.prototype.data = function ( data, mode ) {
  return this.context.bufferData( this.context.ARRAY_BUFFER, data, mode === undefined ? this.context.STATIC_DRAW : mode ), this;
};

/* TRANSFORM */

// webgl-2d transform class implementation

var Transform = function () {
  this.stack = [];
  this.matrix = matrix.identity();
};

Transform.prototype = scotch.create( null );
Transform.prototype.constructor = Transform;
Transform.prototype.index = -1;

Transform.prototype.set = function ( a, b, c, d, e, f ) {

  var matrix = this.matrix;

  matrix[ 0 ] = a; // scale x
  matrix[ 4 ] = d; // scale y
  matrix[ 1 ] = b; // skew x
  matrix[ 3 ] = c; // skew y
  matrix[ 6 ] = e; // translate x
  matrix[ 7 ] = f; // translate y

  return this;

};

Transform.prototype.save = function () {
  if ( this.stack[ ++this.index ] ) {
    matrix.copy( this.stack[ this.index ], this.matrix );
  } else {
    this.stack.push( matrix.clone( this.matrix ) );
  }

  return this;
};

Transform.prototype.restore = function () {
  if ( this.stack.length ) {
    matrix.copy( this.matrix, this.stack[ this.index-- ] );
  } else {
    matrix.setIdentity( this.matrix );
  }

  return this;
};

Transform.prototype.translate = function ( x, y ) {
  return matrix.translate( this.matrix, x, y ), this;
};

Transform.prototype.rotate = function ( angle ) {
  return matrix.rotate( this.matrix, angle ), this;
};

Transform.prototype.scale = function ( x, y ) {
  return matrix.scale( this.matrix, x, y ), this;
};

/* MATRIX4 */

var matrix = {
  identity: function () {
    return [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];
  },

  setIdentity: function ( m1 ) {

    m1[ 0 ] = m1[ 4 ] = m1[ 8 ] = 1;
    m1[ 1 ] = m1[ 2 ] = m1[ 3 ] = m1[ 5 ] = m1[ 6 ] = m1[ 7 ] = 0;

    return m1;

  },

  // from webgl-2d
  mult: function ( m1, m2 ) {

    var m10 = m1[ 0 ], m11 = m1[ 1 ], m12 = m1[ 2 ],
        m13 = m1[ 3 ], m14 = m1[ 4 ], m15 = m1[ 5 ],
        m16 = m1[ 6 ], m17 = m1[ 7 ], m18 = m1[ 8 ],
        m20 = m2[ 0 ], m21 = m2[ 1 ], m22 = m2[ 2 ],
        m23 = m2[ 3 ], m24 = m2[ 4 ], m25 = m2[ 5 ],
        m26 = m2[ 6 ], m27 = m2[ 7 ], m28 = m2[ 8 ];

    m1[ 0 ] = m20 * m10 + m23 * m11 + m26 * m12;
    m1[ 1 ] = m21 * m10 + m24 * m11 + m27 * m12;
    m1[ 2 ] = m22 * m10 + m25 * m11 + m28 * m12;
    m1[ 3 ] = m20 * m13 + m23 * m14 + m26 * m15;
    m1[ 4 ] = m21 * m13 + m24 * m14 + m27 * m15;
    m1[ 5 ] = m22 * m13 + m25 * m14 + m28 * m15;
    m1[ 6 ] = m20 * m16 + m23 * m17 + m26 * m18;
    m1[ 7 ] = m21 * m16 + m24 * m17 + m27 * m18;
    m1[ 8 ] = m22 * m16 + m25 * m17 + m28 * m18;

    return m1;

  },

  clone: function ( m1 ) {
    return [
      m1[ 0 ], m1[ 1 ], m1[ 2 ],
      m1[ 3 ], m1[ 4 ], m1[ 5 ],
      m1[ 6 ], m1[ 7 ], m1[ 8 ]
    ];
  },

  copy: function ( m1, m2 ) {

    m1[ 0 ] = m2[ 0 ];
    m1[ 1 ] = m2[ 1 ];
    m1[ 2 ] = m2[ 2 ];
    m1[ 3 ] = m2[ 3 ];
    m1[ 4 ] = m2[ 4 ];
    m1[ 5 ] = m2[ 5 ];
    m1[ 6 ] = m2[ 6 ];
    m1[ 7 ] = m2[ 7 ];
    m1[ 8 ] = m2[ 8 ];

    return m1;

  },

  // from glMatrix
  translate: function ( m1, x, y ) {

    m1[ 6 ] = x * m1[ 0 ] + y * m1[ 3 ] + m1[ 6 ];
    m1[ 7 ] = x * m1[ 1 ] + y * m1[ 4 ] + m1[ 7 ];
    m1[ 8 ] = x * m1[ 2 ] + y * m1[ 5 ] + m1[ 8 ];

    return m1;

  },

  // from glMatrix
  rotate: function ( m1, angle ) {

    var m10 = m1[ 0 ], m11 = m1[ 1 ], m12 = m1[ 2 ],
        m13 = m1[ 3 ], m14 = m1[ 4 ], m15 = m1[ 5 ],
        x = cos( angle ),
        y = sin( angle );

    m1[ 0 ] = x * m10 + y * m13;
    m1[ 1 ] = x * m11 + y * m14;
    m1[ 2 ] = x * m12 + y * m15;
    m1[ 3 ] = x * m13 - y * m10;
    m1[ 4 ] = x * m14 - y * m11;
    m1[ 5 ] = x * m15 - y * m12;

    return m1;

  },

  // from p5
  scale: function ( m1, x, y ) {

    m1[ 0 ] *= x;
    m1[ 1 ] *= x;
    m1[ 2 ] *= x;
    m1[ 3 ] *= y;
    m1[ 4 ] *= y;
    m1[ 5 ] *= y;

    return matrix;
  }
};

/* RENDERERWEBGL */

var default_shaders = {

  vertex:

'precision mediump float;' +
'precision mediump int;' +
'attribute vec2 a_position;' +
'uniform vec2 u_resolution;' +
'uniform mat3 u_transform;' +

'void main () {' +
  'gl_Position = vec4( ( ( u_transform * vec3( a_position, 1.0 ) ).xy / u_resolution * 2.0 - 1.0 ) * vec2( 1, -1 ), 0, 1 );' +
'}',

  fragment:

'precision mediump float;' +
'precision mediump int;' +
'uniform vec4 u_color;' +

'void main () {' +
  'gl_FragColor = vec4( u_color.r / 255.0, u_color.g / 255.0, u_color.b / 255.0, u_color.a );' +
'}',

  background_vertex:

'precision lowp float;' +
'precision lowp int;' +
'attribute vec2 a_position;' +

'void main () {' +
  'gl_Position = vec4( a_position, 0, 1 );' +
'}',

  background_fragment:

'precision lowp float;' +
'precision lowp int;' +
'uniform vec4 u_color;' +

'void main () {' +
  'gl_FragColor = u_color;' +
'}'

};

var shaders = new Shader( default_shaders.vertex, default_shaders.fragment ),
    background_shaders = new Shader( default_shaders.background_vertex, default_shaders.background_fragment );

var RendererWebGL = function ( options ) {
  create_renderer( this, 'webgl', options );
  this.matrix = new Transform();
  this.buffer = new Buffer( this.context );
  this.shaders = shaders.create( this );
  this.program = shaders.program( this );
  this.backgroundBuffer = new Buffer( this.context ).bind().data( background_vertices );
  this.backgroundShaders = background_shaders.create( this );
  this.backgroundProgram = background_shaders.program( this );
  this.rectangleBuffer = new Buffer( this.context ).bind().data( rectangle_vertices );
  this.blending( true );
};

RendererWebGL.prototype = scotch.create( null );
RendererWebGL.prototype.constructor = RendererWebGL;
RendererWebGL.prototype.add = Renderer2D.prototype.add;
RendererWebGL.prototype.destroy = Renderer2D.prototype.destroy;
RendererWebGL.prototype.pixelDensity = Renderer2D.prototype.pixelDensity;
RendererWebGL.prototype.push = Renderer2D.prototype.push;
RendererWebGL.prototype.pop = Renderer2D.prototype.pop;

RendererWebGL.prototype.resize = function ( w, h ) {
  Renderer2D.prototype.resize.call( this, w, h );
  this.context.viewport( 0, 0, this.width, this.height );
  return this;
};

RendererWebGL.prototype.fullwindow = Renderer2D.prototype.fullwindow;

RendererWebGL.prototype.blending = function ( blending ) {
  var gl = this.context;

  if ( blending ) {
    gl.enable( gl.BLEND );
    gl.disable( gl.DEPTH_TEST );
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA );
    gl.blendEquation( gl.FUNC_ADD );
  } else {
    gl.disable( gl.BLEND );
    gl.enable( gl.DEPTH_TEST );
    gl.depthFunc( gl.LEQUAL );
  }

  return this;
};

RendererWebGL.prototype._clear_color = function ( r, g, b, a ) {

  var gl = this.context;

  gl.clearColor( r, g, b, a );
  gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

  return this;

};

RendererWebGL.prototype.clearColor = function ( a, b, c, d ) {

  var rgba = this.color( a, b, c, d );

  if ( rgba.type !== 'rgba' ) {
    rgba = rgba.rgba();
  }

  return this._clear_color(
    rgba[ 0 ] / 255,
    rgba[ 1 ] / 255,
    rgba[ 2 ] / 255,
    rgba[ 3 ] );

};

var background_vertices = new Float32Array( [
  -1,  1,
   1,  1,
   1, -1,
  -1, -1
] );

RendererWebGL.prototype._background_color = function ( r, g, b, a ) {

  var gl = this.context,
      backgroundProgram = this.backgroundProgram;

  this.backgroundBuffer.bind();

  backgroundProgram
    .use()
    .uniform( 'u_color', [ r, g, b, a ] )
    .vertexPointer( backgroundProgram.attributes.a_position.location, 2, gl.FLOAT, false, 0, 0 );

  gl.drawArrays( gl.TRIANGLE_FAN, 0, 4 );

  return this;

};

RendererWebGL.prototype.backgroundColor = function ( a, b, c, d ) {

  var rgba = this.color( a, b, c, d ),
      r, g;

  if ( rgba.type !== 'rgba' ) {
    rgba = rgba.rgba();
  }

  r = rgba[ 0 ] / 255;
  g = rgba[ 1 ] / 255;
  b = rgba[ 2 ] / 255;
  a = rgba[ 3 ];

  return this[ a < 1 ?
    '_background_color' :
    '_clear_color' ]( r, g, b, a );

};

RendererWebGL.prototype.background = Renderer2D.prototype.background;

RendererWebGL.prototype.clear = function ( x, y, w, h ) {
  return this._clear_color( 0, 0, 0, 0 );
};

RendererWebGL.prototype.draw = function ( data, length ) {
  if ( length > 0 ) {
    var gl = this.context,
        program = this.program;

    if ( data ) {
      this.buffer
        .bind()
        .data( data );
    }

    program
      .use()
      .uniform( 'u_resolution', [ this.width, this.height ] )
      .uniform( 'u_transform', this.matrix.matrix )
      .vertexPointer( program.attributes.a_position.location, 2, gl.FLOAT, false, 0, 0 );

    if ( this.style.doFill ) {
      program.uniform( 'u_color', this.style.fillStyle.rgba() );
      gl.drawArrays( gl.TRIANGLE_FAN, 0, length );
    }

    if ( this.style.doStroke && this.style.lineWidth > 0 ) {
      program.uniform( 'u_color', this.style.strokeStyle.rgba() );
      gl.lineWidth( this.style.lineWidth );
      gl.drawArrays( gl.LINE_LOOP, 0, length );
    }
  }

  return this;
};

var rectangle_vertices = new Float32Array( [
  0, 0,
  1, 0,
  1, 1,
  0, 1
] );

RendererWebGL.prototype.rect = function ( x, y, w, h ) {
  this.matrix
    .save()
    .translate( x, y )
    .scale( w, h );

  this.rectangleBuffer.bind();

  this.draw( null, 4 );

  this.matrix.restore();

  return this;
};

RendererWebGL.prototype.line = function ( x1, y1, x2, y2 ) {
  if ( this.style.doStroke && this.style.lineWidth > 0 ) {
    var gl = this.context,
        buffer = this.buffer,
        program = this.program,
        vertices = new Float32Array( 4 );

    vertices[ 0 ] = x1;
    vertices[ 1 ] = y1;
    vertices[ 2 ] = x2;
    vertices[ 3 ] = y2;

    buffer
      .bind()
      .data( vertices );

    program
      .use()
      .uniform( 'u_color', this.style.strokeStyle.rgba() )
      .uniform( 'u_resolution', [ this.width, this.height ] )
      .uniform( 'u_transform', this.matrix.matrix )
      .vertexPointer( program.attributes.a_position.location, 2, gl.FLOAT, false, 0, 0 );

    gl.lineWidth( this.style.lineWidth );
    gl.drawArrays( gl.LINE_LOOP, 0, 2 );
  }

  return this;
};

var polygons = scotch.create( null );

var create_polygon = function ( n ) {
  var step = 2 * pi / n,
      int_n = floor( n ),
      vertices = new Float32Array( int_n * 2 + 2 ),
      i = int_n,
      angle = step * n;

  vertices[     int_n * 2 ] = cos( angle );
  vertices[ 1 + int_n * 2 ] = sin( angle );

  for ( ; i >= 0; --i ) {
    vertices[     i * 2 ] = cos( angle = step * i );
    vertices[ 1 + i * 2 ] = sin( angle );
  }

  return vertices;
};

RendererWebGL.prototype._polygon = function ( x, y, x_radius, y_radius, resolution, angle, degrees ) {

  if ( angle === undefined ) {
    angle = 0;
  } else if ( degrees ) {
    angle *= pi / 180;
  }

  var matrix = this.matrix,
      polygon = polygons[ resolution ];

  if ( !polygon ) {
    polygon = polygons[ resolution ] = create_polygon( resolution );
  }

  matrix
    .save()
    .translate( x, y )
    .rotate( angle || 0 )
    .scale( x_radius, y_radius );

  this.draw( polygon, polygon.length >> 1 );

  matrix.restore();

  return this;

};

RendererWebGL.prototype.ellipse = function ( x, y, r1, r2 ) {
  return this._polygon( x, y, r1, r2, 24 );
};

RendererWebGL.prototype.arc = function ( x, y, r ) {
  return this._polygon( x, y, r, r, 24 );
};

RendererWebGL.prototype.polygon = function ( x, y, r, n, a ) {
  if ( n % 1 ) {
    n = floor( n * 100 ) / 100;
  }

  if ( a === undefined ) {
    this._polygon( x, y, r, r, n, -pi * 0.5 );
  } else {
    this._polygon( x, y, r, r, n, a, settings.degrees );
  }

  return this;
};

RendererWebGL.prototype.font = Renderer2D.prototype.font;

RendererWebGL.prototype.save = function () {
  return this.matrix.save(), this;
};

RendererWebGL.prototype.restore = function () {
  return this.matrix.restore(), this;
};

RendererWebGL.prototype.translate = function ( x, y ) {
  return this.matrix.translate( x, y ), this;
};

RendererWebGL.prototype.rotate = function ( angle ) {
  return this.matrix.rotate( settings.degrees ? angle * pi / 180 : angle ), this;
};

RendererWebGL.prototype.scale = function ( x, y ) {
  return this.matrix.scale( x, y ), this;
};

RendererWebGL.prototype.setTransform = function ( a, b, c, d, e, f ) {
  return this.matrix.set( a, b, c, d, e, f ), this;
};

RendererWebGL.prototype.noFill = Renderer2D.prototype.noFill;
RendererWebGL.prototype.noStroke = Renderer2D.prototype.noStroke;
RendererWebGL.prototype.beginShape = Renderer2D.prototype.beginShape;
RendererWebGL.prototype.vertex = Renderer2D.prototype.vertex;

RendererWebGL.prototype.endShape = function () {
  return this.draw( new Float32Array( this.vertices ), this.vertices.length * 0.5 );
};

RendererWebGL.prototype.rectAlign = Renderer2D.prototype.rectAlign;
RendererWebGL.prototype.color = Renderer2D.prototype.color;
RendererWebGL.prototype.colorMode = Renderer2D.prototype.colorMode;
RendererWebGL.prototype.fill = Renderer2D.prototype.fill;
RendererWebGL.prototype.stroke = Renderer2D.prototype.stroke;
RendererWebGL.prototype.lineWidth = Renderer2D.prototype.lineWidth;
RendererWebGL.prototype.global = Renderer2D.prototype.global;

// todo implement point
RendererWebGL.prototype.point = function ( x, y ) {
  return this
    .push()
    .noStroke()
    .fill( this.style.strokeStyle )
    .arc( x, y, this.style.lineWidth >> 1 )
    .pop();
};

var create_renderer = function ( renderer, mode, options ) {
  if ( options === undefined ) {
    options = scotch.clone( true, default_options );
  } else {
    options = scotch.defaults( default_options, options );
  }

  renderer.settings = options.settings;
  renderer.mode = mode;
  renderer.index = ++renderer_index;
  renderer.saves = [];
  renderer.vertices = [];
  renderer.state = { beginPath: false };
  renderers[ renderer.index ] = renderer;

  if ( !options.canvas ) {
    renderer.canvas = document.createElement( 'canvas' );
    renderer.canvas.innerHTML = 'Unable to run that application. Try to update your browser.';
  } else {
    renderer.canvas = options.canvas;
  }

  renderer.style = {
    rectAlignX: 'left',
    rectAlignY: 'top',
    doFill: true,
    doStroke: true,
    fillStyle: renderer.color(),
    font: new Font(),
    lineHeight: 14,
    lineWidth: 2,
    strokeStyle: renderer.color(),
    textAlign: 'left',
    textBaseline: 'top'
  };

  if ( mode === '2d' ) {
    renderer.context = renderer.canvas.getContext( '2d', { alpha: options.alpha } );
    renderer.smooth( renderer.settings.smooth );
  } else if ( mode === 'webgl' ) {
    switch ( support.webgl ) {
      case 1: renderer.context = renderer.canvas.getContext( 'webgl', { alpha: options.alpha } ); break;
      case 2: renderer.context = renderer.canvas.getContext( 'webgl-experemental', { alpha: options.alpha } );
    }
  }

  if ( options.append === undefined || options.append ) {
    renderer.add();
  }

  if ( options.width != null || options.height != null ) {
    renderer.resize( options.width, options.height );
  } else {
    renderer.fullwindow();
  }
};

v6.Ticker = Ticker;
v6.Vector2D = Vector2D;
v6.Vector3D = Vector3D;
v6.RGBA = RGBA;
v6.HSLA = HSLA;
v6.Font = Font;
v6.Image = Image;
v6.Loader = Loader;
v6.Buffer = Buffer;
v6.Shader = Shader;
v6.Program = Program;
v6.Transform = Transform;
v6.Renderer2D = Renderer2D;
v6.RendererWebGL = RendererWebGL;
v6.ticker = ticker;
v6.vec2 = vec2;
v6.vec3 = vec3;
v6.rgba = rgba;
v6.hsla = hsla;
v6.font = font;
v6.color = color;
v6.image = image;
v6.loader = loader;
v6.colors = colors;
v6.buffer = buffer;
v6.matrix = matrix;
v6.shader = shader;
v6.program = program;
v6.map = map;
v6.dist = dist;
v6.lerpColor = lerp_color;
v6.getShaderSource = get_source;
v6.support = support;
v6.filters = filters;
v6.shapes = shapes;
v6.options = default_options;
v6.shaders = default_shaders;
v6.settings = settings;
window.v6 = v6;

} )( this );
